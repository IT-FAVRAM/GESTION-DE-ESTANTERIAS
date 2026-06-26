/**
 * IncomingRequestModal — Popup BLOQUEANTE para el carretillero asignado.
 *
 * Cuando llega una solicitud asignada a este carretillero y aún no la ha
 * confirmado, se muestra a pantalla completa y NO se puede cerrar por fuera:
 * solo el botón "RECIBIDO" la confirma (pasa a su cola; luego la cierra con
 * "HECHO"). Si hay varias sin confirmar, se van mostrando de una en una.
 */

import React, { useState } from 'react';
import type { PickupRequest } from '../../hooks/usePickupQueue';

interface IncomingRequestModalProps {
  /** Solicitudes asignadas a mí y sin confirmar (ordenadas, la más antigua primero). */
  requests: PickupRequest[];
  onAcknowledge: (requestId: string) => Promise<boolean> | void;
}

const Row: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <span className={`text-lg font-black ${accent || 'text-white'}`}>{value}</span>
  </div>
);

const IncomingRequestModal: React.FC<IncomingRequestModalProps> = ({ requests, onAcknowledge }) => {
  const [processing, setProcessing] = useState(false);
  const req = requests[0];

  if (!req) return null;

  const isTraer = req.requestType === 'TRAER';
  const isRecepcion = req.requestType === 'RECEPCION';
  const remaining = requests.length - 1;

  const articleCode = isTraer ? req.articleCode : req.articleToPickCode;
  const articleOrderFab = isTraer ? req.articleOrderFab : req.articleToPickOrderFab;

  const origin = isTraer
    ? `${req.articleShelfName || '—'}${req.articlePositions && req.articlePositions.length > 0 ? ` · pos. ${req.articlePositions.join(', ')}` : ''}`
    : `${req.pickupShelfName || req.shelfName || '—'}${req.pickupStation ? ` · puesto ${req.pickupStation}` : ''}`;

  const destination = `${req.destinationShelfName || req.shelfName || '—'}${req.destinationStation ? ` · puesto ${req.destinationStation}` : ''}`;

  const handleAck = async () => {
    if (processing) return;
    setProcessing(true);
    await onAcknowledge(req.id);
    setProcessing(false);
  };

  // RECEPCIÓN — popup simple: solo ir a Recepciones a por el material recepcionado.
  if (isRecepcion) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/98 backdrop-blur-md">
        <div className="px-5 py-4 bg-teal-600 animate-pulse">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white">📦 MATERIAL EN RECEPCIONES</h2>
            {remaining > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-white/25 text-white text-sm font-black">
                +{remaining} más
              </span>
            )}
          </div>
          <p className="text-white/90 text-sm mt-0.5 font-bold">Avisa: {req.operarioName}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col items-center justify-center text-center gap-5">
          <span className="text-7xl">📦</span>
          <p className="text-3xl font-black text-white leading-tight">Ve a Recepciones</p>
          <p className="text-lg text-slate-300 font-bold max-w-xs">Hay material recepcionado para recoger.</p>
        </div>

        <div className="px-5 pb-safe pt-3 border-t border-slate-800">
          <button
            onClick={handleAck}
            disabled={processing}
            className="w-full h-20 rounded-3xl bg-gradient-to-r from-emerald-500 to-emerald-600
              text-white font-black text-2xl shadow-xl shadow-emerald-950/40
              active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-3"
          >
            {processing ? (
              <>
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Confirmando…
              </>
            ) : (
              <>✓ RECIBIDO</>
            )}
          </button>
          <p className="text-center text-xs text-slate-500 mt-3">
            Pulsa RECIBIDO para aceptar. Luego confírmala como HECHO en tu cola cuando la realices.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/98 backdrop-blur-md">
      {/* Banda superior pulsante */}
      <div className={`px-5 py-4 ${isTraer ? 'bg-blue-600' : 'bg-orange-600'} animate-pulse`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white">
            {isTraer ? '📦 NUEVA SOLICITUD — TRAER' : '🔔 NUEVA SOLICITUD — RECOGER'}
          </h2>
          {remaining > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-white/25 text-white text-sm font-black">
              +{remaining} más
            </span>
          )}
        </div>
        <p className="text-white/90 text-sm mt-0.5 font-bold">
          Solicita: {req.operarioName}
        </p>
      </div>

      {/* Cuerpo */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {articleCode ? (
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-5">
            <p className="font-black text-white text-3xl font-mono leading-tight break-all">{articleCode}</p>
            {articleOrderFab && (
              <p className="text-base text-slate-400 font-mono mt-1">OF: {articleOrderFab}</p>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-5">
            <p className="text-slate-300 font-bold">Material sin código indicado</p>
          </div>
        )}

        <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-4 space-y-4">
          <Row label={isTraer ? 'Está en' : 'Recoger en'} value={origin} accent="text-amber-300" />
          <div className="h-px bg-slate-700" />
          <Row label="Llevar a" value={destination} accent="text-emerald-300" />
        </div>
      </div>

      {/* Acción — único modo de cerrar */}
      <div className="px-5 pb-safe pt-3 border-t border-slate-800">
        <button
          onClick={handleAck}
          disabled={processing}
          className="w-full h-20 rounded-3xl bg-gradient-to-r from-emerald-500 to-emerald-600
            text-white font-black text-2xl shadow-xl shadow-emerald-950/40
            active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-3"
        >
          {processing ? (
            <>
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Confirmando…
            </>
          ) : (
            <>✓ RECIBIDO</>
          )}
        </button>
        <p className="text-center text-xs text-slate-500 mt-3">
          Pulsa RECIBIDO para aceptar. Luego confírmala como HECHO en tu cola cuando la realices.
        </p>
      </div>
    </div>
  );
};

export default IncomingRequestModal;
