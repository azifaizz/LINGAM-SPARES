import { Geolocation, PermissionStatus } from '@capacitor/geolocation';
import { registerPlugin } from '@capacitor/core';

export interface GeoPosition {
  latitude: number;
  longitude: number;
}

export type LocationStatus = 'granted' | 'denied' | 'prompt' | 'off' | 'error';

export interface LocationResult {
  status: LocationStatus;
  position?: GeoPosition;
  error?: string;
}

interface NativeLocationHelperPlugin {
  isLocationEnabled(): Promise<{ enabled: boolean }>;
  openLocationSettings(): Promise<void>;
  openAppSettings(): Promise<void>;
  promptEnableLocation(): Promise<{ enabled?: boolean; prompted?: boolean; openedSettings?: boolean }>;
}

const NativeLocationHelper = registerPlugin<NativeLocationHelperPlugin>('NativeLocationHelper');

export const locationService = {
  /**
   * Prompts user via native Google Play Services dialog to turn on GPS,
   * or falls back to opening system location settings.
   */
  async promptEnableLocation(): Promise<void> {
    try {
      await NativeLocationHelper.promptEnableLocation();
    } catch {
      try {
        await NativeLocationHelper.openLocationSettings();
      } catch (e) {
        console.warn('NativeLocationHelper not available', e);
      }
    }
  },

  async openLocationSettings(): Promise<void> {
    try {
      await NativeLocationHelper.openLocationSettings();
    } catch (e) {
      console.warn('Could not open location settings', e);
    }
  },

  async openAppSettings(): Promise<void> {
    try {
      await NativeLocationHelper.openAppSettings();
    } catch (e) {
      console.warn('Could not open app settings', e);
    }
  },

  async isDeviceLocationEnabled(): Promise<boolean> {
    try {
      const res = await NativeLocationHelper.isLocationEnabled();
      return Boolean(res?.enabled);
    } catch {
      return true;
    }
  },

  async getPermissionStatus(): Promise<PermissionStatus> {
    try {
      return await Geolocation.checkPermissions();
    } catch {
      return { location: 'denied', coarseLocation: 'denied' } as PermissionStatus;
    }
  },

  async requestPermission(): Promise<PermissionStatus> {
    try {
      return await Geolocation.requestPermissions();
    } catch {
      return { location: 'denied', coarseLocation: 'denied' } as PermissionStatus;
    }
  },

  /**
   * Robust location reader with:
   * 1. Automatic runtime permission prompt if needed
   * 2. High-accuracy GPS reading (with recent cache hit support)
   * 3. Fallback to balanced / network provider (fast indoors)
   * 4. Fallback to HTML5 browser geolocation API
   * 5. Accurate status detection ('off' vs 'denied' vs 'granted')
   */
  async ensureLocation(): Promise<LocationResult> {
    // 1. Check & Request Permissions
    try {
      const perms = await Geolocation.checkPermissions();
      if (perms.location === 'prompt' || perms.coarseLocation === 'prompt') {
        const req = await Geolocation.requestPermissions();
        if (req.location === 'denied' && req.coarseLocation === 'denied') {
          return { status: 'denied' };
        }
      } else if (perms.location === 'denied' && perms.coarseLocation === 'denied') {
        return { status: 'denied' };
      }
    } catch (permErr: any) {
      const msg = String(permErr?.message || '');
      if (/not enabled|disabled/i.test(msg)) {
        return { status: 'off' };
      }
    }

    // 2. Try High Accuracy (GPS)
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 30000,
      });
      if (position?.coords) {
        return {
          status: 'granted',
          position: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        };
      }
    } catch (err1: any) {
      const msg = String(err1?.message || '');
      if (/not enabled|disabled/i.test(msg)) {
        return { status: 'off' };
      }
      if (/denied|permission/i.test(msg)) {
        return { status: 'denied' };
      }
      console.warn('High accuracy location attempt failed, trying low accuracy fallback...', err1);
    }

    // 3. Fallback to Low / Balanced Accuracy (Network / Cell / Wi-Fi - fast indoors)
    try {
      const position2 = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60000,
      });
      if (position2?.coords) {
        return {
          status: 'granted',
          position: {
            latitude: position2.coords.latitude,
            longitude: position2.coords.longitude,
          },
        };
      }
    } catch (err2: any) {
      const msg = String(err2?.message || '');
      if (/not enabled|disabled/i.test(msg)) {
        return { status: 'off' };
      }
      if (/denied|permission/i.test(msg)) {
        return { status: 'denied' };
      }
      console.warn('Low accuracy fallback failed, checking HTML5 navigator...', err2);
    }

    // 4. Fallback to HTML5 navigator.geolocation (standard WebView API)
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const navPos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 60000,
          });
        });
        if (navPos?.coords) {
          return {
            status: 'granted',
            position: {
              latitude: navPos.coords.latitude,
              longitude: navPos.coords.longitude,
            },
          };
        }
      } catch (err3: any) {
        if (err3?.code === 1) return { status: 'denied' };
        if (err3?.code === 2) return { status: 'off' };
      }
    }

    // Check if device location is physically disabled on the system
    const isEnabled = await this.isDeviceLocationEnabled();
    if (!isEnabled) {
      return { status: 'off' };
    }

    return { status: 'error' };
  },

  async getCurrentPosition(): Promise<GeoPosition | null> {
    const res = await this.ensureLocation();
    return res.position ?? null;
  },
};
