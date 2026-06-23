/**
 * useOfflineStatus — Detección de estado de conexión
 * Gestor de Estanterías WMS v3.0
 */

import { useEffect, useState } from 'react';
import {
  drainOfflineQueue,
  getOfflineQueueEntries,
  getOfflineQueueState,
  subscribeOfflineQueueEntries,
  subscribeOfflineQueueState,
  type OfflineQueueEntry,
  type OfflineQueueState,
} from '../lib/offline/offlineQueue';

export const useOfflineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(
    navigator.onLine ? new Date() : null
  );
  const [queueState, setQueueState] = useState<OfflineQueueState>(getOfflineQueueState());
  const [entries, setEntries] = useState<OfflineQueueEntry[]>(getOfflineQueueEntries());

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date());
      if (!navigator.onLine) return;
      // Mostrar notificación de recuperación hasta que la sincronización esté completa
      setWasOffline(true);
      void drainOfflineQueue().then(() => {
        // Mantener visible por 3 segundos después de que la sincronización termine
        setTimeout(() => setWasOffline(false), 3000);
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => subscribeOfflineQueueState(setQueueState), []);
  useEffect(() => subscribeOfflineQueueEntries(setEntries), []);

  useEffect(() => {
    if (navigator.onLine) {
      void drainOfflineQueue();
    }
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
    lastOnlineAt,
    pendingCount: queueState.pendingCount,
    conflictCount: queueState.conflictCount,
    retryableCount: entries.filter((entry) => entry.status === 'retryable').length,
    isSyncing: queueState.isSyncing,
    lastSyncAt: queueState.lastSyncAt,
    lastSyncError: queueState.lastError,
    entries,
    syncNow: () => drainOfflineQueue(),
  };
};


