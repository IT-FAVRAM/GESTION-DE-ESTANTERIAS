/**
 * OfflineDebugPanel — Panel de debug para estado offline
 * Gestor de Estanterías WMS v3.0
 *
 * Muestra información detallada del estado offline, útil para desarrollo y testing.
 * Solo visible en desarrollo (cuando ?debug=offline está en la URL).
 */

import React, { useState } from 'react';
import { useCacheAudit } from '../../hooks/useCacheAudit';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { printCacheAuditReport } from '../../lib/offline/cacheAudit';
import { forceOfflineMode, forceOnlineMode } from '../../lib/offline/offlineManager';

const OfflineDebugPanel: React.FC = () => {
  const [showPanel, setShowPanel] = useState(false);
  const offline = useOfflineStatus();
  const { report } = useCacheAudit(5000);

  const isDebugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

  if (!isDebugMode) return null;

  return (
    <>
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="fixed bottom-4 right-4 z-[99] px-3 py-2 bg-purple-600 text-white text-xs font-bold rounded hover:bg-purple-500"
        title="Toggle offline debug panel"
      >
        🔧 Offline Debug
      </button>

      {showPanel && (
        <div className="fixed bottom-16 right-4 z-[99] w-96 max-h-[70vh] bg-slate-950 border border-purple-500 rounded-lg p-4 overflow-y-auto shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-purple-300">Offline Debug</h3>
            <button
              onClick={() => setShowPanel(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Connection Status */}
            <div className="bg-slate-900 rounded p-3 border border-slate-700">
              <p className="font-bold text-slate-300 mb-2">Conexión</p>
              <div className="space-y-1 text-slate-400">
                <p>
                  Estado:{' '}
                  <span className={offline.isOffline ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {offline.isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </p>
                <p>navigator.onLine: {navigator.onLine ? '✓' : '✗'}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => void forceOfflineMode()}
                  className="flex-1 px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-500"
                >
                  Forzar Offline
                </button>
                <button
                  onClick={() => void forceOnlineMode()}
                  className="flex-1 px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-500"
                >
                  Forzar Online
                </button>
              </div>
            </div>

            {/* Queue Status */}
            <div className="bg-slate-900 rounded p-3 border border-slate-700">
              <p className="font-bold text-slate-300 mb-2">Cola Offline</p>
              <div className="space-y-1 text-slate-400">
                <p>Pendientes: {offline.pendingCount}</p>
                <p>Reintentos: {offline.retryableCount}</p>
                <p>Conflictos: {offline.conflictCount}</p>
                <p>Sincronizando: {offline.isSyncing ? '✓' : '✗'}</p>
                <p>Última sync: {offline.lastSyncAt ? new Date(offline.lastSyncAt).toLocaleTimeString('es-ES') : 'Nunca'}</p>
              </div>
              <div className="mt-3">
                <button
                  onClick={() => void offline.syncNow()}
                  disabled={offline.isSyncing}
                  className="w-full px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-500 disabled:opacity-50"
                >
                  {offline.isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                </button>
              </div>
            </div>

            {/* Cache Audit */}
            {report && (
              <div className="bg-slate-900 rounded p-3 border border-slate-700">
                <p className="font-bold text-slate-300 mb-2">Auditoría de Caché</p>
                <div className="space-y-1 text-slate-400">
                  <p>
                    Tamaño: <span className="text-white font-bold">{report.storage.totalSizeMB.toFixed(2)} MB</span> / 5 MB
                  </p>
                  <p>Salud: {report.health === 'good' ? '✅' : report.health === 'warning' ? '⚠️' : '🔴'}</p>
                  <p>Items en caché: {report.caches.items.exists ? '✓' : '✗'}</p>
                  <p>Estanterías en caché: {report.caches.shelves.exists ? '✓' : '✗'}</p>
                  <p>Config en caché: {report.caches.config.exists ? '✓' : '✗'}</p>
                </div>
                <button
                  onClick={() => {
                    if (report) printCacheAuditReport(report);
                  }}
                  className="w-full mt-2 px-2 py-1 bg-purple-600 text-white rounded text-[10px] font-bold hover:bg-purple-500"
                >
                  Ver en consola
                </button>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-slate-900 rounded p-3 border border-slate-700">
              <p className="font-bold text-slate-300 mb-2">Acciones</p>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-500"
              >
                Limpiar todo y recargar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OfflineDebugPanel;
