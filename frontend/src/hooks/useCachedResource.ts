import { useState, useEffect, useCallback, useRef } from 'react';

interface CacheOptions<T> {
    ttl?: number; // Time to live in milliseconds (default 5 minutes)
    initialData?: T;
    skip?: boolean; // If true, finding/fetching is skipped
}

interface CachedResource<T> {
    data: T | null;
    loading: boolean;
    isSyncing: boolean;
    error: any;
    refresh: () => Promise<void>;
    mutate: (newData: T) => void;
}

// Global cache in memory to avoid parsing JSON repeatedly during same session if needed,
// but for "Instant-First" persistence, we rely primarily on localStorage.
// We can use a memory cache map to speed up component re-mounts in same session.
const memoryCache = new Map<string, { data: any; timestamp: number }>();

export const useCachedResource = <T>(
    key: string,
    fetcher: () => Promise<{ data: T } | T>, // Support axios response or direct data
    options: CacheOptions<T> = {}
): CachedResource<T> => {
    const { ttl = 5 * 60 * 1000, skip = false } = options;
    const CACHE_KEY_PREFIX = 'LINGAM_SPARES_V1_';
    const fullKey = `${CACHE_KEY_PREFIX}${key}`;

    // State
    const [data, setData] = useState<T | null>(options.initialData || null);
    const [loading, setLoading] = useState(true); // Initial load (reading cache)
    const [isSyncing, setIsSyncing] = useState(false); // Background fetch
    const [error, setError] = useState<any>(null);

    // Use ref to track if component is mounted to prevent state updates after unmount
    const isMounted = useRef(true);
    // Ref to hold latest data so fetchData doesn't depend on `data` state (avoids re-render loop)
    const dataRef = useRef<T | null>(options.initialData || null);

    // Helper to safely get data from response
    const extractData = (res: any): T => {
        if (res && typeof res === 'object' && 'data' in res) {
            return res.data;
        }
        return res;
    };

    const loadFromCache = useCallback(() => {
        if (skip) return false;

        // 1. Try Memory Cache first (fastest)
        if (memoryCache.has(fullKey)) {
            const cached = memoryCache.get(fullKey);
            if (cached) {
                dataRef.current = cached.data;
                setData(cached.data);
                return true; // Cache hit
            }
        }

        // 2. Try Local Storage
        try {
            const stored = localStorage.getItem(fullKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                dataRef.current = parsed.data;
                setData(parsed.data);
                memoryCache.set(fullKey, { data: parsed.data, timestamp: parsed.timestamp });
                return true; // Cache hit
            }
        } catch (e) {
            console.warn(`Failed to parse cache for ${key}`, e);
        }
        return false; // Cache miss
    }, [fullKey, skip, key]);

    const fetchData = useCallback(async () => {
        if (skip) return;

        setIsSyncing(true);
        // Use ref to check if data exists (avoids dependency on `data` state which causes re-render loop)
        setLoading(prev => !prev ? true : (!dataRef.current));

        try {
            const response = await fetcher();
            const newData = extractData(response);

            if (isMounted.current) {
                console.log(`[useCachedResource] Fetched ${key}:`, Array.isArray(newData) ? `${newData.length} items` : newData);
            }

            // Save to caches (Always update cache, even if component unmounted)
            const timestamp = Date.now();
            const cachePayload = { data: newData, timestamp };

            memoryCache.set(fullKey, cachePayload);
            try {
                localStorage.setItem(fullKey, JSON.stringify(cachePayload));
            } catch (e) {
                console.error("Cache set failed (quota?)", e);
            }

            if (isMounted.current) {
                dataRef.current = newData;
                setData(newData);
                setError(null);
            }
        } catch (err) {
            if (isMounted.current) {
                console.error(`Fetch failed for ${key}`, err);
                setError(err);
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
                setIsSyncing(false);
            }
        }
    }, [fetcher, fullKey, skip, key]);

    // Initial Sync Logic
    useEffect(() => {
        isMounted.current = true;

        if (!skip) {
            const hasCache = loadFromCache();
            if (hasCache) {
                setLoading(false);
                // Check if cached data is still fresh (within TTL)
                const cached = memoryCache.get(fullKey);
                if (cached && (Date.now() - cached.timestamp) < ttl) {
                    // Cache is fresh — skip fetch entirely
                    return () => { isMounted.current = false; };
                }
            }
            // No cache or stale — fetch from API
            fetchData();
        } else {
            setLoading(false);
        }

        return () => {
            isMounted.current = false;
        };
    }, [fullKey, skip]); // Dependencies: key change -> reload. fetcher stability is caller responsibility.

    // Ref to hold latest fetchData so refresh is stable and doesn't re-create
    const fetchRef = useRef(fetchData);
    fetchRef.current = fetchData;

    // Manual refresh — stable reference, won't cause re-renders in consumers
    const refresh = useCallback(async () => {
        await fetchRef.current();
    }, []);

    // Manual mutation (for optimistic updates) — supports value or function updater
    const mutate = useCallback((updater: T | ((prev: T) => T)) => {
        const newData = typeof updater === "function"
            ? (updater as (prev: T) => T)(dataRef.current)
            : updater;
        dataRef.current = newData;
        if (isMounted.current) {
            setData(newData);
        }
        const timestamp = Date.now();
        const cachePayload = { data: newData, timestamp };
        memoryCache.set(fullKey, cachePayload);
        try {
            localStorage.setItem(fullKey, JSON.stringify(cachePayload));
        } catch (e) {
            console.error("Cache set failed (quota?)", e);
        }
    }, [fullKey]);

    return { data, loading, isSyncing, error, refresh, mutate };
};

export const clearMemoryCache = () => {
    memoryCache.clear();
};
