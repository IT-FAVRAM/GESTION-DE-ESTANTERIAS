import React from 'react';
import {
  clearResolvedOfflineErrors,
  discardOfflineEntry,
  getOfflineEntryLabel,
  replayOfflineEntry,
  retryOfflineEntry,
  type OfflineQueueEntry,
} from '../../lib/offlineQueue';

interface OfflineQueuePanelProps {
  open: boolean;
  entries: OfflineQueueEntry[];
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  onClose: () => void;
  onSyncNow: () => void;
}

const formatTime = (value?: string | null) => {
  if (!value) return 'Nunca';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-ES');
};

const OfflineQueuePanel: React.FC<OfflineQueuePanelProps> = ({
  open,
  entries,
  isSyncing,
  lastSyncAt,
  lastSyncError,
  onClose,
  onSyncNow,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm">
      <div className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-white">Centro Offline</h2>
            <p className="text-xs text-slate-400">Cola local, conflictos y resincronizacion manual.</p>
          </div>
          <button onClick={onClose} className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-slate-700">Cerrar</button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-800 px-5 py-4 text-xs text-slate-300">
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1">Total: {entries.length}</span>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1">Pendientes: {entries.filter((entry) => entry.status === 'pending').length}</span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">Retryables: {entries.filter((entry) => entry.status === 'retryable').length}</span>
          <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-rose-200">Conflictos: {entries.filter((entry) => entry.status === 'conflict').length}</span>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
          <button onClick={onSyncNow} disabled={isSyncing} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 hover:bg-cyan-500">{isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}</button>
          <button onClick={clearResolvedOfflineErrors} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-900">Limpiar errores resueltos</button>
        </div>

        <div className="border-b border-slate-800 px-5 py-4 text-sm text-slate-300">
          <p>Ultima sincronizacion: <span className="font-bold text-white">{formatTime(lastSyncAt)}</span></p>
          <p className="mt-1">Ultimo error: <span className="text-rose-300">{lastSyncError || 'Ninguno'}</span></p>
        </div>

        <div className="h-[calc(100%-221px)] overflow-y-auto px-5 py-4">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-500">No hay operaciones offline pendientes.</div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{getOfflineEntryLabel(entry)}</p>
                      <p className="mt-1 text-xs text-slate-400">{entry.type} · creada {formatTime(entry.createdAt)}</p>
                      <p className="mt-1 text-xs text-slate-500">Intentos: {entry.attempts} · ultimo intento: {formatTime(entry.lastAttemptAt)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black ${entry.status === 'conflict' ? 'bg-rose-500/15 text-rose-200 border border-rose-500/30' : entry.status === 'retryable' ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30' : 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30'}`}>
                      {entry.status.toUpperCase()}
                    </span>
                  </div>

                  {entry.error && <p className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-xs text-rose-200">{entry.error}</p>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(entry.status === 'retryable' || entry.status === 'conflict') && (
                      <button onClick={() => void retryOfflineEntry(entry.id)} className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500">Reintentar</button>
                    )}
                    {entry.status === 'conflict' && (
                      <button onClick={() => void replayOfflineEntry(entry.id)} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20">Reponer en cola</button>
                    )}
                    <button onClick={() => discardOfflineEntry(entry.id)} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-950">Descartar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineQueuePanel;
