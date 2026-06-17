/**
 * PickupQueue — Cola de solicitudes para el carretillero
 * Gestor de Estanterías WMS v3.0
 *
 * Muestra solicitudes agrupadas por sección. Distingue RECOGER (naranja) de TRAER (azul).
 */

import React, { useState, useEffect } from 'react';
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

interface RequestCardProps {
  req: PickupRequest;
  onComplete: (id: string) => void;
  processingId: string | null;
}

/** Badges comunes: carretillero asignado + estado de recibido. */
const MetaBadges: React.FC<{ req: PickupRequest }> = ({ req }) => (
  <div className="flex flex-wrap items-center gap-1.5 mt-2">
    {req.targetCarretilleroName && (
      <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
        🚜 {req.targetCarretilleroName}
      </span>
    )}
    {req.acknowledged && (
      <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
        ✓ recibido
      </span>
    )}
  </div>
);

const stationLabel = (station?: number | null) => (station ? ` · puesto ${station}` : '');

const RequestCard: React.FC<RequestCardProps> = ({ req, onComplete, processingId }) => {
  const isTraer = req.requestType === 'TRAER';
  const destText = `${req.destinationShelfName || req.shelfName}${stationLabel(req.destinationStation)}`;

  if (isTraer) {
    return (
      <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
              <span className="text-lg">📦</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  Traer
                </span>
                <span className="text-xs text-slate-500">{timeAgo(req.createdAt)}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {req.operarioName} · {req.shelfName}
              </p>
            </div>
          </div>
          <button
            onClick={() => onComplete(req.id)}
            disabled={processingId === req.id}
            className="shrink-0 px-3 py-2 bg-blue-600 text-white text-sm font-bold
              rounded-xl hover:bg-blue-500 active:scale-95 transition-all
              disabled:opacity-50 flex items-center gap-1.5 shadow-md"
          >
            {processingId === req.id ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : <span>✓</span>}
            HECHO
          </button>
        </div>
        {/* Article info */}
        {req.articleCode && (
          <div className="mt-3 bg-blue-950/40 border border-blue-500/20 rounded-xl p-3">
            <p className="font-black text-white font-mono text-base leading-tight">
              {req.articleCode}
            </p>
            {req.articleOrderFab && (
              <p className="text-xs text-slate-400 font-mono mt-0.5">OF: {req.articleOrderFab}</p>
            )}
            {req.articleShelfName && (
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-[11px] text-blue-400">📍</span>
                <div>
                  <span className="text-xs font-bold text-blue-300">{req.articleShelfName}</span>
                  {req.articlePositions && req.articlePositions.length > 0 && (
                    <span className="text-xs text-slate-400 ml-1">
                      — {req.articlePositions.length === 1
                        ? `posición ${req.articlePositions[0]}`
                        : `posiciones ${req.articlePositions.join(', ')}`}
                    </span>
                  )}
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-2">
              → Llevar a: <span className="text-emerald-300 font-bold">{destText}</span>
            </p>
          </div>
        )}
        <MetaBadges req={req} />
      </div>
    );
  }

  // RECOGER (default)
  const hasDetails = !!(req.articleToPickCode || req.destinationShelfName || req.pickupShelfName);
  const fromText = `${req.pickupShelfName || req.shelfName}${stationLabel(req.pickupStation)}`;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
            <span className="text-lg">🔔</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-orange-400 bg-orange-500/15 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Recoger
              </span>
              <span className="text-xs text-slate-500">{timeAgo(req.createdAt)}</span>
            </div>
            <p className="text-sm font-bold text-white mt-0.5">{req.operarioName}</p>
          </div>
        </div>
        <button
          onClick={() => onComplete(req.id)}
          disabled={processingId === req.id}
          className="shrink-0 px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold
            rounded-xl hover:bg-emerald-500 active:scale-95 transition-all
            disabled:opacity-50 flex items-center gap-2 shadow-lg"
        >
          {processingId === req.id ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : <span>✓</span>}
          HECHO
        </button>
      </div>
      {hasDetails && (
        <div className="mt-3 bg-orange-950/30 border border-orange-500/20 rounded-xl p-3">
          {req.articleToPickCode && (
            <p className="font-black text-white font-mono text-base leading-tight">{req.articleToPickCode}</p>
          )}
          {req.articleToPickOrderFab && (
            <p className="text-xs text-slate-400 font-mono mt-0.5">OF: {req.articleToPickOrderFab}</p>
          )}
          <p className="text-[11px] text-slate-400 mt-2">
            Recoger en: <span className="text-amber-300 font-bold">{fromText}</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            → Llevar a: <span className="text-emerald-300 font-bold">{destText}</span>
          </p>
        </div>
      )}
      <MetaBadges req={req} />
    </div>
  );
};

interface PickupQueueProps {
  currentShelf?: string;
}

const PickupQueue: React.FC<PickupQueueProps> = ({ currentShelf }) => {
  const { groupedPending, completedRequests, loading, completeRequest, pendingCount } = usePickupQueue();
  const { firebaseUser } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [lastShelf, setLastShelf] = useState<string | undefined>(currentShelf);
  const [shelfChanged, setShelfChanged] = useState(false);

  useEffect(() => {
    if (currentShelf !== lastShelf && lastShelf !== undefined) {
      setShelfChanged(true);
    }
    setLastShelf(currentShelf);
  }, [currentShelf, lastShelf]);

  // Derivar dos arrays filtrados: Recogidas (RECOGER) y Traídas (TRAER)
  const recogidasPending = groupedPending
    .map(g => ({ ...g, requests: g.requests.filter(r => r.requestType === 'RECOGER') }))
    .filter(g => g.requests.length > 0);

  const trairadasPending = groupedPending
    .map(g => ({ ...g, requests: g.requests.filter(r => r.requestType === 'TRAER') }))
    .filter(g => g.requests.length > 0);

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
      {shelfChanged && (
        <div className="bg-amber-950/50 border border-amber-500/50 rounded-xl p-3 flex items-start gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-200">Información posiblemente desactualizada</p>
            <p className="text-xs text-amber-300/80 mt-0.5">Cambiaste de estantería. Las solicitudes pueden no corresponder a {currentShelf}.</p>
          </div>
          <button
            onClick={() => {
              setShelfChanged(false);
              setLastShelf(currentShelf);
            }}
            className="shrink-0 px-2 py-1 text-xs font-bold bg-amber-600 text-white rounded hover:bg-amber-500 transition-colors"
          >
            OK
          </button>
        </div>
      )}
      {/* Sub-sección: RECOGIDAS */}
      <div>
        <h2 className="text-lg font-black text-white flex items-center gap-2 mb-4">
          🔔 Recogidas
          {recogidasPending.reduce((n, g) => n + g.requests.length, 0) > 0 && (
            <span className="px-2 py-0.5 bg-orange-500 text-white text-sm font-bold rounded-full">
              {recogidasPending.reduce((n, g) => n + g.requests.length, 0)}
            </span>
          )}
        </h2>

        {recogidasPending.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800">
            <span className="text-4xl mb-3 block">✅</span>
            <p className="text-slate-400 font-medium">Sin recogidas pendientes</p>
          </div>
        ) : (
          <div className="space-y-6">
            {recogidasPending.map((group) => (
              <div key={group.section}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    {group.sectionName}
                  </span>
                  <span className="text-xs text-slate-600">({group.requests.length})</span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>
                <div className="space-y-2">
                  {group.requests.map((req) => (
                    <RequestCard
                      key={req.id}
                      req={req}
                      onComplete={handleComplete}
                      processingId={processingId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sub-sección: TRAÍDAS */}
      <div className="border-t border-slate-700 pt-6">
        <h2 className="text-lg font-black text-white flex items-center gap-2 mb-4">
          📦 Traídas
          {trairadasPending.reduce((n, g) => n + g.requests.length, 0) > 0 && (
            <span className="px-2 py-0.5 bg-blue-500 text-white text-sm font-bold rounded-full">
              {trairadasPending.reduce((n, g) => n + g.requests.length, 0)}
            </span>
          )}
        </h2>

        {trairadasPending.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800">
            <span className="text-4xl mb-3 block">✅</span>
            <p className="text-slate-400 font-medium">Sin solicitudes de traída pendientes</p>
          </div>
        ) : (
          <div className="space-y-6">
            {trairadasPending.map((group) => (
              <div key={group.section}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    {group.sectionName}
                  </span>
                  <span className="text-xs text-slate-600">({group.requests.length})</span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>
                <div className="space-y-2">
                  {group.requests.map((req) => (
                    <RequestCard
                      key={req.id}
                      req={req}
                      onComplete={handleComplete}
                      processingId={processingId}
                    />
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
                      {req.requestType === 'TRAER' ? `📦 ${req.articleCode || 'Traslado'}` : `🔔 ${req.operarioName}`}
                      {' · '}{req.shelfName}
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


