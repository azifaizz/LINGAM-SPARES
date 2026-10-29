import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { attendanceService } from '@/services/attendance.service';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  statusDotClass,
  statusLabel,
} from '@/utils/date';

interface DayRecord {
  status?: string;
  in?: string;
  out?: string;
  remarks?: string;
}

const CalendarPage = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<Record<string, DayRecord>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<{ date: string; data?: DayRecord } | null>(null);

  const yearMonth = format(currentDate, 'yyyy-MM');

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const rawData = await attendanceService.getMyAttendance(user.staffId, yearMonth);
        const transformed: Record<string, DayRecord> = {};
        if (rawData && typeof rawData === 'object') {
          Object.entries(rawData).forEach(([dayNum, val]: [string, any]) => {
            if (val && typeof val === 'object') {
              transformed[`${yearMonth}-${dayNum.padStart(2, '0')}`] = {
                status: val.status,
                in: val.in,
                out: val.out,
                remarks: val.remarks,
              };
            }
          });
        }
        setAttendanceData(transformed);
      } catch (e) {
        console.error('Failed to fetch attendance', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [user, yearMonth]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDay = getDay(monthStart);
    const padding: Date[] = [];
    for (let i = 0; i < startDay; i++) {
      const d = new Date(monthStart);
      d.setDate(d.getDate() - startDay + i);
      padding.push(d);
    }
    return [...padding, ...days];
  }, [currentDate]);

  const summary = useMemo(() => {
    const values = Object.values(attendanceData);
    return {
      present: values.filter((d) => ['PRESENT', 'FULL_DAY', 'PERMISSION'].includes(d.status || '')).length,
      absent: values.filter((d) => d.status === 'ABSENT').length,
      leave: values.filter((d) => ['LEAVE', 'SICK_LEAVE'].includes(d.status || '')).length,
    };
  }, [attendanceData]);

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  return (
    <div>
      {/* Month nav */}
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
          <ion-icon name="chevron-back-outline" />
        </button>
        <span className="cal-title">{format(currentDate, 'MMMM yyyy')}</span>
        <button className="cal-nav-btn" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
          <ion-icon name="chevron-forward-outline" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="cal-grid" style={{ marginBottom: 4 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="cal-dow">{d}</div>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div className="spinner dark" style={{ width: 26, height: 26 }} />
        </div>
      ) : (
        <div className="cal-grid">
          {calendarDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = dateKey === todayKey;
            const isHoliday = getDay(day) === 0;
            const dayData = attendanceData[dateKey];
            const dot = statusDotClass(dayData?.status);
            return (
              <button
                key={dateKey}
                className={`cal-cell ${isCurrentMonth ? '' : 'is-out'} ${isToday ? 'is-today' : ''} ${isHoliday ? 'is-holiday' : ''}`}
                onClick={() => setSelectedDay({ date: dateKey, data: dayData })}
              >
                <span>{format(day, 'd')}</span>
                {dot ? <span className={`cal-dot ${dot}`} /> : isHoliday ? <span className="cal-dot dot-holiday" /> : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="cal-summary">
        <span><b>{summary.present}</b> Present</span>
        <span><b>{summary.absent}</b> Absent</span>
        <span><b>{summary.leave}</b> Leave</span>
      </div>

      {/* Day detail sheet */}
      {selectedDay && (
        <div className="modal-overlay" onClick={() => setSelectedDay(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{format(new Date(selectedDay.date), 'MMM dd, yyyy')}</h3>
                <p className="t-tiny">{format(new Date(selectedDay.date), 'EEEE')}</p>
              </div>
              <button className="cal-nav-btn" onClick={() => setSelectedDay(null)}>
                <ion-icon name="close-outline" />
              </button>
            </div>

            {selectedDay.data || getDay(new Date(selectedDay.date)) === 0 ? (
              <div className="group">
                {getDay(new Date(selectedDay.date)) === 0 && (
                  <div className="row">
                    <span className="row-label">Status</span>
                    <span className="row-value" style={{ color: '#CA8A04', fontWeight: 700 }}>Weekly Holiday</span>
                  </div>
                )}
                {selectedDay.data?.status && getDay(new Date(selectedDay.date)) !== 0 && (
                  <div className="row">
                    <span className="row-label">Status</span>
                    <span className="row-value">{statusLabel(selectedDay.data.status)}</span>
                  </div>
                )}
                <div className="row">
                  <span className="row-label">In Time</span>
                  <span className="row-value">{selectedDay.data?.in || '-'}</span>
                </div>
                <div className="row">
                  <span className="row-label">Out Time</span>
                  <span className="row-value">{selectedDay.data?.out || '-'}</span>
                </div>
                {selectedDay.data?.remarks && (
                  <div className="row">
                    <span className="row-label">Remarks</span>
                    <span className="row-value">{selectedDay.data.remarks}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="t-muted" style={{ textAlign: 'center', padding: '20px 0', fontSize: 14 }}>
                No attendance recorded
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
