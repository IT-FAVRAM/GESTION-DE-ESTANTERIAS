/**
 * OfflineIndicator — Banner de estado de conexión
 * Gestor de Estanterías WMS v3.0
 */

import React from 'react';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import OfflineQueuePanel from './OfflineQueuePanel';

const OfflineIndicator: React.FC = () => {
  const [panelOpen, setPanelOpen] = React.useState(false);
  const {
    isOffline,
    wasOffline,
    pendingCount,
    conflictCount,
    retryableCount,
    isSyncing,
    lastSyncError,
    lastSyncAt,
    entries,
    syncNow,
  } = useOfflineStatus();

  if (
    !isOffline &&
    !wasOffline &&
    pendingCount === 0 &&
    conflictCount === 0 &&
    retryableCount === 0 &&
    !isSyncing
  )
    return null;

  const baseClass =
    'fixed top-0 left-0 right-0 z-[100] px-4 py-2 transition-all duration-300';

  let message: string;
  let toneClass: string;

  if (isOffline) {
    message = `⚠️ Sin conexión — ${
      pendingCount > 0
        ? `${pendingCount} cambio(s) en cola local`
        : 'Los cambios se guardarán en cola local'
    }`;
    toneClass = 'bg-amber-500 text-white';
  } else if (conflictCount > 0) {
    message = `🔴 ${conflictCount} conflicto(s) pendiente${conflictCount > 1 ? 's' : ''} — revisar manualmente`;
    toneClass = 'bg-rose-600 text-white';
  } else if (retryableCount > 0) {
    message = `⚠️ ${retryableCount} cambio(s) listos para reintento${
      lastSyncError ? ` — ${lastSyncError}` : ''
    }`;
    toneClass = 'bg-amber-500 text-white';
  } else if (isSyncing || pendingCount > 0) {
    message = `🔄 Sincronizando ${pendingCount} cambio(s)...`;
    toneClass = 'bg-blue-600 text-white';
  } else {
    message = '✅ Conexión recuperada — datos sincronizados';
    toneClass = 'bg-emerald-500 text-white animate-fade-out-delayed';
  }

  return (
    <>
      <div className={`${baseClass} ${toneClass}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 text-sm font-bold">
          <div className="flex-1">
            <span>{message}</span>
            {lastSyncAt && !isOffline && (
              <p className="text-xs opacity-75 mt-1">
                Última sincronización: {new Date(lastSyncAt).toLocaleTimeString('es-ES')}
              </p>
            )}
          </div>
          <button
            onClick={() => setPanelOpen(true)}
            className="rounded-full border border-white/20 bg-black/15 px-4 py-2 text-xs font-black text-white hover:bg-black/25 whitespace-nowrap"
          >
            Ver centro offline
          </button>
        </div>
      </div>
      <OfflineQueuePanel
        open={panelOpen}
        entries={entries}
        isSyncing={isSyncing}
        lastSyncAt={lastSyncAt}
        lastSyncError={lastSyncError}
        onClose={() => setPanelOpen(false)}
        onSyncNow={() => void syncNow()}
      />
    </>
  );
};

export default OfflineIndicator;


