/**
 * PickupQueue — Cola de solicitudes para el carretillero
 * Gestor de Estanterías WMS v3.0
 *
 * Muestra solicitudes agrupadas por sección. Distingue RECOGER (naranja) de TRAER (azul).
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { usePickupQueue, type PickupRequest, type GroupedPickups } from '../../hooks/usePickupQueue';
import { useAuth } from '../../hooks/useAuth';
import { inventoryApi } from '../../lib/api/inventoryApi';
import { getOperationalSession } from '../../lib/operationalSession';
import { ofLabel } from '../../lib/ofLabel';
import { parseCallableError } from '../../lib/callableError';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';
import { parseLocationId } from '../../lib/schema/shelves';
import { findArticleGlobal } from '../../lib/findArticleGlobal';
import { SECTION_TO_SHELF, canonicalizeShelfCode } from '../../domain/auth/sectionShelf';

interface OriginLocation { shelfCode: string; position: string }

/**
 * Ubicaciones reales de origen de un TRAER, tal como están en BD ("SOL" + "044").
 * Las solicitudes nuevas guardan articleLocationIds. Las antiguas solo guardaban
 * el nombre de la estantería ("Soldadura") y la posición sin ceros ("44").
 */
const resolveTraerOrigin = (req: PickupRequest): OriginLocation[] => {
  if (req.articleLocationIds?.length) {
    return req.articleLocationIds
      .map(parseLocationId)
      .filter((loc): loc is OriginLocation => loc !== null);
  }
  const shelfCode = req.articleShelfCode
    || SHELF_DEFINITIONS.find((s) => s.name === req.articleShelfName)?.code
    || req.articleShelfName
    || '';
  if (!shelfCode) return [];
  return (req.articlePositions || []).map((p) => {
    const raw = p.includes('_') ? p.slice(p.lastIndexOf('_') + 1) : p;
    return { shelfCode, position: /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw };
  });
};

/**
 * Huecos donde consta el artículo de un RECOGER dentro de su estantería de
 * origen (la indicada en la solicitud o, si no, la de quien la pidió).
 */
const resolveRecogerOrigin = async (req: PickupRequest): Promise<OriginLocation[]> => {
  if (!req.articleToPickCode) return [];
  const hasExplicitPickup = !!(req.pickupSection || req.pickupShelfName);
  const originShelf = hasExplicitPickup
    ? (req.pickupSection ? SECTION_TO_SHELF[req.pickupSection] : undefined)
      ?? SHELF_DEFINITIONS.find((s) => s.name === req.pickupShelfName)?.code
    : req.shelfCode;
  if (!originShelf) return [];
  const canonicalOrigin = canonicalizeShelfCode(originShelf);
  const locs = await findArticleGlobal(req.articleToPickCode, req.articleToPickOrderFab || '');
  return locs
    .filter((l) => canonicalizeShelfCode(l.shelfCode) === canonicalOrigin)
    .map((l) => parseLocationId(l.locationId) ?? { shelfCode: l.shelfCode, position: l.position });
};

const originLabel = (loc: OriginLocation) => `${loc.shelfCode} ${loc.position}`;

/** Ventana "¿quieres que lo retire?" al completar un TRAER o un RECOGER. */
interface WithdrawalPrompt {
  req: PickupRequest;
  articleCode: string;
  orderFab: string;
  /** Nombre de la estantería de origen, para mostrar. */
  shelfLabel: string;
  origin: OriginLocation[];
}

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
        {req.targetCarretilleroName}
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
  const isRecepcion = req.requestType === 'RECEPCION';
  const destText = `${req.destinationShelfName || req.shelfName}${stationLabel(req.destinationStation)}`;

  // BAJAR MATERIAL — sin datos que indicar: bajar material a Soldadura.
  if (req.requestType === 'BAJAR_MATERIAL') {
    return (
      <div className="bg-gradient-to-br from-amber-950 to-slate-900 border-2 border-amber-500/40 rounded-2xl p-4 shadow-lg hover:border-amber-500/60 transition-colors">
        <div className="mb-3">
          <p className="text-xs font-bold text-amber-300 uppercase tracking-widest">Aviso de {req.operarioName}</p>
          <p className="text-sm text-slate-400 mt-0.5">{timeAgo(req.createdAt)}</p>
        </div>

        <div className="flex items-start gap-2.5 bg-amber-950/60 border border-amber-500/20 rounded-xl p-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Bajar material a</p>
            <p className="text-base font-black text-amber-200">{req.shelfName || 'Soldadura'}</p>
          </div>
        </div>

        <button
          onClick={() => onComplete(req.id)}
          disabled={processingId === req.id}
          className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white text-sm font-black
            rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
        >
          {processingId === req.id ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : <span>✓</span>}
          {processingId === req.id ? 'Procesando...' : 'MARCAR COMO HECHO'}
        </button>

        <MetaBadges req={req} />
      </div>
    );
  }

  // RECEPCIÓN — sin datos que indicar: solo ir a Recepciones a por material recepcionado.
  if (isRecepcion) {
    return (
      <div className="bg-gradient-to-br from-teal-950 to-slate-900 border-2 border-teal-500/40 rounded-2xl p-4 shadow-lg hover:border-teal-500/60 transition-colors">
        <div className="mb-3">
          <p className="text-xs font-bold text-teal-300 uppercase tracking-widest">Aviso de {req.operarioName}</p>
          <p className="text-sm text-slate-400 mt-0.5">{timeAgo(req.createdAt)}</p>
        </div>

        <div className="flex items-start gap-2.5 bg-teal-950/60 border border-teal-500/20 rounded-xl p-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ir a</p>
            <p className="text-base font-black text-teal-200">Recepciones</p>
            <p className="text-xs text-slate-400 mt-0.5">Hay material recepcionado para recoger.</p>
          </div>
        </div>

        <button
          onClick={() => onComplete(req.id)}
          disabled={processingId === req.id}
          className="w-full px-4 py-3 bg-teal-600 hover:bg-teal-500 text-white text-sm font-black
            rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
        >
          {processingId === req.id ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : <span>✓</span>}
          {processingId === req.id ? 'Procesando...' : 'MARCAR COMO HECHO'}
        </button>

        <MetaBadges req={req} />
      </div>
    );
  }

  if (isTraer) {
    return (
      <div className="bg-gradient-to-br from-blue-950 to-slate-900 border-2 border-blue-500/40 rounded-2xl p-4 shadow-lg hover:border-blue-500/60 transition-colors">
        {/* Title with who's asking */}
        <div className="mb-3">
          <p className="text-xs font-bold text-blue-300 uppercase tracking-widest">Solicitud de {req.operarioName}</p>
          <p className="text-sm text-slate-400 mt-0.5">{timeAgo(req.createdAt)}</p>
        </div>

        {/* Step-by-step visual flow */}
        <div className="space-y-2.5 mb-4">
          {/* Step 1: Where to pick from */}
          {req.articleShelfName && (
            <div className="flex items-start gap-2.5 bg-blue-950/60 border border-blue-500/20 rounded-xl p-2.5">
              <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-white/15 text-white text-xs font-black flex items-center justify-center tabular-nums">1</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ir a</p>
                <p className="text-sm font-black text-blue-200">{req.articleShelfName}</p>
                {req.articlePositions && req.articlePositions.length > 0 && (
                  <p className="text-xs text-blue-300 mt-0.5">
                    Posición{req.articlePositions.length > 1 ? 'es' : ''}: <span className="font-bold">{req.articlePositions.join(', ')}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: What to pick */}
          {req.articleCode && (
            <div className="flex items-start gap-2.5 bg-blue-950/60 border border-blue-500/20 rounded-xl p-2.5">
              <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-white/15 text-white text-xs font-black flex items-center justify-center tabular-nums">2</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Coger</p>
                <p className="text-sm font-bold text-white font-mono">{req.articleCode}</p>
                {req.articleOrderFab && (
                  <p className="text-xs text-slate-400 mt-0.5">{ofLabel(req.articleOrderFab)}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Where to deliver */}
          <div className="flex items-start gap-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5">
            <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-white/15 text-white text-xs font-black flex items-center justify-center tabular-nums">3</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Llevar a</p>
              <p className="text-sm font-black text-emerald-200">{destText}</p>
            </div>
          </div>
        </div>

        {/* Action button - prominent */}
        <button
          onClick={() => onComplete(req.id)}
          disabled={processingId === req.id}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black
            rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
        >
          {processingId === req.id ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : <span>✓</span>}
          {processingId === req.id ? 'Procesando...' : 'MARCAR COMO HECHO'}
        </button>

        <MetaBadges req={req} />
      </div>
    );
  }

  // RECOGER (default)
  const hasDetails = !!(req.articleToPickCode || req.destinationShelfName || req.pickupShelfName);
  const fromText = `${req.pickupShelfName || req.shelfName}${stationLabel(req.pickupStation)}`;
  return (
    <div className="bg-gradient-to-br from-orange-950 to-slate-900 border-2 border-orange-500/40 rounded-2xl p-4 shadow-lg hover:border-orange-500/60 transition-colors">
      {/* Title with who's asking */}
      <div className="mb-3">
        <p className="text-xs font-bold text-orange-300 uppercase tracking-widest">Solicitud de {req.operarioName}</p>
        <p className="text-sm text-slate-400 mt-0.5">{timeAgo(req.createdAt)}</p>
      </div>

      {/* Step-by-step visual flow */}
      {hasDetails && (
        <div className="space-y-2.5 mb-4">
          {/* Step 1: Where to pick from */}
          <div className="flex items-start gap-2.5 bg-orange-950/60 border border-orange-500/20 rounded-xl p-2.5">
            <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-white/15 text-white text-xs font-black flex items-center justify-center tabular-nums">1</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ir a</p>
              <p className="text-sm font-black text-orange-200">{fromText}</p>
            </div>
          </div>

          {/* Step 2: What to pick */}
          {req.articleToPickCode && (
            <div className="flex items-start gap-2.5 bg-orange-950/60 border border-orange-500/20 rounded-xl p-2.5">
              <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-white/15 text-white text-xs font-black flex items-center justify-center tabular-nums">2</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Coger</p>
                <p className="text-sm font-bold text-white font-mono">{req.articleToPickCode}</p>
                {req.articleToPickOrderFab && (
                  <p className="text-xs text-slate-400 mt-0.5">{ofLabel(req.articleToPickOrderFab)}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Where to deliver */}
          <div className="flex items-start gap-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5">
            <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-white/15 text-white text-xs font-black flex items-center justify-center tabular-nums">3</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Llevar a</p>
              <p className="text-sm font-black text-emerald-200">{destText}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action button - prominent */}
      <button
        onClick={() => onComplete(req.id)}
        disabled={processingId === req.id}
        className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black
          rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
      >
        {processingId === req.id ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : <span>✓</span>}
        {processingId === req.id ? 'Procesando...' : 'MARCAR COMO HECHO'}
      </button>

      <MetaBadges req={req} />
    </div>
  );
};

interface PickupQueueProps {
  currentShelf?: string;
}

const PickupQueue: React.FC<PickupQueueProps> = ({ currentShelf }) => {
  const { groupedPending, completedRequests, loading, completeRequest, pendingCount } = usePickupQueue();
  const { firebaseUser, operarioId, displayName } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [lastShelf, setLastShelf] = useState<string | undefined>(currentShelf);
  const [shelfChanged, setShelfChanged] = useState(false);
  const [withdrawalModal, setWithdrawalModal] = useState<WithdrawalPrompt | null>(null);
  const [withdrawalProcessing, setWithdrawalProcessing] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [withdrawalNotice, setWithdrawalNotice] = useState<string | null>(null);

  useEffect(() => {
    if (currentShelf !== lastShelf && lastShelf !== undefined) {
      setShelfChanged(true);
    }
    setLastShelf(currentShelf);
  }, [currentShelf, lastShelf]);

  // Derivar dos arrays filtrados: Recogidas (RECOGER + RECEPCIÓN) y Traídas (TRAER)
  const recogidasPending = groupedPending
    .map(g => ({ ...g, requests: g.requests.filter(r => r.requestType === 'RECOGER' || r.requestType === 'RECEPCION' || r.requestType === 'BAJAR_MATERIAL') }))
    .filter(g => g.requests.length > 0);

  const trairadasPending = groupedPending
    .map(g => ({ ...g, requests: g.requests.filter(r => r.requestType === 'TRAER') }))
    .filter(g => g.requests.length > 0);

  const handleComplete = async (requestId: string) => {
    const req = groupedPending.flatMap(g => g.requests).find(r => r.id === requestId);
    if (!req) return;

    if (processingId || !firebaseUser) return;

    // El carretillero se lleva la pieza de su estantería: preguntar si la retira
    // de allí para que el sistema refleje lo que hay físicamente.
    if (req.requestType === 'TRAER') {
      setWithdrawalError(null);
      setWithdrawalModal({
        req,
        articleCode: req.articleCode || '',
        orderFab: req.articleOrderFab || '',
        shelfLabel: req.articleShelfName || '',
        origin: resolveTraerOrigin(req),
      });
      return;
    }

    setProcessingId(requestId);
    if (req.requestType === 'RECOGER' && req.articleToPickCode) {
      // RECOGER no guarda huecos (el artículo puede ser texto libre): se busca si
      // consta en la estantería de origen. Si no consta, se completa sin preguntar.
      let origin: OriginLocation[] = [];
      try {
        origin = await resolveRecogerOrigin(req);
      } catch {
        // Sin poder comprobarlo, preguntar igualmente no aporta: se completa.
      }
      if (origin.length > 0) {
        setProcessingId(null);
        setWithdrawalError(null);
        setWithdrawalModal({
          req,
          articleCode: req.articleToPickCode,
          orderFab: req.articleToPickOrderFab || '',
          shelfLabel: req.pickupShelfName || req.shelfName,
          origin,
        });
        return;
      }
    }
    await completeRequest(requestId, firebaseUser.uid);
    setProcessingId(null);
  };

  const handleWithdrawalConfirm = async (shouldWithdraw: boolean) => {
    if (!withdrawalModal || !firebaseUser) return;
    setWithdrawalProcessing(true);
    setWithdrawalError(null);

    try {
      let notice: string | null = null;
      if (shouldWithdraw && withdrawalModal.articleCode) {
        const { origin } = withdrawalModal;
        if (origin.length === 0) {
          throw new Error('La solicitud no guarda de qué hueco sale el artículo. Retíralo a mano desde su estantería.');
        }
        const session = getOperationalSession();
        const retired: string[] = [];
        const notThere: string[] = [];
        for (const loc of origin) {
          try {
            const res = await inventoryApi.retirarDeUbicacion(
              {
                shelfCode: loc.shelfCode,
                articleCode: withdrawalModal.articleCode,
                orderFab: withdrawalModal.orderFab,
                position: loc.position,
                operarioId: operarioId || firebaseUser.uid,
                operarioName: displayName || 'Carretillero',
              },
              session,
            );
            if (!res?.ok) throw new Error('El servidor rechazó la retirada');
            retired.push(originLabel(loc));
          } catch (err) {
            const msg = parseCallableError(err);
            // "No encontrado": ya no consta ahí (lo retiró otro). El objetivo, que
            // no quede un fantasma en el origen, ya se cumple.
            if (/no encontrad/i.test(msg)) { notThere.push(originLabel(loc)); continue; }
            const done = retired.length > 0 ? ` Sí se retiró de ${retired.join(', ')}.` : '';
            throw new Error(`No se pudo retirar de ${originLabel(loc)}: ${msg}.${done}`);
          }
        }
        if (notThere.length > 0) {
          notice = `${withdrawalModal.articleCode}: ${retired.length > 0 ? `retirado de ${retired.join(', ')}. ` : ''}No constaba en ${notThere.join(', ')}.`;
        }
      }

      const result = await completeRequest(withdrawalModal.req.id, firebaseUser.uid);
      if (!result) throw new Error('No se pudo marcar la solicitud como entregada. Inténtalo otra vez.');
      setWithdrawalModal(null);
      setWithdrawalNotice(notice);
    } catch (err) {
      console.error('Error en entrega:', err);
      setWithdrawalError(err instanceof Error ? err.message : parseCallableError(err));
    } finally {
      setWithdrawalProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalRecogidas = recogidasPending.reduce((n, g) => n + g.requests.length, 0);
  const totalTraidas = trairadasPending.reduce((n, g) => n + g.requests.length, 0);
  const totalPending = totalRecogidas + totalTraidas;

  return (
    <div className="p-4 pb-20 space-y-6">
      {/* Resumen visual claro */}
      {totalPending > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-2 border-slate-700 rounded-2xl p-4 shadow-lg">
          <p className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3">Tareas pendientes</p>
          <div className="grid grid-cols-2 gap-3">
            {totalRecogidas > 0 && (
              <div className="bg-orange-950/50 border border-orange-500/30 rounded-xl p-3">
                <p className="text-2xl font-black text-orange-400">{totalRecogidas}</p>
                <p className="text-xs text-orange-300 font-bold mt-1">RECOGIDAS</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Ir a buscar y traer</p>
              </div>
            )}
            {totalTraidas > 0 && (
              <div className="bg-blue-950/50 border border-blue-500/30 rounded-xl p-3">
                <p className="text-2xl font-black text-blue-400">{totalTraidas}</p>
                <p className="text-xs text-blue-300 font-bold mt-1">TRAÍDAS</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Ir a llevar artículos</p>
              </div>
            )}
          </div>
        </div>
      )}

      {withdrawalNotice && (
        <div className="bg-amber-950/50 border border-amber-500/50 rounded-xl p-3 flex items-start gap-3">
          <p className="min-w-0 flex-1 text-sm font-bold text-amber-200">{withdrawalNotice}</p>
          <button
            onClick={() => setWithdrawalNotice(null)}
            className="shrink-0 px-2 py-1 text-xs font-bold bg-amber-600 text-white rounded hover:bg-amber-500 transition-colors"
          >
            OK
          </button>
        </div>
      )}

      {shelfChanged && (
        <div className="bg-amber-950/50 border border-amber-500/50 rounded-xl p-3 flex items-start gap-3">
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
          Recogidas
          {totalRecogidas > 0 && (
            <span className="px-3 py-1 bg-orange-500 text-white text-sm font-bold rounded-full">
              {totalRecogidas}
            </span>
          )}
        </h2>

        {recogidasPending.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800">
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
          Traídas
          {trairadasPending.reduce((n, g) => n + g.requests.length, 0) > 0 && (
            <span className="px-2 py-0.5 bg-blue-500 text-white text-sm font-bold rounded-full">
              {trairadasPending.reduce((n, g) => n + g.requests.length, 0)}
            </span>
          )}
        </h2>

        {trairadasPending.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800">
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
            {showCompleted ? <ChevronUp className="inline w-4 h-4 mr-1" aria-hidden /> : <ChevronDown className="inline w-4 h-4 mr-1" aria-hidden />}{showCompleted ? 'Ocultar' : 'Mostrar'} completadas ({completedRequests.length})
          </button>
          {showCompleted && (
            <div className="space-y-2 mt-2 opacity-50">
              {completedRequests.slice(0, 20).map((req) => (
                <div key={req.id} className="bg-slate-900/50 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400 line-through">
                      {req.requestType === 'TRAER' ? `${req.articleCode || 'Traslado'}` : `${req.operarioName}`}
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

      {/* Modal: Confirmar retiro */}
      {withdrawalModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-gradient-to-br from-blue-950 to-slate-900 border-2 border-blue-500/40 rounded-2xl shadow-2xl p-6 space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-bold text-blue-300 uppercase tracking-widest">El artículo sigue ubicado en:</p>
              <p className="text-2xl font-black text-white">{withdrawalModal.shelfLabel}</p>
              {withdrawalModal.origin.length > 0 && (
                <p className="text-sm font-bold text-blue-200 font-mono">
                  {withdrawalModal.origin.map(originLabel).join(' · ')}
                </p>
              )}
            </div>

            <div className="bg-blue-950/60 border border-blue-500/20 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Artículo:</p>
              <p className="text-base font-mono font-bold text-white mb-3">{withdrawalModal.articleCode}</p>
              {withdrawalModal.orderFab && (
                <p className="text-xs text-slate-400">{ofLabel(withdrawalModal.orderFab)}</p>
              )}
            </div>

            <p className="text-center text-lg font-black text-white">
              ¿QUIERES QUE LO RETIRE?
            </p>

            {withdrawalError && (
              <div role="alert" className="bg-red-950/60 border border-red-500/50 rounded-xl p-3">
                <p className="text-sm font-bold text-red-200">{withdrawalError}</p>
                <p className="text-xs text-red-300/80 mt-1">Puedes volver a intentarlo o marcarla como entregada sin retirar.</p>
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={() => handleWithdrawalConfirm(true)}
                disabled={withdrawalProcessing}
                className="w-full px-4 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-base font-black
                  rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {withdrawalProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <span>✓</span>
                    SÍ
                  </>
                )}
              </button>
              <button
                onClick={() => handleWithdrawalConfirm(false)}
                disabled={withdrawalProcessing}
                className="w-full px-4 py-4 bg-slate-700 hover:bg-slate-600 text-white text-base font-black
                  rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {withdrawalProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <span>✕</span>
                    NO, SOLO MARCAR COMO ENTREGADO
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PickupQueue;


