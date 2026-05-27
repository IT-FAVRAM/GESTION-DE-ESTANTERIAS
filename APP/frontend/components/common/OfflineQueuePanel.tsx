import React, { useState } from 'react';
import {
  clearResolvedOfflineErrors,
  discardOfflineEntry,
  getOfflineEntryLabel,
  replayOfflineEntry,
  retryOfflineEntry,
  type OfflineQueueEntry,
} from '../../lib/offline/offlineQueue';
import { analyzeConflict, shouldAutoResolve } from '../../lib/offline/conflictResolver';
import { getStorageStats } from '../../lib/offline/storageManager';
import { generateCacheAuditReport } from '../../lib/offline/cacheAudit';

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

const ConflictEntry: React.FC<{ entry: OfflineQueueEntry }> = ({ entry }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof analyzeConflict>> | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const result = await analyzeConflict(entry);
      setAnalysis(result);

      if (shouldAutoResolve(result)) {
        setTimeout(() => {
          discardOfflineEntry(entry.id);
        }, 2000);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-rose-500/50 bg-rose-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-rose-200">{getOfflineEntryLabel(entry)}</p>
          <p className="mt-1 text-xs text-slate-400">{entry.type} · creada {formatTime(entry.createdAt)}</p>
          <p className="mt-1 text-xs text-slate-500">Intentos: {entry.attempts}/5</p>
        </div>
        <span className="rounded-full bg-rose-500/15 px-3 py-1 text-[11px] font-black text-rose-200 border border-rose-500/30">CONFLICTO</span>
      </div>

      {entry.error && (
        <p className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-xs text-rose-300">{entry.error}</p>
      )}

      {analysis && (
        <div className="mt-3 rounded-lg bg-slate-950/50 border border-slate-700 p-3">
          <p className="text-xs font-bold text-slate-300">Análisis:</p>
          <p className="mt-1 text-xs text-slate-400">{analysis.reason}</p>
          <p className="mt-2 text-xs text-slate-500 italic">{analysis.recommendation}</p>
          {shouldAutoResolve(analysis) && (
            <p className="mt-2 text-xs text-emerald-300">✅ Se resolverá automáticamente...</p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!analysis && (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {analyzing ? 'Analizando...' : 'Analizar automáticamente'}
          </button>
        )}
        <button
          onClick={() => void retryOfflineEntry(entry.id)}
          className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500"
        >
          Reintentar
        </button>
        <button
          onClick={() => void replayOfflineEntry(entry.id)}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20"
        >
          Reponer en cola
        </button>
        <button
          onClick={() => discardOfflineEntry(entry.id)}
          className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-950"
        >
          Descartar
        </button>
      </div>
    </div>
  );
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
  const [tab, setTab] = React.useState<'queue' | 'audit'>('queue');
  const stats = getStorageStats();
  const audit = generateCacheAuditReport();

  if (!open) return null;

  const pendingCount = entries.filter((e) => e.status === 'pending').length;
  const retryableCount = entries.filter((e) => e.status === 'retryable').length;
  const conflictCount = entries.filter((e) => e.status === 'conflict').length;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm">
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl border-l border-slate-800 bg-slate-950 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-white">Centro Offline</h2>
            <p className="text-xs text-slate-400">Cola local, conflictos, auditoría y sincronización.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-slate-700"
          >
            Cerrar
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-800 px-5 py-3">
          <button
            onClick={() => setTab('queue')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
              tab === 'queue'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Cola ({entries.length})
          </button>
          <button
            onClick={() => setTab('audit')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
              tab === 'audit'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Auditoría
          </button>
        </div>

        {tab === 'queue' && (
          <>
            <div className="flex flex-wrap gap-2 border-b border-slate-800 px-5 py-4 text-xs text-slate-300">
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1">
                Total: {entries.length}
              </span>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-200">
                Pendientes: {pendingCount}
              </span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">
                Reintentos: {retryableCount}
              </span>
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-rose-200">
                Conflictos: {conflictCount}
              </span>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
              <button
                onClick={onSyncNow}
                disabled={isSyncing}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 hover:bg-cyan-500"
              >
                {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
              </button>
              <button
                onClick={clearResolvedOfflineErrors}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-900"
              >
                Limpiar resueltos
              </button>
            </div>

            <div className="border-b border-slate-800 px-5 py-4 text-sm text-slate-300">
              <p>
                Última sincronización:{' '}
                <span className="font-bold text-white">{formatTime(lastSyncAt)}</span>
              </p>
              <p className="mt-1">
                Último error:{' '}
                <span className="text-rose-300">{lastSyncError || 'Ninguno'}</span>
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {entries.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-500">
                  No hay operaciones offline pendientes.
                </div>
              ) : (
                <div className="space-y-3">
                  {entries
                    .filter((e) => e.status === 'conflict')
                    .map((entry) => (
                      <ConflictEntry key={entry.id} entry={entry} />
                    ))}

                  {entries
                    .filter((e) => e.status !== 'conflict')
                    .map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-white">{getOfflineEntryLabel(entry)}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {entry.type} · creada {formatTime(entry.createdAt)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Intentos: {entry.attempts} · último: {formatTime(entry.lastAttemptAt)}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-black ${
                              entry.status === 'retryable'
                                ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
                                : 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30'
                            }`}
                          >
                            {entry.status.toUpperCase()}
                          </span>
                        </div>

                        {entry.error && (
                          <p className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-xs text-rose-200">
                            {entry.error}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {entry.status === 'retryable' && (
                            <button
                              onClick={() => void retryOfflineEntry(entry.id)}
                              className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500"
                            >
                              Reintentar
                            </button>
                          )}
                          <button
                            onClick={() => discardOfflineEntry(entry.id)}
                            className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-950"
                          >
                            Descartar
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'audit' && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                <p className="text-xs font-bold text-slate-400 uppercase">Almacenamiento</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Tamaño total:</span>
                    <span className="font-bold text-white">
                      {stats.totalSizeMB.toFixed(2)} MB / 5 MB
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition ${
                        stats.totalSizeMB > 4.5
                          ? 'bg-rose-500'
                          : stats.totalSizeMB > 3
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${(stats.totalSizeMB / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {stats.cacheItems} caché · {stats.queueItems} cola
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                <p className="text-xs font-bold text-slate-400 uppercase">Antigüedad de caché</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-950 rounded p-2">
                    <p className="text-slate-500">{'<'} 1 día</p>
                    <p className="font-bold text-white">{stats.entriesByAge.lessThan1Day}</p>
                  </div>
                  <div className="bg-slate-950 rounded p-2">
                    <p className="text-slate-500">1-3 días</p>
                    <p className="font-bold text-white">{stats.entriesByAge.lessThan3Days}</p>
                  </div>
                  <div className="bg-slate-950 rounded p-2">
                    <p className="text-slate-500">3-7 días</p>
                    <p className="font-bold text-white">{stats.entriesByAge.lessThan7Days}</p>
                  </div>
                  <div className="bg-slate-950 rounded p-2">
                    <p className="text-slate-500">{'>'} 7 días</p>
                    <p className="font-bold text-amber-300">{stats.entriesByAge.olderThan7Days}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Estado general</p>
                    <p className="mt-1 text-sm font-bold text-white capitalize flex items-center gap-2">
                      {audit.health === 'good' && '✅'}
                      {audit.health === 'warning' && '⚠️'}
                      {audit.health === 'critical' && '🔴'}
                      {audit.health}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {audit.recommendations.map((rec, idx) => (
                    <p key={idx} className="text-xs text-slate-400">
                      {rec}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflineQueuePanel;


