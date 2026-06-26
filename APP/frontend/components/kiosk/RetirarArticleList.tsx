import React, { useMemo, useState, useCallback, useEffect } from 'react';
import type { ShelfLocationState } from '../../hooks/useShelf';
import { isUrgentLocation } from '../../lib/firestoreSchema';
import type { UrgentAlert } from '../../lib/firestoreSchema';
import { fetchParcialesByPresence, type ParcialInfo } from '../../lib/parciales';

/** Valor numérico de una posición para ordenar (acepta "012" o "URG MEC-PRE 001"). */
const posOrder = (position: string): number => {
  const n = parseInt(position, 10);
  if (!Number.isNaN(n)) return n;
  const m = position.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
};

interface RetirarItem {
  articleCode: string;
  orderFab: string;
  position: string;
  presenceId?: string;
  /** Índice único dentro del array de items (garantiza clave única aunque haya duplicados) */
  itemIndex: number;
}

interface RetirarArticleListProps {
  locations: ShelfLocationState[];
  shelfCode: string;
  onConfirm: (items: RetirarItem[]) => void;
  onClose: () => void;
  urgentAlerts?: UrgentAlert[];
}

interface ItemGroup {
  position: string;
  items: RetirarItem[];
}

const RetirarArticleList: React.FC<RetirarArticleListProps> = ({ locations, shelfCode, onConfirm, onClose, urgentAlerts = [] }) => {
  const items = useMemo<RetirarItem[]>(() => {
    const result: RetirarItem[] = [];
    let globalIndex = 0;
    for (const loc of locations) {
      if (loc.isEmpty) continue;
      for (const item of loc.items) {
        result.push({
          articleCode: item.articleCode,
          orderFab: item.orderFab,
          position: loc.position,
          presenceId: item.presenceId,
          itemIndex: globalIndex++,
        });
      }
    }
    return result;
  }, [locations]);

  // Artículos marcados como urgentes (alertas) para búsqueda O(1).
  const urgentCodes = useMemo(() => new Set(urgentAlerts.map((a) => a.articleCode)), [urgentAlerts]);

  // ¿Es una ubicación urgente de la sección? (zona URGENTE del rack o slot "URG…").
  const isUrgentPos = useCallback((position: string): boolean => {
    if (/URG/i.test(position)) return true;
    const n = parseInt(position, 10);
    if (Number.isNaN(n)) return false;
    return isUrgentLocation(shelfCode, n);
  }, [shelfCode]);

  // Agrupar por ubicación y ordenar los grupos:
  //   1) artículos con alerta urgente (si los hay),
  //   2) ubicaciones URGENTES de la sección,
  //   3) resto.
  // Dentro de cada nivel, en orden numérico de posición.
  const groupedItems = useMemo<ItemGroup[]>(() => {
    const groups: Record<string, RetirarItem[]> = {};
    for (const item of items) {
      if (!groups[item.position]) groups[item.position] = [];
      groups[item.position].push(item);
    }
    const tier = (g: ItemGroup): number => {
      if (g.items.some((it) => urgentCodes.has(it.articleCode))) return 0;
      if (isUrgentPos(g.position)) return 1;
      return 2;
    };
    return Object.entries(groups)
      .map(([position, groupItems]) => ({ position, items: groupItems }))
      .sort((a, b) => {
        const ta = tier(a);
        const tb = tier(b);
        if (ta !== tb) return ta - tb;
        return posOrder(a.position) - posOrder(b.position);
      });
  }, [items, urgentCodes, isUrgentPos]);

  // Parciales: orden de llegada de cada artículo+OF en toda la nave (Parcial N de M).
  const [parciales, setParciales] = useState<Map<string, ParcialInfo>>(new Map());
  useEffect(() => {
    if (items.length === 0) { setParciales(new Map()); return; }
    let cancelled = false;
    fetchParcialesByPresence(items.map((i) => ({ articleCode: i.articleCode, orderFab: i.orderFab })))
      .then((map) => { if (!cancelled) setParciales(map); })
      .catch(() => { /* no crítico: simplemente no se muestra el badge */ });
    return () => { cancelled = true; };
  }, [items]);

  // La clave incluye itemIndex para garantizar unicidad aunque dos ítems tengan
  // el mismo artículo/OF/posición/presenceId (p.ej. tras duplicación en Firestore).
  const makeKey = (item: RetirarItem) =>
    `${item.articleCode}__${item.orderFab}__${item.position}__${item.presenceId ?? ''}__${item.itemIndex}`;

  const [selected, setSelected] = useState<Set<string>>(() =>
    items.length === 1 ? new Set([makeKey(items[0])]) : new Set()
  );

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(makeKey)));
  }, [selected.size, items]);

  const handleConfirm = () => {
    const chosen = items.filter((i) => selected.has(makeKey(i)));
    if (chosen.length > 0) onConfirm(chosen);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <h2 className="text-lg font-black text-white">📤 Retirar artículo</h2>
        <button onClick={onClose} className="px-4 py-2 min-h-[40px] bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold rounded-xl active:scale-95 transition-all touch-manipulation">
          ✕ Cancelar
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <span className="text-5xl mb-4">📭</span>
          <p className="text-slate-400 font-medium text-lg">No hay artículos en esta estantería</p>
        </div>
      ) : (
        <>
          <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              {items.length} artículo{items.length !== 1 ? 's' : ''} — toca para seleccionar
            </p>
            <button
              onClick={toggleAll}
              className="text-xs text-red-400 font-bold hover:text-red-300 transition-colors"
            >
              {selected.size === items.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {groupedItems.map((group) => (
              <div key={group.position}>
                {/* Encabezado de ubicación */}
                <div className="mb-2 px-2 py-1 flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-300 uppercase tracking-wide">
                    📍 Posición {parseInt(group.position, 10) || group.position}
                  </p>
                  {isUrgentPos(group.position) && (
                    <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-red-200 bg-red-600/30 border border-red-500/50 rounded-md px-1.5 py-0.5">
                      Urgente
                    </span>
                  )}
                </div>
                {/* Artículos en esta ubicación */}
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const key = makeKey(item);
                    const isSelected = selected.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggle(key)}
                        className={`w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.98] ${
                          isSelected
                            ? 'border-red-500/60 bg-red-900/20'
                            : 'border-slate-700 bg-slate-900 hover:border-red-500/30 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected ? 'border-red-500 bg-red-500' : 'border-slate-600'
                          }`}>
                            {isSelected && <span className="text-white text-xs font-black">✓</span>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black text-white text-lg font-mono leading-tight truncate">
                                {item.articleCode}
                              </p>
                              {(() => {
                                const p = item.presenceId ? parciales.get(item.presenceId) : undefined;
                                if (!p || p.total <= 1) return null;
                                return (
                                  <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-amber-300 bg-amber-500/15 border border-amber-500/40 rounded-md px-1.5 py-0.5">
                                    Parcial {p.index}/{p.total}
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="text-sm text-slate-400 font-mono mt-0.5">OF: {item.orderFab}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-4 border-t border-slate-800 bg-slate-950">
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-lg transition-all active:scale-95"
            >
              {selected.size === 0
                ? 'Selecciona artículos'
                : `RETIRAR ${selected.size} artículo${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export type { RetirarItem };
export default RetirarArticleList;
