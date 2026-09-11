/**
 * HistoryModal — Historial de movimientos de un artículo
 * Muestra todas las acciones (UBICAR, RETIRAR, MOVER) en orden cronológico
 */

import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS, type HistoryEntryDoc } from '../../lib/firestoreSchema';
import { SHELF_DEFINITIONS, CART_DEFINITIONS } from '../../lib/firestoreSchema';
import { parseLocationId } from '../../lib/schema/shelves';
import { ArrowRightLeft, CircleHelp, GitBranch, LogOut, MapPin, X, type LucideIcon } from 'lucide-react';
import { ofLabel } from '../../lib/ofLabel';

interface HistoryModalProps {
  open: boolean;
  articleCode: string;
  /** Informativo: OF desde la que se abrió el modal (se resalta en el timeline). */
  orderFab: string;
  onClose: () => void;
}

function shelfNameFor(code: string): string {
  const shelf = SHELF_DEFINITIONS.find((s) => s.code === code);
  if (shelf) return shelf.name;
  const cart = CART_DEFINITIONS.find((c) => c.code === code);
  if (cart) return cart.name;
  return code;
}

const actionLabels: Record<string, { icon: LucideIcon; iconCls: string; label: string; color: string }> = {
  'UBICAR': { icon: MapPin, iconCls: 'text-emerald-600', label: 'Ubicar', color: 'bg-emerald-50 border-emerald-200' },
  'UBICAR_MULTI': { icon: MapPin, iconCls: 'text-emerald-600', label: 'Ubicar (lote)', color: 'bg-emerald-50 border-emerald-200' },
  'RETIRAR': { icon: LogOut, iconCls: 'text-red-600', label: 'Retirar', color: 'bg-red-50 border-red-200' },
  'RETIRAR_DE_UBICACION': { icon: LogOut, iconCls: 'text-red-600', label: 'Retirar', color: 'bg-red-50 border-red-200' },
  'MOVER': { icon: ArrowRightLeft, iconCls: 'text-blue-600', label: 'Mover', color: 'bg-blue-50 border-blue-200' },
};

const HistoryModal: React.FC<HistoryModalProps> = ({ open, articleCode, orderFab, onClose }) => {
  const [history, setHistory] = useState<HistoryEntryDoc[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !articleCode) return;

    const loadHistory = async () => {
      setLoading(true);
      try {
        // Por articleCode solamente (sin filtrar por OF): así se ve el
        // recorrido completo del artículo aunque haya cambiado de OF entre
        // movimientos. Coincide con el índice articleCode+timestamp ya existente.
        const q = query(
          collection(db, COLLECTIONS.HISTORY),
          where('articleCode', '==', articleCode),
          orderBy('timestamp', 'desc'),
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => d.data() as HistoryEntryDoc);
        setHistory(docs);
      } catch (err) {
        console.error('[HistoryModal] error loading history:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [open, articleCode]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-end md:items-center justify-center md:p-4" role="dialog" aria-modal="true">
      <div className="relative w-full md:max-w-2xl bg-white md:rounded-2xl rounded-t-2xl shadow-2xl p-4 md:p-6 border border-slate-200 max-h-[90dvh] overflow-y-auto pb-safe">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-10 w-10 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" aria-hidden />
        </button>

        <h2 className="text-2xl font-bold mb-1 pr-12 text-slate-900">Historial de movimientos</h2>
        <p className="text-sm text-slate-500 mb-2 font-mono tabular-nums break-all">
          {articleCode} {orderFab && `— ${ofLabel(orderFab)}`}
        </p>

        {!loading && new Set(history.map((h) => h.orderFab)).size > 1 && (
          <div className="mb-4 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <GitBranch className="w-4 h-4 shrink-0" aria-hidden /> Este artículo ha pasado por más de una OF — las marcadas en violeta son de otra OF.
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-slate-500">Cargando historial...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-slate-500">Sin movimientos registrados</div>
        ) : (
          <div className="space-y-3">
            {history.map((entry, idx) => {
              const config = actionLabels[entry.action] || { icon: CircleHelp, iconCls: 'text-slate-400', label: entry.action, color: 'bg-slate-50 border-slate-200' };
              const timestamp = new Date(entry.timestamp);
              const validTs = !Number.isNaN(timestamp.getTime());
              const ActionIcon = config.icon;
              const fromParsed = entry.fromLocation ? parseLocationId(entry.fromLocation) : null;
              const toParsed = entry.toLocation ? parseLocationId(entry.toLocation) : null;

              const isOtherOf = !!orderFab && entry.orderFab !== orderFab;

              return (
                <div key={idx} className={`border rounded-lg p-3 ${config.color} ${isOtherOf ? 'ring-1 ring-violet-300' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex gap-3 flex-1">
                      <ActionIcon className={`w-6 h-6 mt-0.5 shrink-0 ${config.iconCls}`} aria-hidden />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{config.label}</span>
                          <span className="text-xs text-slate-600">por {entry.operarioName}</span>
                          {entry.orderFab && (
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isOtherOf ? 'bg-violet-100 text-violet-700 font-bold' : 'bg-slate-100 text-slate-500'}`}>
                              {ofLabel(entry.orderFab)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                          {fromParsed && (
                            <div>
                              <span className="text-slate-500">De: </span>
                              <span className="font-mono">
                                {shelfNameFor(fromParsed.shelfCode)} → pos. {fromParsed.position}
                              </span>
                            </div>
                          )}
                          {toParsed && (
                            <div>
                              <span className="text-slate-500">A: </span>
                              <span className="font-mono">
                                {shelfNameFor(toParsed.shelfCode)} → pos. {toParsed.position}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 text-right shrink-0 tabular-nums">
                      {validTs ? timestamp.toLocaleDateString('es-ES') : '—'}
                      {validTs && <div>{timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default HistoryModal;
