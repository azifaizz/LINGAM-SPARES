import { db, storage } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';

export interface AppReleaseInfo {
  appName: string;
  version: string;
  lastUpdated: string;
  downloadUrl?: string;
  fileName?: string;
  fileSizeBytes?: number;
  releaseNotes?: string;
}

export const DEFAULT_RELEASE: AppReleaseInfo = {
  appName: 'Attendance Mobile App',
  version: '1.0.0',
  lastUpdated: '22 October 2026',
  fileName: 'Lingam_Spares_Attendance_1.0.0.apk',
};

export const appReleaseService = {
  async getLatestRelease(): Promise<AppReleaseInfo> {
    try {
      // 1. Read release document from Firestore: app_releases/attendance
      const snap = await getDoc(doc(db, 'app_releases', 'attendance'));
      if (snap.exists()) {
        const data = snap.data() as AppReleaseInfo;
        if (data && data.downloadUrl) {
          return {
            ...DEFAULT_RELEASE,
            ...data,
          };
        }
      }
    } catch (err) {
      console.warn('Failed to fetch release metadata from Firestore, trying Storage fallback', err);
    }

    // 2. Fallback: Query Firebase Storage directly
    try {
      const storageRef = ref(storage, 'app-releases/attendance/attendance-app-latest.apk');
      const url = await getDownloadURL(storageRef);
      if (url) {
        return {
          ...DEFAULT_RELEASE,
          downloadUrl: url,
        };
      }
    } catch (storageErr) {
      console.warn('Failed to resolve APK URL from Firebase Storage', storageErr);
    }

    return DEFAULT_RELEASE;
  },
};
