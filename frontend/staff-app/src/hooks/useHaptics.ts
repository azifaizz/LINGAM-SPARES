import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const isNative = () => !!(window as any).Capacitor;

export function useHaptics() {
  return {
    vibrateLight: async () => {
      try { if (isNative()) await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    },
    vibrateMedium: async () => {
      try { if (isNative()) await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    },
    vibrateHeavy: async () => {
      try { if (isNative()) await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    },
    success: async () => {
      try { if (isNative()) await Haptics.notification({ type: NotificationType.Success }); } catch {}
    },
    error: async () => {
      try { if (isNative()) await Haptics.notification({ type: NotificationType.Error }); } catch {}
    },
  };
}
