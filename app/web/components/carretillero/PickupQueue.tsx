/**
 * PickupQueue — Cola de recogidas para el carretillero
 * Gestor de Estanterías WMS v3.0
 * 
 * Muestra solicitudes agrupadas por sección, con botón de completar.
 */

import React, { useState } from 'react';
import { usePickupQueue, type PickupRequest, type GroupedPickups } from '../../hooks/usePickupQueue';
import { useAuth } from '../../hooks/useAuth';

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `hace ${days}d`;
  if (hrs > 0) return `hace ${hrs}h`;
  if (mins > 0) return `hace ${mins}min`;
  return 'ahora';
};

const PickupQueue: React.FC = () => {
  const { groupedPending, completedRequests, loading, completeRequest, pendingCount } = usePickupQueue();
  const { firebaseUser } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const handleComplete = async (requestId: string) => {
    if (processingId || !firebaseUser) return;
    setProcessingId(requestId);
    await completeRequest(requestId, firebaseUser.uid);
    setProcessingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-20 space-y-6">
      {/* Pending */}
      <div>
        <h2 className="text-lg font-black text-white flex items-center gap-2 mb-4">
          📦 Solicitudes Pendientes
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-sm font-bold rounded-full">
              {pendingCount}
            </span>
          )}
        </h2>

        {groupedPending.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800">
            <span className="text-4xl mb-3 block">👍</span>
            <p className="text-slate-400 font-medium">No hay solicitudes pendientes</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedPending.map((group) => (
              <div key={group.section}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    {group.sectionName}
                  </span>
                  <span className="text-xs text-slate-600">
                    ({group.requests.length})
                  </span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                {/* Requests */}
                <div className="space-y-2">
                  {group.requests.map((req) => (
                    <div
                      key={req.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                          <span className="text-lg">🔔</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">
                            Operario {req.operarioId}
                          </p>
                          <p className="text-xs text-slate-400">
                            {req.operarioName}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {timeAgo(req.createdAt)} · {req.shelfName}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleComplete(req.id)}
                        disabled={processingId === req.id}
                        className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold 
                          rounded-xl hover:bg-emerald-500 active:scale-95 transition-all
                          disabled:opacity-50 flex items-center gap-2 shadow-lg"
                      >
                        {processingId === req.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span>✓</span>
                        )}
                        HECHO
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed (toggle) */}
      {completedRequests.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full text-center text-sm text-slate-500 font-bold py-2 hover:text-slate-400"
          >
            {showCompleted ? '▲ Ocultar' : '▼ Mostrar'} completadas ({completedRequests.length})
          </button>

          {showCompleted && (
            <div className="space-y-2 mt-2 opacity-50">
              {completedRequests.slice(0, 20).map((req) => (
                <div key={req.id} className="bg-slate-900/50 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400 line-through">
                      Op. {req.operarioId} · {req.shelfName}
                    </p>
                    <p className="text-xs text-slate-600">
                      {req.completedAt ? timeAgo(req.completedAt) : ''}
                    </p>
                  </div>
                  <span className="text-emerald-500">✓</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PickupQueue;
