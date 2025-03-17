// src/hooks/useCachedData.ts

import { useState, useCallback } from 'react';

interface CacheData<T> {
  [key: string]: {
    data: T;
    timestamp: number;
  };
}

export function useCachedData<T>(timeToLive = 5 * 60 * 1000) { // Default 5 minutes TTL
  const [cache, setCache] = useState<CacheData<T>>({});

  const isCacheValid = useCallback((key: string) => {
    const cacheEntry = cache[key];
    if (!cacheEntry) return false;
    
    const now = Date.now();
    return now - cacheEntry.timestamp < timeToLive;
  }, [cache, timeToLive]);

  const getData = useCallback(async (key: string, fetchFn: () => Promise<T>) => {
    // Return cached data if available and valid
    if (isCacheValid(key)) {
      return cache[key].data;
    }

    // Fetch new data if not in cache or cache is stale
    const data = await fetchFn();
    setCache(prev => ({
      ...prev,
      [key]: {
        data,
        timestamp: Date.now()
      }
    }));
    return data;
  }, [cache, isCacheValid]);

  const invalidateCache = useCallback((key?: string) => {
    if (key) {
      setCache(prev => {
        const newCache = { ...prev };
        delete newCache[key];
        return newCache;
      });
    } else {
      setCache({});
    }
  }, []);

  return { getData, invalidateCache };
}