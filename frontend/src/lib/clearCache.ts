import { clearIndexedDbPersistence } from 'firebase/firestore';
import { db } from './firebase';
import { clearMemoryCache } from '@/hooks/useCachedResource';

const CACHE_KEY_PREFIX = 'LINGAM_SPARES_V1_';

export const clearAllCaches = async (): Promise<void> => {
    // 1. Clear in-memory cache
    clearMemoryCache();

    // 2. Clear localStorage (RAJU_CACHE_V2_* keys + Supabase keys)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(CACHE_KEY_PREFIX) || key.startsWith('RAJU_') || key.startsWith('sb-') || key.startsWith('supabase.'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // 3. Clear sessionStorage (user role cache etc.)
    sessionStorage.clear();

    // 4. Clear Firebase Firestore IndexedDB persistence
    try {
        await clearIndexedDbPersistence(db);
    } catch (e) {
        console.warn('[clearCache] Firestore IndexedDB clear skipped:', e);
    }

    // 5. Delete the Firestore IndexedDB database directly
    try {
        await new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase('firebase-firestore-database');
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
        });
    } catch (e) {
        console.warn('[clearCache] Direct IndexedDB delete skipped:', e);
    }
};
