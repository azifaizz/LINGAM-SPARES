import React, { useState, useEffect, useCallback } from 'react';
import { App } from '@capacitor/app';
import { useAuth } from '@/context/AuthContext';
import { attendanceService } from '@/services/attendance.service';
import { locationService, GeoPosition } from '@/services/location.service';
import api from '@/services/api.service';
import {
  getTodayString,
  getCurrentYearMonth,
  formatTime12h,
  relativeDayLabel,
  getLastDayOfMonth,
  statusLabel,
} from '@/utils/date';

interface TodayStatus {
  marked: boolean;
  status?: string;
  inTime?: string;
}

interface OfficeLocation {
  locationName?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

type Phase = 'idle' | 'loading' | 'done' | 'marked';

const STAFF_OFFICE_KEY = 'staff_office_location_v1';

const getCachedOffice = (): OfficeLocation | null => {
  try {
    const raw = localStorage.getItem(STAFF_OFFICE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

const HomePage = () => {
  const { user } = useAuth();
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');

  const cachedOffice = getCachedOffice();
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [office, setOffice] = useState<OfficeLocation | null>(cachedOffice);
  const [geofenceEnabled, setGeofenceEnabled] = useState(
    Boolean(cachedOffice && (cachedOffice.latitude !== 0 || cachedOffice.longitude !== 0))
  );
  const [distance, setDistance] = useState<number | null>(null);
  const [locState, setLocState] = useState<'checking' | 'ok' | 'far' | 'denied' | 'prompt' | 'off' | 'info'>('checking');
  const [locMsg, setLocMsg] = useState('');

  const [month, setMonth] = useState<Record<string, any>>({});
  const [failMsg, setFailMsg] = useState('');

  const yearMonth = getCurrentYearMonth();

  // ── Init: today status + office settings ──
  useEffect(() => {
    const init = async () => {
      if (!user) return;
      try {
        const [statusRes, settingsRes] = await Promise.all([
          attendanceService.checkToday(user.staffId, getTodayString()),
          api.get('/settings').catch((err) => {
            console.warn('Failed to load settings from server, falling back to cached office', err);
            return null;
          }),
        ]);
        setTodayStatus(statusRes);
        if (statusRes.marked) setPhase('marked');

        if (settingsRes?.data) {
          const lat = Number(settingsRes.data.latitude) || 0;
          const lng = Number(settingsRes.data.longitude) || 0;
          const rad = Number(settingsRes.data.radiusMeters) || 50;
          const name = settingsRes.data.locationName || 'Main Office';

          if (lat !== 0 || lng !== 0) {
            const newOffice = { locationName: name, latitude: lat, longitude: lng, radiusMeters: rad };
            setOffice(newOffice);
            setGeofenceEnabled(true);
            try {
              localStorage.setItem(STAFF_OFFICE_KEY, JSON.stringify(newOffice));
            } catch {}
          } else if (cachedOffice && (cachedOffice.latitude !== 0 || cachedOffice.longitude !== 0)) {
            setOffice(cachedOffice);
            setGeofenceEnabled(true);
          }
        } else if (cachedOffice && (cachedOffice.latitude !== 0 || cachedOffice.longitude !== 0)) {
          setOffice(cachedOffice);
          setGeofenceEnabled(true);
        }
      } catch (e) {
        console.error('Init error', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user]);

  // ── This month attendance (stats + activity) ──
  useEffect(() => {
    const fetchMonth = async () => {
      if (!user) return;
      try {
        const data = await attendanceService.getMyAttendance(user.staffId, yearMonth);
        const map: Record<string, any> = {};
        if (data && typeof data === 'object') {
          Object.entries(data).forEach(([day, val]: [string, any]) => {
            if (val && typeof val === 'object') map[day] = val;
          });
        }
        setMonth(map);
      } catch (e) {
        console.error('Month error', e);
      }
    };
    fetchMonth();
  }, [user, yearMonth]);

  // ── Location ──
  const refreshLocation = useCallback(async () => {
    setLocState('checking');
    setLocMsg('Verifying your location…');

    // Always fetch latest office settings directly from server so website updates reflect immediately
    let targetOffice = office;
    try {
      const settingsRes = await api.get('/settings');
      if (settingsRes?.data) {
        const lat = Number(settingsRes.data.latitude) || 0;
        const lng = Number(settingsRes.data.longitude) || 0;
        const rad = Number(settingsRes.data.radiusMeters) || 50;
        const name = settingsRes.data.locationName || 'Main Office';
        if (lat !== 0 || lng !== 0) {
          targetOffice = { locationName: name, latitude: lat, longitude: lng, radiusMeters: rad };
          setOffice(targetOffice);
          setGeofenceEnabled(true);
          try {
            localStorage.setItem(STAFF_OFFICE_KEY, JSON.stringify(targetOffice));
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Could not refresh office settings from server, using cached', e);
    }

    if (!targetOffice || (targetOffice.latitude === 0 && targetOffice.longitude === 0)) {
      // Office point not configured: can't enforce a geofence. Still try to read a position.
      const res = await locationService.ensureLocation();
      if (res.status === 'granted' && res.position) setPosition(res.position);
      setLocState('info');
      setLocMsg('Office location not configured on server — marking without geofence.');
      return;
    }

    const res = await locationService.ensureLocation();
    if (res.status === 'granted' && res.position) {
      setPosition(res.position);
      const { getDistanceMeters } = await import('@/utils/geofence');
      const dist = Math.round(
        getDistanceMeters(
          res.position.latitude,
          res.position.longitude,
          targetOffice.latitude,
          targetOffice.longitude
        )
      );
      setDistance(dist);

      if (dist <= targetOffice.radiusMeters) {
        setLocState('ok');
        setLocMsg(`Within office premises (${dist}m away, limit: ${targetOffice.radiusMeters}m)`);
      } else {
        setLocState('far');
        setLocMsg(`You are ${dist}m away from ${targetOffice.locationName || 'office'} (limit: ${targetOffice.radiusMeters}m).`);
      }
    } else if (res.status === 'prompt') {
      setLocState('prompt');
      setLocMsg('Location permission is required to mark attendance.');
    } else if (res.status === 'denied') {
      setLocState('denied');
      setLocMsg('Location permission denied. Please allow access.');
    } else if (res.status === 'off') {
      setLocState('off');
      setLocMsg('Device location (GPS) is turned off. Please turn it on.');
    } else {
      setLocState('denied');
      setLocMsg('Could not detect location. Please check GPS and try again.');
    }
  }, [office]);

  const handleTurnOnLocation = async () => {
    setLocMsg('Opening location settings…');
    await locationService.promptEnableLocation();
    setTimeout(() => {
      refreshLocation();
    }, 1500);
  };

  const handleAllowPermission = async () => {
    const req = await locationService.requestPermission();
    if (req.location === 'denied' && req.coarseLocation === 'denied') {
      await locationService.openAppSettings();
    } else {
      refreshLocation();
    }
  };

  useEffect(() => {
    refreshLocation();
    const subPromise = App.addListener('appStateChange', (state) => {
      if (state.isActive) {
        refreshLocation();
      }
    });
    return () => {
      subPromise.then((s) => s.remove()).catch(() => {});
    };
  }, [refreshLocation]);

  const withinRange = geofenceEnabled ? locState === 'ok' : locState === 'info';

  const handleCheckIn = async () => {
    if (!user || !withinRange || phase === 'loading' || phase === 'marked') return;
    setPhase('loading');
    setFailMsg('');
    const lat = position?.latitude ?? 0;
    const lng = position?.longitude ?? 0;
    try {
      const res = await attendanceService.selfMark(user.staffId, getTodayString(), lat, lng);
      if (res.alreadyMarked || res.success) {
        setTodayStatus({ marked: true, status: res.status || 'PRESENT', inTime: res.inTime });
        setPhase('done');
        setTimeout(() => setPhase('marked'), 1300);
        // refresh month data so stats update
        const data = await attendanceService.getMyAttendance(user.staffId, yearMonth);
        const map: Record<string, any> = {};
        Object.entries(data).forEach(([day, val]: [string, any]) => {
          if (val && typeof val === 'object') map[day] = val;
        });
        setMonth(map);
      } else {
        setPhase('idle');
        setFailMsg(res.message || 'Could not mark attendance.');
      }
    } catch (err: any) {
      setPhase('idle');
      const msg = err?.response?.data;
      setFailMsg(msg?.message || 'Could not mark attendance.');
    }
  };

  // ── Derived stats ──
  const entries = Object.entries(month);
  const presentCount = entries.filter(([, v]) => ['PRESENT', 'FULL_DAY', 'PERMISSION'].includes(v.status)).length;
  const leaveCount = entries.filter(([, v]) => ['LEAVE', 'SICK_LEAVE'].includes(v.status)).length;
  const absentCount = entries.filter(([, v]) => v.status === 'ABSENT').length;

  const activity = entries
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => Number(b.day) - Number(a.day))
    .slice(0, 6);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/,?\s*\d{4}/, '');

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <div className="spinner dark" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  const marked = todayStatus?.marked || phase === 'marked';

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="t-page-title" style={{ fontSize: 26 }}>
          {greeting} <span role="img" aria-label="wave">👋</span>
        </h1>
        <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{user?.name}</p>
        <p className="t-muted" style={{ fontSize: 14, marginTop: 2 }}>{dateLabel}</p>
      </div>

      {/* Today's Status (always visible) */}
      <div className="card">
        <div className="status-hero">
          <div className={`status-icon ${marked ? 'is-pop' : 'is-pending'}`}>
            <ion-icon name={marked ? 'checkmark' : 'time-outline'} style={{ fontSize: 24 }} />
          </div>
          <div>
            <div className="status-title">{marked ? 'Present' : 'Not checked in'}</div>
            <div className="status-sub">
              {marked ? (todayStatus?.inTime ? formatTime12h(todayStatus.inTime) : 'On time') : 'Tap below to mark attendance'}
            </div>
          </div>
        </div>
      </div>

      {/* Check-in button — only when not marked */}
      {!marked && (
        <>
          <div className={`loc-note ${locState === 'ok' ? 'ok' : locState === 'far' || locState === 'denied' || locState === 'off' ? 'err' : locState === 'prompt' ? 'warn' : ''}`} style={{ marginTop: 16 }}>
            <ion-icon
              name={locState === 'ok' ? 'location' : locState === 'far' || locState === 'denied' || locState === 'off' ? 'location-outline' : 'locate-outline'}
              style={{ fontSize: 18 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
              <span>{locMsg}</span>
              {office && (office.latitude !== 0 || office.longitude !== 0) && (
                <span style={{ fontSize: 11, opacity: 0.85, color: 'inherit' }}>
                  Target: {office.locationName || 'Main Office'} ({office.latitude.toFixed(4)}, {office.longitude.toFixed(4)}) • Limit: {office.radiusMeters}m
                </span>
              )}
            </div>
          </div>

          {failMsg && (
            <div className="loc-note err shake" style={{ marginBottom: 0 }}>
              <ion-icon name="alert-circle-outline" style={{ fontSize: 18 }} />
              <span>{failMsg}</span>
            </div>
          )}

          {locState === 'off' ? (
            <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={handleTurnOnLocation}>
              <ion-icon name="navigate-outline" style={{ fontSize: 18 }} />
              Turn On GPS / Location
            </button>
          ) : (locState === 'prompt' || locState === 'denied') ? (
            <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={handleAllowPermission}>
              <ion-icon name="shield-checkmark-outline" style={{ fontSize: 18 }} />
              Allow Location Permission
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              disabled={!withinRange || phase === 'loading'}
              onClick={handleCheckIn}
            >
              {phase === 'loading' && <span className="spinner" />}
              {phase === 'loading' ? 'Checking in…' : phase === 'done' ? <><ion-icon name="checkmark" className="pop" style={{ fontSize: 18 }} /> Checked In</> : <><ion-icon name="checkmark-circle-outline" style={{ fontSize: 18 }} /> Tap to Check In</>}
            </button>
          )}

          {locState === 'far' && (
            <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={refreshLocation}>
              <ion-icon name="refresh-outline" style={{ fontSize: 18 }} />
              Re-check Location
            </button>
          )}
        </>
      )}

      {/* This Month */}
      <div className="section-head">This Month</div>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-num">{presentCount}</div>
          <div className="stat-label">Present Days</div>
        </div>
        <div className="stat">
          <div className="stat-num">{leaveCount}</div>
          <div className="stat-label">Leave</div>
        </div>
        <div className="stat">
          <div className="stat-num">{absentCount}</div>
          <div className="stat-label">Absent</div>
        </div>
      </div>

      {/* Quick Summary */}
      <div className="section-head">Quick Summary</div>
      <div className="group">
        <div className="row">
          <span className="row-label">Working Hours</span>
          <span className="row-value">9h</span>
        </div>
        <div className="row">
          <span className="row-label">Present</span>
          <span className="row-value">{presentCount}</span>
        </div>
        <div className="row">
          <span className="row-label">Leaves</span>
          <span className="row-value">{leaveCount}</span>
        </div>
        <div className="row">
          <span className="row-label">Next Salary</span>
          <span className="row-value">{getLastDayOfMonth(new Date())}</span>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="section-head">Recent Activity</div>
      {activity.length === 0 ? (
        <div className="card t-muted" style={{ textAlign: 'center', fontSize: 14 }}>
          No activity yet
        </div>
      ) : (
        <div className="timeline">
          {activity.map((item) => {
            const isPresent = ['PRESENT', 'FULL_DAY', 'PERMISSION'].includes(item.status);
            const isLeave = ['LEAVE', 'SICK_LEAVE'].includes(item.status);
            const dotClass = isPresent ? '' : isLeave ? 'is-leave' : 'is-absent';
            const title = isPresent
              ? `✓ ${relativeDayLabel(`${yearMonth}-${String(item.day).padStart(2, '0')}`)}`
              : `${statusLabel(item.status)} · ${relativeDayLabel(`${yearMonth}-${String(item.day).padStart(2, '0')}`)}`;
            const time = isPresent ? formatTime12h(item.in) : '';
            return (
              <div className="timeline-item" key={item.day}>
                <div className={`timeline-dot ${dotClass}`}>
                  <ion-icon name={isPresent ? 'checkmark' : isLeave ? 'calendar' : 'close'} style={{ fontSize: 15 }} />
                </div>
                <div className="timeline-body">
                  <span className="timeline-title">{title}</span>
                  {time && <span className="timeline-time">{time}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HomePage;
