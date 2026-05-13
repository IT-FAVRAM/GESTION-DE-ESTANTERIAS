/**
 * OfflineIndicator — Banner de estado de conexión
 * Gestor de Estanterías WMS v3.0
 */

import React from 'react';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import OfflineQueuePanel from './OfflineQueuePanel';

const OfflineIndicator: React.FC = () => {
  const [panelOpen, setPanelOpen] = React.useState(false);
  const { isOffline, wasOffline, pendingCount, conflictCount, retryableCount, isSyncing, lastSyncError, lastSyncAt, entries, syncNow } = useOfflineStatus();

  if (!isOffline && !wasOffline && pendingCount === 0 && conflictCount === 0 && retryableCount === 0 && !isSyncing) return null;

  const baseClass = 'fixed top-0 left-0 right-0 z-[100] px-4 py-2 transition-all duration-300';
  const message = isOffline
    ? `⚠️ Sin conexión — ${pendingCount > 0 ? `${pendingCount} cambio(s) en cola local` : 'Los cambios nuevos se guardarán en cola local'}`
    : conflictCount > 0
      ? `⚠️ ${conflictCount} conflicto(s) pendientes de revisión${lastSyncError ? ` — ${lastSyncError}` : ''}`
      : retryableCount > 0
        ? `⚠️ ${retryableCount} cambio(s) listos para reintento${lastSyncError ? ` — ${lastSyncError}` : ''}`
      : isSyncing || pendingCount > 0
        ? `✅ Conexión recuperada — sincronizando ${pendingCount} cambio(s)`
        : '✅ Conexión recuperada — datos sincronizados';

  const toneClass = isOffline
    ? 'bg-amber-500 text-white'
    : conflictCount > 0
      ? 'bg-rose-600 text-white'
      : 'bg-emerald-500 text-white animate-fade-out-delayed';

  return (
    <>
      <div className={`${baseClass} ${toneClass}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 text-sm font-bold">
          <span>{message}</span>
          <button onClick={() => setPanelOpen(true)} className="rounded-full border border-white/20 bg-black/15 px-3 py-1 text-xs font-black text-white hover:bg-black/25">Ver cola</button>
        </div>
      </div>
      <OfflineQueuePanel open={panelOpen} entries={entries} isSyncing={isSyncing} lastSyncAt={lastSyncAt} lastSyncError={lastSyncError} onClose={() => setPanelOpen(false)} onSyncNow={() => void syncNow()} />
    </>
  );
};

export default OfflineIndicator;
