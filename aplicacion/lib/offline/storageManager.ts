/**
 * storageManager.ts — Gestión de almacenamiento offline
 * Gestor de Estanterías WMS v3.0
 *
 * Enforza límites de storage, limpia datos obsoletos y previene overflow.
 */

const MAX_QUEUE_SIZE = 100;
const MAX_CACHE_AGE_DAYS = 7;
const MAX_CACHE_SIZE_MB = 5;

export interface StorageStats {
  totalItems: number;
  totalSizeBytes: number;
  totalSizeMB: number;
  cacheItems: number;
  queueItems: number;
  entriesByAge: {
    lessThan1Day: number;
    lessThan3Days: number;
    lessThan7Days: number;
    olderThan7Days: number;
  };
}

const calculateStorageSize = (): number => {
  let total = 0;
  if (typeof localStorage === 'undefined') return 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('wms-')) {
        const value = localStorage.getItem(key) || '';
        total += key.length + value.length;
      }
    }
  } catch (e) {
    console.error('[storageManager] Error calculating size', e);
  }

  return total;
};

const getCacheAge = (key: string): number | null => {
  try {
    const timestampKey = `${key}-timestamp`;
    const timestamp = localStorage.getItem(timestampKey);
    if (!timestamp) return null;

    const date = new Date(timestamp);
    const ageMs = Date.now() - date.getTime();
    return ageMs / (1000 * 60 * 60 * 24);
  } catch {
    return null;
  }
};

export const getStorageStats = (): StorageStats => {
  const totalSizeBytes = calculateStorageSize();
  const totalSizeMB = totalSizeBytes / (1024 * 1024);

  let cacheItems = 0;
  let queueItems = 0;
  const entriesByAge = {
    lessThan1Day: 0,
    lessThan3Days: 0,
    lessThan7Days: 0,
    olderThan7Days: 0,
  };

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith('wms-offline-queue')) {
        queueItems++;
      } else if (key.endsWith('-cache') && !key.endsWith('-timestamp')) {
        cacheItems++;
        const age = getCacheAge(key);
        if (age !== null) {
          if (age < 1) entriesByAge.lessThan1Day++;
          else if (age < 3) entriesByAge.lessThan3Days++;
          else if (age < 7) entriesByAge.lessThan7Days++;
          else entriesByAge.olderThan7Days++;
        }
      }
    }
  } catch (e) {
    console.error('[storageManager] Error getting stats', e);
  }

  return {
    totalItems: cacheItems + queueItems,
    totalSizeBytes,
    totalSizeMB,
    cacheItems,
    queueItems,
    entriesByAge,
  };
};

export const enforceStorageLimits = (): { cleaned: boolean; reason?: string } => {
  try {
    const stats = getStorageStats();

    if (stats.totalSizeMB > MAX_CACHE_SIZE_MB) {
      console.warn(`[storageManager] Cache size ${stats.totalSizeMB.toFixed(2)}MB exceeds limit`);

      const cacheKeys = [
        'wms-items-cache',
        'wms-shelves-cache',
        'wms-config-cache',
        'wms-locations-cache',
      ];

      for (const key of cacheKeys) {
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}-timestamp`);
      }

      return {
        cleaned: true,
        reason: `Cache cleared: size was ${stats.totalSizeMB.toFixed(2)}MB`,
      };
    }

    if (stats.entriesByAge.olderThan7Days > 0) {
      console.warn(`[storageManager] Found ${stats.entriesByAge.olderThan7Days} entries older than 7 days`);

      const oldCacheKeys = [
        'wms-items-cache',
        'wms-shelves-cache',
        'wms-config-cache',
      ];

      for (const key of oldCacheKeys) {
        const age = getCacheAge(key);
        if (age !== null && age > MAX_CACHE_AGE_DAYS) {
          localStorage.removeItem(key);
          localStorage.removeItem(`${key}-timestamp`);
        }
      }

      return {
        cleaned: true,
        reason: 'Removed cache entries older than 7 days',
      };
    }

    return { cleaned: false };
  } catch (e) {
    console.error('[storageManager] Enforcement error', e);
    return { cleaned: false, reason: 'Error during enforcement' };
  }
};

export const clearOldCacheEntries = (ageInDays: number = 7): number => {
  let cleared = 0;
  const cacheKeys = ['wms-items-cache', 'wms-shelves-cache', 'wms-config-cache', 'wms-locations-cache'];

  for (const key of cacheKeys) {
    const age = getCacheAge(key);
    if (age !== null && age > ageInDays) {
      try {
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}-timestamp`);
        cleared++;
      } catch (e) {
        console.error(`[storageManager] Error clearing ${key}`, e);
      }
    }
  }

  return cleared;
};

export const getCacheInfo = (key: string): { size: number; age: number | null; exists: boolean } => {
  try {
    const value = localStorage.getItem(key);
    const exists = value !== null;
    const size = exists ? (key.length + value!.length) : 0;
    const age = getCacheAge(key);

    return { size, age, exists };
  } catch {
    return { size: 0, age: null, exists: false };
  }
};


