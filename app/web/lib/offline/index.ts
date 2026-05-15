// Offline queue and state management
// Handles optimistic updates and retry logic when device reconnects

export { offlineQueue } from './offlineQueue';
export { offlineManager } from './offlineManager';
export type { OfflineQueueEntry, OfflineQueueState, OfflineOperationType } from './offlineQueue';

// Retry strategy
export { calculateBackoff, shouldRetry, formatBackoffTime, type RetryConfig } from './retryStrategy';

// Conflict resolution
export { analyzeConflict, shouldAutoResolve, type ConflictAnalysis, type ConflictResolution } from './conflictResolver';

// Storage management
export {
  getStorageStats,
  enforceStorageLimits,
  clearOldCacheEntries,
  getCacheInfo,
  type StorageStats,
} from './storageManager';

// Bidirectional sync
export {
  startBidirectionalSync,
  stopBidirectionalSync,
  getActiveSyncListeners,
  listenForCacheUpdates,
  type SyncListener,
} from './bidirectionalSync';

// Cache audit
export { generateCacheAuditReport, printCacheAuditReport, type CacheAuditReport } from './cacheAudit';
