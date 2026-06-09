import { inventoryApi } from '../api/inventoryApi';
import { pickupQueueApi } from '../api/pickupQueueApi';
import { getOperationalSession, type OperationalSession } from '../operationalSession';
import { calculateBackoff, shouldRetry } from './retryStrategy';
import { analyzeConflict, shouldAutoResolve } from './conflictResolver';
import { enforceStorageLimits } from './storageManager';

export type OfflineOperationType = 'UBICAR' | 'UBICAR_MULTI' | 'RETIRAR' | 'RETIRAR_DE_UBICACION' | 'MOVER' | 'AVISAR_CARRETILLERO' | 'COMPLETAR_RECOGIDA' | 'SOLICITAR_TRASLADO';

type OfflinePayloadByType = {
  UBICAR: Record<string, unknown>;
  UBICAR_MULTI: Record<string, unknown>;
  RETIRAR: Record<string, unknown>;
  RETIRAR_DE_UBICACION: Record<string, unknown>;
  MOVER: Record<string, unknown>;
  AVISAR_CARRETILLERO: Record<string, unknown>;
  COMPLETAR_RECOGIDA: Record<string, unknown>;
  SOLICITAR_TRASLADO: Record<string, unknown>;
};

export interface OfflineQueueEntry<T extends OfflineOperationType = OfflineOperationType> {
  id: string;
  type: T;
  payload: OfflinePayloadByType[T];
  session?: OperationalSession;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'syncing' | 'retryable' | 'conflict';
  lastAttemptAt?: string;
  syncedAt?: string;
  errorCode?: string;
  errorKind?: 'transient' | 'conflict';
  error?: string;
}

export interface OfflineQueueState {
  pendingCount: number;
  conflictCount: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  completedPresenceIds?: string[]; // Dedup: track completed presenceIds to avoid duplicates on retry
}

const QUEUE_KEY = 'wms-offline-queue-v1';
const STATE_KEY = 'wms-offline-state-v1';
const EVENT_NAME = 'wms-offline-queue-changed';

let syncing = false;

const hasBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

const defaultState = (): OfflineQueueState => ({
  pendingCount: 0,
  conflictCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  lastError: null,
});

const loadQueue = (): OfflineQueueEntry[] => {
  if (!hasBrowser()) return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) as OfflineQueueEntry[] : [];
  } catch {
    return [];
  }
};

const saveQueue = (queue: OfflineQueueEntry[]) => {
  if (!hasBrowser()) return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

const loadState = (): OfflineQueueState => {
  if (!hasBrowser()) return defaultState();
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? { ...defaultState(), ...JSON.parse(raw) as OfflineQueueState } : defaultState();
  } catch {
    return defaultState();
  }
};

const saveState = (state: OfflineQueueState) => {
  if (!hasBrowser()) return;
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
};

const emitState = () => {
  if (!hasBrowser()) return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: getOfflineQueueState() }));
};

const emitStorageChange = () => {
  if (!hasBrowser()) return;
  window.dispatchEvent(new StorageEvent('storage', { key: QUEUE_KEY }));
};

const persist = (queue: OfflineQueueEntry[], partial?: Partial<OfflineQueueState>) => {
  const pendingCount = queue.filter((entry) => entry.status === 'pending').length;
  const syncingCount = queue.filter((entry) => entry.status === 'syncing').length;
  const conflictCount = queue.filter((entry) => entry.status === 'conflict').length;
  const nextState: OfflineQueueState = {
    ...loadState(),
    ...partial,
    pendingCount,
    conflictCount,
    // isSyncing should be true if there are any syncing entries OR global syncing flag
    isSyncing: syncingCount > 0 || syncing,
  };
  saveQueue(queue);
  saveState(nextState);
  emitState();
  emitStorageChange();
};

const getErrorCode = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  const match = message.match(/^([a-z-]+):/i);
  return match?.[1]?.toLowerCase() || 'unknown';
};

const getErrorKind = (error: unknown): 'transient' | 'conflict' => {
  const code = getErrorCode(error);
  if (['unavailable', 'internal', 'deadline-exceeded', 'cancelled', 'resource-exhausted', 'aborted', 'unknown'].includes(code)) {
    return 'transient';
  }
  return 'conflict';
};

const buildEntryLabel = (entry: OfflineQueueEntry) => {
  const payload = entry.payload || {};
  const shelfCode = String(payload.shelfCode || payload.cartCode || '').trim();
  const articleCode = String(payload.articleCode || '').trim();
  const orderFab = String(payload.orderFab || '').trim();
  const position = String(payload.position || '').trim();

  switch (entry.type) {
    case 'UBICAR':
      return `Ubicar ${articleCode} ${orderFab} en ${shelfCode}-${position}`.trim();
    case 'RETIRAR':
      return `Retirar ${articleCode} ${orderFab} de ${shelfCode}`.trim();
    case 'RETIRAR_DE_UBICACION':
      return `Retirar ${articleCode} ${orderFab} de ${shelfCode}-${position}`.trim();
    case 'MOVER':
      return `Mover ${articleCode} ${orderFab} en ${shelfCode}`.trim();
    case 'AVISAR_CARRETILLERO':
      return `Avisar carretillero en ${String(payload.shelfName || shelfCode).trim()}`.trim();
    case 'SOLICITAR_TRASLADO':
      return `Solicitar traslado de ${String(payload.articleCode || '').trim()}`.trim();
    case 'COMPLETAR_RECOGIDA':
      return `Completar recogida ${String(payload.requestId || '').trim()}`.trim();
    default:
      return entry.type;
  }
};

const processEntry = async (entry: OfflineQueueEntry) => {
  const session = entry.session || getOperationalSession();
  switch (entry.type) {
    case 'UBICAR':
      return inventoryApi.ubicar(entry.payload, session);
    case 'RETIRAR':
      return inventoryApi.retirar(entry.payload, session);
    case 'RETIRAR_DE_UBICACION':
      return inventoryApi.retirarDeUbicacion(entry.payload, session);
    case 'MOVER':
      return inventoryApi.mover(entry.payload, session);
    case 'AVISAR_CARRETILLERO':
    case 'SOLICITAR_TRASLADO':
      return pickupQueueApi.create(entry.payload, session);
    case 'COMPLETAR_RECOGIDA':
      return pickupQueueApi.complete(entry.payload, session);
    default:
      throw new Error('Operacion offline desconocida');
  }
};

export const getOfflineQueueState = () => {
  const queue = loadQueue();
  return {
    ...loadState(),
    pendingCount: queue.filter((entry) => entry.status === 'pending').length,
    conflictCount: queue.filter((entry) => entry.status === 'conflict').length,
  };
};

export const getOfflineQueueEntries = () => loadQueue().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

export const getOfflineEntryLabel = (entry: OfflineQueueEntry) => buildEntryLabel(entry);

export const subscribeOfflineQueueState = (listener: (state: OfflineQueueState) => void) => {
  if (!hasBrowser()) return () => undefined;
  const handler = (event: Event) => listener((event as CustomEvent<OfflineQueueState>).detail || getOfflineQueueState());
  const storageHandler = () => listener(getOfflineQueueState());
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', storageHandler);
  listener(getOfflineQueueState());
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', storageHandler);
  };
};

export const subscribeOfflineQueueEntries = (listener: (entries: OfflineQueueEntry[]) => void) => {
  if (!hasBrowser()) return () => undefined;
  const handler = () => listener(getOfflineQueueEntries());
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', handler);
  listener(getOfflineQueueEntries());
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
};

export const enqueueOfflineOperation = <T extends OfflineOperationType>(type: T, payload: OfflinePayloadByType[T], session?: OperationalSession) => {
  const queue = loadQueue();
  queue.push({
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    session,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
  });
  persist(queue, { lastError: null });
};

const updateEntry = (entryId: string, updater: (entry: OfflineQueueEntry) => OfflineQueueEntry | null) => {
  const queue = loadQueue();
  const nextQueue = queue.flatMap((entry) => {
    if (entry.id !== entryId) return [entry];
    const updated = updater(entry);
    return updated ? [updated] : [];
  });
  persist(nextQueue);
  return nextQueue;
};

export const retryOfflineEntry = async (entryId: string) => {
  updateEntry(entryId, (entry) => ({ ...entry, status: 'pending', error: undefined, errorCode: undefined, errorKind: undefined }));
  await drainOfflineQueue();
};

export const replayOfflineEntry = async (entryId: string) => {
  updateEntry(entryId, (entry) => ({ ...entry, status: 'pending', attempts: 0, error: undefined, errorCode: undefined, errorKind: undefined }));
  await drainOfflineQueue();
};

export const discardOfflineEntry = (entryId: string) => {
  updateEntry(entryId, () => null);
};

export const clearResolvedOfflineErrors = () => {
  const queue = loadQueue().filter((entry) => entry.status !== 'retryable' && entry.status !== 'conflict');
  persist(queue, { lastError: null });
};

export const drainOfflineQueue = async () => {
  if (!hasBrowser() || syncing || !navigator.onLine) return;
  syncing = true;
  persist(loadQueue(), { isSyncing: true, lastError: null });

  try {
    let queue = loadQueue();
    enforceStorageLimits();

    for (const entry of [...queue]) {
      if (entry.status !== 'pending' && entry.status !== 'retryable') continue;

      // Si es retryable, esperar backoff exponencial
      if (entry.status === 'retryable') {
        const delayMs = calculateBackoff(entry.attempts);
        if (delayMs > 0) {
          console.log(`[offlineQueue] Waiting ${delayMs}ms before retry attempt ${entry.attempts + 1} for ${entry.id}`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      // Máximo 5 intentos
      if (entry.attempts >= 5) {
        console.warn(`[offlineQueue] Entry ${entry.id} exceeded max retry attempts (5)`);
        queue = queue.map((item) => item.id === entry.id ? {
          ...item,
          status: 'conflict',
          error: 'Excedió número máximo de reintentos (5). Revisa manualmente.',
        } : item);
        persist(queue, { isSyncing: true });
        continue;
      }

      try {
        await processEntry(entry);
        queue = queue.filter((item) => item.id !== entry.id);
        persist(queue, {
          isSyncing: true,
          lastSyncAt: new Date().toISOString(),
          lastError: null,
        });
        console.log(`[offlineQueue] Entry ${entry.id} synced successfully`);
      } catch (error: any) {
        const errorCode = getErrorCode(error);
        const errorKind = getErrorKind(error);
        const now = new Date().toISOString();

        // Intentar resolución automática si es conflict
        if (errorKind === 'conflict') {
          try {
            const analysis = await analyzeConflict(entry);
            if (shouldAutoResolve(analysis)) {
              console.log(`[offlineQueue] Auto-resolved conflict for ${entry.id}: ${analysis.reason}`);
              queue = queue.filter((item) => item.id !== entry.id);
              persist(queue, {
                isSyncing: true,
                lastSyncAt: new Date().toISOString(),
                lastError: null,
              });
              continue;
            }
          } catch (analysisError) {
            console.error('[offlineQueue] Error analyzing conflict', analysisError);
          }
        }

        const canRetry = shouldRetry(entry.attempts, errorKind);
        queue = queue.map((item) => item.id === entry.id ? {
          ...item,
          attempts: item.attempts + 1,
          status: canRetry ? 'retryable' : 'conflict',
          lastAttemptAt: now,
          errorCode,
          errorKind,
          error: error?.message || 'Error sincronizando operacion offline',
        } : item);
        persist(queue, {
          isSyncing: true,
          lastError: error?.message || 'Error sincronizando operacion offline',
        });

        if (canRetry) {
          console.log(`[offlineQueue] Entry ${entry.id} marked for retry (attempt ${entry.attempts + 1}/5)`);
        } else {
          console.warn(`[offlineQueue] Entry ${entry.id} marked as conflict (errorKind: ${errorKind})`);
        }
      }
    }
  } finally {
    syncing = false;
    persist(loadQueue(), { isSyncing: false });
  }
};


