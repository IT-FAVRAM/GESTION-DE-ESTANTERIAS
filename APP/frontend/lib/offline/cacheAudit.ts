/**
 * cacheAudit.ts — Auditoría y diagnóstico de caché offline
 * Gestor de Estanterías WMS v3.0
 */

import { getStorageStats, getCacheInfo } from './storageManager';
import { getOfflineQueueState } from './offlineQueue';

export interface CacheAuditReport {
  timestamp: string;
  storage: ReturnType<typeof getStorageStats>;
  queue: ReturnType<typeof getOfflineQueueState>;
  caches: {
    items: ReturnType<typeof getCacheInfo>;
    shelves: ReturnType<typeof getCacheInfo>;
    config: ReturnType<typeof getCacheInfo>;
    locations: ReturnType<typeof getCacheInfo>;
  };
  recommendations: string[];
  health: 'good' | 'warning' | 'critical';
}

export const generateCacheAuditReport = (): CacheAuditReport => {
  const recommendations: string[] = [];
  let health: 'good' | 'warning' | 'critical' = 'good';

  const storage = getStorageStats();
  const queue = getOfflineQueueState();

  const caches = {
    items: getCacheInfo('wms-items-cache'),
    shelves: getCacheInfo('wms-shelves-cache'),
    config: getCacheInfo('wms-config-cache'),
    locations: getCacheInfo('wms-locations-cache'),
  };

  if (storage.totalSizeMB > 4.5) {
    health = 'critical';
    recommendations.push('Storage nearly full (>4.5MB), clear old caches');
  } else if (storage.totalSizeMB > 3) {
    health = 'warning';
    recommendations.push('Storage usage high (>3MB), consider cleanup');
  }

  if (queue.conflictCount > 0) {
    health = health === 'good' ? 'warning' : health;
    recommendations.push(`${queue.conflictCount} conflicts pending manual review`);
  }

  if (queue.pendingCount > 20) {
    health = health === 'good' ? 'warning' : health;
    recommendations.push(`Large pending queue (${queue.pendingCount} items), may take time to sync`);
  }

  if (caches.items.age && caches.items.age > 7) {
    recommendations.push(`Items cache is ${caches.items.age.toFixed(1)} days old, refresh if available`);
  }

  if (caches.shelves.age && caches.shelves.age > 7) {
    recommendations.push(`Shelves cache is ${caches.shelves.age.toFixed(1)} days old, refresh if available`);
  }

  if (
    !caches.items.exists ||
    !caches.shelves.exists ||
    !caches.config.exists
  ) {
    health = health === 'good' ? 'warning' : health;
    recommendations.push('Critical caches missing, limited offline functionality');
  }

  if (recommendations.length === 0) {
    recommendations.push('Storage and cache are in good condition');
  }

  return {
    timestamp: new Date().toISOString(),
    storage,
    queue,
    caches,
    recommendations,
    health,
  };
};

export const printCacheAuditReport = (report: CacheAuditReport): void => {
  console.group('📊 WMS Cache Audit Report');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Health: ${report.health.toUpperCase()}`);

  console.group('Storage');
  console.log(`Total size: ${report.storage.totalSizeMB.toFixed(2)}MB`);
  console.log(`Cache items: ${report.storage.cacheItems}`);
  console.log(`Queue items: ${report.storage.queueItems}`);
  console.table(report.storage.entriesByAge);
  console.groupEnd();

  console.group('Offline Queue');
  console.log(`Pending: ${report.queue.pendingCount}`);
  console.log(`Retryable: ${report.queue.conflictCount}`);
  console.log(`Syncing: ${report.queue.isSyncing ? 'Yes' : 'No'}`);
  console.log(`Last sync: ${report.queue.lastSyncAt || 'Never'}`);
  console.groupEnd();

  console.group('Caches');
  Object.entries(report.caches).forEach(([name, info]) => {
    console.log(
      `${name}: ${info.exists ? '' : ''} (${info.size} bytes, age: ${info.age ? info.age.toFixed(1) + 'd' : 'unknown'})`
    );
  });
  console.groupEnd();

  console.group('Recommendations');
  report.recommendations.forEach(rec => console.log(rec));
  console.groupEnd();

  console.groupEnd();
};


