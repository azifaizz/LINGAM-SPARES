import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Save, Trash2, Loader2, MapPin, Navigation, Boxes, Plus, X, Tag } from 'lucide-react';
import { confirmAction } from '@/lib/confirm';
import { clearAllCaches } from '@/lib/clearCache';
import { staffApi, AppSettings } from '@/lib/api';
import { useCustomUnits } from '@/utils/unitManager';
import AttendanceAppDownloadCard from './AttendanceAppDownloadCard';

const OFFICE_STORAGE_KEY = 'lingam_office_location_v1';

const getCachedOfficeLocation = (): Partial<AppSettings> | null => {
  try {
    const raw = localStorage.getItem(OFFICE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

const Settings = () => {
  const [shopName, setShopName] = useLocalStorage("shopName_flipflex", "Lingam Spares");
  const [gstNumberRaw, setGstNumberRaw] = useLocalStorage('gstNumber_v4', '33BJLPN3590D1Z7');
  const gstNumber =
    !gstNumberRaw || gstNumberRaw === 'YOUR_GST_NUMBER_HERE' || gstNumberRaw === '33JPNPK3337F1ZR'
      ? '33BJLPN3590D1Z7'
      : gstNumberRaw.toString().trim();

  const [billMessage, setBillMessage] = useLocalStorage('billMessage', 'Thank You For Your Purchasing');
  const [defaultGst, setDefaultGst] = useLocalStorage('defaultGst', '');
  const [clearing, setClearing] = useState(false);

  // Custom Units State
  const { customUnits, defaultUnits, allUnits, addUnit, removeUnit } = useCustomUnits();
  const [newUnitInput, setNewUnitInput] = useState('');
  const [showDefaultUnits, setShowDefaultUnits] = useState(false);

  const handleAddCustomUnit = () => {
    const res = addUnit(newUnitInput);
    if (res.success) {
      toast.success(res.message);
      setNewUnitInput('');
    } else {
      toast.error(res.message);
    }
  };

  const handleRemoveCustomUnit = (unit: string) => {
    removeUnit(unit);
    toast.success(`Removed custom unit "${unit}".`);
  };

  // App Location State (Loaded immediately from memory/storage cache so it never flashes empty)
  const cachedLoc = getCachedOfficeLocation();
  const [locationName, setLocationName] = useState(cachedLoc?.locationName || '');
  const [latitude, setLatitude] = useState(cachedLoc?.latitude != null ? cachedLoc.latitude.toString() : '');
  const [longitude, setLongitude] = useState(cachedLoc?.longitude != null ? cachedLoc.longitude.toString() : '');
  const [radiusMeters, setRadiusMeters] = useState(cachedLoc?.radiusMeters != null ? cachedLoc.radiusMeters.toString() : '50');
  const [halfDayCutoffTime, setHalfDayCutoffTime] = useState(cachedLoc?.halfDayCutoffTime || '10:30');
  const [locationLoading, setLocationLoading] = useState(!cachedLoc?.latitude);
  const [locationSaving, setLocationSaving] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  useEffect(() => {
    fetchAppSettings();
  }, []);

  const fetchAppSettings = async () => {
    try {
      const res = await staffApi.getSettings();
      const data = res.data;
      if (data) {
        if (data.latitude != null && data.latitude !== 0) {
          setLatitude(data.latitude.toString());
        }
        if (data.longitude != null && data.longitude !== 0) {
          setLongitude(data.longitude.toString());
        }
        if (data.locationName) setLocationName(data.locationName);
        if (data.radiusMeters) setRadiusMeters(data.radiusMeters.toString());
        if (data.halfDayCutoffTime) setHalfDayCutoffTime(data.halfDayCutoffTime);
      }
    } catch (e) {
      console.warn('Failed to load app settings from cloud, keeping local cache', e);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    const parsedLat = parseFloat(latitude);
    const parsedLng = parseFloat(longitude);

    if (isNaN(parsedLat) || isNaN(parsedLng) || (parsedLat === 0 && parsedLng === 0)) {
      toast.error('Please enter valid Latitude and Longitude coordinates or click "Get Current Location" first');
      return;
    }

    setLocationSaving(true);
    const payload: AppSettings = {
      id: 'default_location',
      locationName: locationName.trim() || 'Main Office',
      latitude: parsedLat,
      longitude: parsedLng,
      radiusMeters: parseInt(radiusMeters) || 50,
      halfDayCutoffTime: halfDayCutoffTime || '10:30',
    };

    // Save locally immediately
    try {
      localStorage.setItem(OFFICE_STORAGE_KEY, JSON.stringify(payload));
    } catch {}

    try {
      await staffApi.saveSettings(payload);
      toast.success('Location settings saved and synced to database!');
    } catch (e) {
      console.error(e);
      toast.error('Saved locally, but failed to sync to cloud database.');
    } finally {
      setLocationSaving(false);
    }
  };

  const handleGetMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude.toFixed(6);
        const newLng = position.coords.longitude.toFixed(6);
        setLatitude(newLat);
        setLongitude(newLng);
        setFetchingLocation(false);
        // Pre-save to storage so it never resets or gets lost even if page is refreshed
        try {
          const current = getCachedOfficeLocation() || {};
          localStorage.setItem(OFFICE_STORAGE_KEY, JSON.stringify({
            ...current,
            latitude: parseFloat(newLat),
            longitude: parseFloat(newLng),
            locationName: locationName || current.locationName || 'Main Office',
            radiusMeters: parseInt(radiusMeters) || 50,
            halfDayCutoffTime: halfDayCutoffTime || '10:30',
          }));
        } catch {}
        toast.success('Location fetched! Click "Save Location" or "Save Settings" to persist.');
      },
      (error) => {
        setFetchingLocation(false);
        toast.error('Failed to get location. Please enable location services in your browser.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    // If coordinates are present, also save location so user never loses it
    const parsedLat = parseFloat(latitude);
    const parsedLng = parseFloat(longitude);
    if (!isNaN(parsedLat) && !isNaN(parsedLng) && (parsedLat !== 0 || parsedLng !== 0)) {
      const payload: AppSettings = {
        id: 'default_location',
        locationName: locationName.trim() || 'Main Office',
        latitude: parsedLat,
        longitude: parsedLng,
        radiusMeters: parseInt(radiusMeters) || 50,
        halfDayCutoffTime: halfDayCutoffTime || '10:30',
      };
      try {
        localStorage.setItem(OFFICE_STORAGE_KEY, JSON.stringify(payload));
        await staffApi.saveSettings(payload);
      } catch (e) {
        console.warn('Could not sync location during general save', e);
      }
    }
    toast.success("Settings Saved!");
  };

  const handleClearCache = async () => {
    const confirmed = await confirmAction({
      title: 'Clear All Cached Data',
      message: 'This will delete ALL locally stored cached data including IndexedDB, localStorage, sessionStorage, and in-memory cache. The app will re-fetch everything fresh from the database. This action cannot be undone.',
      confirmText: 'Yes, Clear Everything',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!confirmed) return;

    setClearing(true);
    toast.loading('Clearing all cached data...', { id: 'clear-cache' });

    try {
      await clearAllCaches();
      toast.success('All caches cleared! Reloading...', { id: 'clear-cache' });
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error('Failed to clear caches:', err);
      toast.error('Failed to clear caches. Please try again.', { id: 'clear-cache' });
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Settings</h1>

      {/* General Settings */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-bold text-gray-700 mb-4">General</h2>
        <div className="space-y-4 max-w-lg">
          <div>
            <label htmlFor="shopName" className="font-medium text-gray-700">Shop Name</label>
            <input
              id="shopName"
              type="text"
              value={shopName}
              readOnly
              className="form-input mt-1 bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="gstNumber" className="font-medium text-gray-700">GST Number</label>
            <input
              id="gstNumber"
              type="text"
              value={gstNumber}
              onChange={e => setGstNumberRaw(e.target.value)}
              className="form-input mt-1"
            />
          </div>

          <div>
            <label htmlFor="billMessage" className="font-medium text-gray-700">Custom Bill Message</label>
            <input
              id="billMessage"
              type="text"
              value={billMessage}
              onChange={e => setBillMessage(e.target.value)}
              className="form-input mt-1"
            />
          </div>

          <div>
            <label htmlFor="defaultGst" className="font-medium text-gray-700">Default GST Percentage (%)</label>
            <input
              id="defaultGst"
              type="number"
              value={defaultGst}
              onChange={e => setDefaultGst(e.target.value)}
              className="form-input mt-1"
            />
          </div>

          <div className="pt-2">
            <button onClick={handleSave} className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 flex items-center gap-2">
              <Save size={18} /> Save Settings
            </button>
          </div>
        </div>
      </div>

      {/* Product Measurement Units Settings */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Boxes className="text-blue-600" size={22} />
            <h2 className="text-lg font-bold text-gray-800">Product Measurement Units</h2>
          </div>
          <span className="text-xs bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full border border-blue-200">
            {allUnits.length} Total Units ({customUnits.length} Custom)
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Add custom units (e.g., coils, pairs, sets, ft, yards). Custom units will automatically appear in the unit dropdown when creating or adding multiple products.
        </p>

        {/* Add Custom Unit Form */}
        <div className="flex flex-wrap items-center gap-2 mb-6 max-w-md">
          <input
            type="text"
            placeholder="Enter custom unit name..."
            value={newUnitInput}
            onChange={(e) => setNewUnitInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomUnit();
              }
            }}
            className="form-input flex-1 text-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAddCustomUnit}
            className="px-4 py-2 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={16} /> Add Unit
          </button>
        </div>

        {/* Custom Units List */}
        <div className="mb-5">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Tag size={14} className="text-blue-500" /> Custom Units ({customUnits.length})
          </h3>
          {customUnits.length === 0 ? (
            <div className="p-3.5 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400">
              No custom units added yet. Standard system units are active.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {customUnits.map((u) => (
                <span
                  key={u}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold shadow-xs transition-all hover:bg-blue-100"
                >
                  {u}
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomUnit(u)}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-blue-600 hover:text-white hover:bg-red-500 transition-colors"
                    title={`Delete ${u}`}
                  >
                    <X size={11} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Standard Units Collapsible */}
        <div className="pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowDefaultUnits(!showDefaultUnits)}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
          >
            {showDefaultUnits ? '▲ Hide standard units' : '▼ View standard units (20 default)'}
          </button>
          {showDefaultUnits && (
            <div className="mt-2.5 flex flex-wrap gap-1.5 p-3.5 bg-gray-50/80 rounded-lg border border-gray-200">
              {defaultUnits.map((u) => (
                <span
                  key={u}
                  className="px-2.5 py-1 rounded-md bg-white border border-gray-200 text-gray-700 text-xs font-medium shadow-2xs"
                >
                  {u}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attendance Location Settings */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-blue-100">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="text-blue-600" size={22} />
          <h2 className="text-lg font-bold text-gray-700">Attendance Location (Geofence)</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Set the default office location for staff attendance. Staff must be within this radius to mark attendance from the mobile app.
        </p>

        {locationLoading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 size={18} className="animate-spin" /> Loading location settings...
          </div>
        ) : (
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="font-medium text-gray-700">Location Name</label>
              <input
                type="text"
                value={locationName}
                onChange={e => setLocationName(e.target.value)}
                placeholder="e.g. Main Office"
                className="form-input mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-medium text-gray-700">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={e => setLatitude(e.target.value)}
                  placeholder="e.g. 12.9716"
                  className="form-input mt-1"
                />
              </div>
              <div>
                <label className="font-medium text-gray-700">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={e => setLongitude(e.target.value)}
                  placeholder="e.g. 77.5946"
                  className="form-input mt-1"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-gray-700">Radius (meters)</label>
              <input
                type="number"
                value={radiusMeters}
                onChange={e => setRadiusMeters(e.target.value)}
                placeholder="500"
                className="form-input mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">Default: 500 meters. Staff must be within this distance to mark attendance.</p>
            </div>

            <div>
              <label className="font-medium text-gray-700">Late Punch-In Cutoff Time (Half Day)</label>
              <input
                type="time"
                value={halfDayCutoffTime}
                onChange={e => setHalfDayCutoffTime(e.target.value)}
                className="form-input mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">If a staff member punches in after this time, they will automatically be marked as Half Day instead of Present.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleGetMyLocation}
                disabled={fetchingLocation}
                className="px-5 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50"
              >
                {fetchingLocation ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Navigation size={16} />
                )}
                {fetchingLocation ? 'Fetching...' : 'Get Current Location'}
              </button>

              <button
                onClick={handleSaveLocation}
                disabled={locationSaving}
                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {locationSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {locationSaving ? 'Saving...' : 'Save Location'}
              </button>
            </div>

            {latitude && longitude && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm">
                <span className="font-medium text-blue-700">Current Setting:</span>{' '}
                <span className="text-blue-600">
                  {locationName || 'Unnamed'} — {latitude}, {longitude} (Radius: {radiusMeters}m)
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attendance Mobile App APK Distribution */}
      <AttendanceAppDownloadCard />

      {/* Danger Zone - Clear All Cached Data */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-red-200">
        <h2 className="text-lg font-bold text-red-600 mb-2">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          Clearing cached data will remove all locally stored data (IndexedDB, localStorage, sessionStorage).
          The app will re-fetch everything fresh from the database after reload.
        </p>
        <button
          onClick={handleClearCache}
          disabled={clearing}
          className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {clearing ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Clearing...
            </>
          ) : (
            <>
              <Trash2 size={18} /> Clear All Cached Data
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Settings;
