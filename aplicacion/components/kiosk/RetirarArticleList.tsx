import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Check, Search } from 'lucide-react';
import { parseScanInput } from '../../lib/qrParser';
import { canonicalOrderFab } from '../../lib/erp/ofNormalize';
import type { ShelfLocationState } from '../../hooks/useShelf';
import { isUrgentLocation } from '../../lib/firestoreSchema';
import type { UrgentAlert } from '../../lib/firestoreSchema';
import { fetchParcialesByPresence, type ParcialInfo } from '../../lib/parciales';
import { ofLabel } from '../../lib/ofLabel';

/** Valor numérico de una posición para ordenar (acepta "012" o "URG MEC-PRE 001"). */
const posOrder = (position: string): number => {
  const n = parseInt(position, 10);
  if (!Number.isNaN(n)) return n;
  const m = position.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
};

/** A partir de cuántos artículos se pide una segunda confirmación. */
const CONFIRM_THRESHOLD = 3;

interface RetirarItem {
  articleCode: string;
  orderFab: string;
  position: string;
  presenceId?: string;
  /** Fecha de llegada: presencias con la misma son UNA pieza en varios huecos. */
  locatedAt?: string;
  /** Índice único dentro del array de items (garantiza clave única aunque haya duplicados) */
  itemIndex: number;
}

/**
 * Una fila de la lista = una PIEZA. Una pieza grande ubicada a la vez en varios
 * huecos (mismo artículo+OF+locatedAt) sale una sola vez y se retira de todos
 * sus huecos; antes salía repetida y retirar solo una fila dejaba la otra
 * mitad como fantasma.
 */
interface RetirarRow {
  key: string;
  lead: RetirarItem;
  members: RetirarItem[];
}

interface RetirarArticleListProps {
  locations: ShelfLocationState[];
  shelfCode: string;
  onConfirm: (items: RetirarItem[]) => void;
  onClose: () => void;
  urgentAlerts?: UrgentAlert[];
}

interface RowGroup {
  position: string;
  rows: RetirarRow[];
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
          locatedAt: item.locatedAt,
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

  // La clave incluye itemIndex para garantizar unicidad aunque dos ítems tengan
  // el mismo artículo/OF/posición/presenceId (p.ej. tras duplicación en Firestore).
  const makeKey = (item: RetirarItem) =>
    `${item.articleCode}__${item.orderFab}__${item.position}__${item.presenceId ?? ''}__${item.itemIndex}`;

  // Piezas: presencias del mismo artículo+OF con el mismo locatedAt = una pieza.
  const rows = useMemo<RetirarRow[]>(() => {
    const byPiece = new Map<string, RetirarItem[]>();
    for (const item of items) {
      const pieceKey = item.locatedAt
        ? `${item.articleCode}__${item.orderFab}__${item.locatedAt}`
        : makeKey(item);
      if (!byPiece.has(pieceKey)) byPiece.set(pieceKey, []);
      byPiece.get(pieceKey)!.push(item);
    }
    return [...byPiece.values()].map((members) => {
      const sorted = [...members].sort((a, b) => posOrder(a.position) - posOrder(b.position));
      return { key: makeKey(sorted[0]), lead: sorted[0], members: sorted };
    });
  }, [items]);

  // Agrupar por ubicación (la del primer hueco de cada pieza) y ordenar:
  //   1) artículos con alerta urgente (si los hay),
  //   2) ubicaciones URGENTES de la sección,
  //   3) resto.
  // Dentro de cada nivel, en orden numérico de posición.
  const groupedRows = useMemo<RowGroup[]>(() => {
    const groups: Record<string, RetirarRow[]> = {};
    for (const row of rows) {
      const pos = row.lead.position;
      if (!groups[pos]) groups[pos] = [];
      groups[pos].push(row);
    }
    const tier = (g: RowGroup): number => {
      if (g.rows.some((r) => urgentCodes.has(r.lead.articleCode))) return 0;
      if (isUrgentPos(g.position)) return 1;
      return 2;
    };
    return Object.entries(groups)
      .map(([position, groupRows]) => ({ position, rows: groupRows }))
      .sort((a, b) => {
        const ta = tier(a);
        const tb = tier(b);
        if (ta !== tb) return ta - tb;
        return posOrder(a.position) - posOrder(b.position);
      });
  }, [rows, urgentCodes, isUrgentPos]);

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

  // Selección por PIEZA (clave de la fila).
  const [selected, setSelected] = useState<Set<string>>(() =>
    rows.length === 1 ? new Set([rows[0].key]) : new Set()
  );

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Buscador / escaneo ─────────────────────────────────────────────────────
  // En estanterías grandes (Zincado ~350 filas) buscar a ojo era inviable.
  // Escribir filtra la lista; escanear la etiqueta (pistola: texto + Enter)
  // marca directamente la pieza.
  const [query, setQuery] = useState('');
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toUpperCase().replace(/\s+/g, '');
  const matchesQuery = useCallback((row: RetirarRow) =>
    !q
    || row.lead.articleCode.toUpperCase().replace(/\s+/g, '').includes(q)
    || row.lead.orderFab.toUpperCase().replace(/\s+/g, '').includes(q),
  [q]);
  const visibleRows = useMemo(() => rows.filter(matchesQuery), [rows, matchesQuery]);
  const visibleGroups = useMemo(
    () => groupedRows
      .map((g) => ({ ...g, rows: g.rows.filter(matchesQuery) }))
      .filter((g) => g.rows.length > 0),
    [groupedRows, matchesQuery],
  );

  // Con pistola el campo tiene que tener el foco; en tablet táctil no, para no
  // sacar el teclado en pantalla nada más abrir.
  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) searchRef.current?.focus();
  }, []);

  const selectKeys = (keys: string[]) =>
    setSelected((prev) => new Set([...prev, ...keys]));

  const handleSearchEnter = () => {
    const raw = query.trim();
    if (!raw) return;
    const parsed = parseScanInput(raw);
    if (parsed.success) {
      const { articleCode, orderFab } = parsed.data;
      const hits = rows.filter((r) =>
        r.lead.articleCode.toUpperCase() === articleCode && canonicalOrderFab(r.lead.orderFab) === orderFab);
      if (hits.length > 0) {
        selectKeys(hits.map((r) => r.key));
        setScanMsg({ ok: true, text: `${articleCode} marcado${hits.length > 1 ? ` (${hits.length} parciales)` : ''}` });
      } else {
        setScanMsg({ ok: false, text: `${articleCode} ${orderFab} no está en esta estantería` });
      }
      setQuery('');
      return;
    }
    // Texto normal: si el filtro deja una sola pieza, Enter la marca.
    if (visibleRows.length === 1) {
      selectKeys([visibleRows[0].key]);
      setScanMsg({ ok: true, text: `${visibleRows[0].lead.articleCode} marcado` });
      setQuery('');
    }
  };

  // "Seleccionar todo" actúa sobre lo que se ve (la lista filtrada, si hay filtro).
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.key));
  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleRows.forEach((r) => next.delete(r.key));
      else visibleRows.forEach((r) => next.add(r.key));
      return next;
    });
  }, [allVisibleSelected, visibleRows]);

  // Retirar muchos de golpe (p. ej. "Seleccionar todo") pide una segunda
  // confirmación con el recuento: un toque accidental vaciaba la estantería.
  const [confirmingMany, setConfirmingMany] = useState(false);
  const chosenRows = useMemo(() => rows.filter((r) => selected.has(r.key)), [rows, selected]);
  // Se retira cada presencia (todos los huecos de cada pieza elegida).
  const chosenItems = useMemo(() => chosenRows.flatMap((r) => r.members), [chosenRows]);

  const handleConfirm = () => {
    if (chosenItems.length === 0) return;
    if (chosenRows.length > CONFIRM_THRESHOLD && !confirmingMany) {
      setConfirmingMany(true);
      return;
    }
    onConfirm(chosenItems);
  };

  if (confirmingMany) {
    const positions = new Set(chosenItems.map((i) => i.position)).size;
    const all = chosenRows.length === rows.length;
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm" role="alertdialog" aria-labelledby="retirar-many-title">
        <div className="px-4 py-5 border-b border-slate-800 text-center">
          <h2 id="retirar-many-title" className="text-2xl font-black text-white">
            ¿Retirar {chosenRows.length} artículos?
          </h2>
          <p className="text-sm text-red-300 font-bold mt-1">
            {all ? 'Es TODA la estantería' : `De ${positions} posicion${positions !== 1 ? 'es' : ''}`} · no se puede deshacer
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          {chosenRows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-3 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
              <span className="font-mono font-bold text-white truncate">{row.lead.articleCode}</span>
              <span className="shrink-0 text-xs text-slate-400 font-mono">pos. {row.members.map((m) => m.position).join(' + ')}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-4 border-t border-slate-800 bg-slate-950 grid gap-2">
          <button
            onClick={() => onConfirm(chosenItems)}
            className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-lg transition-all active:scale-95"
          >
            SÍ, RETIRAR {chosenRows.length}
          </button>
          <button
            onClick={() => setConfirmingMany(false)}
            className="w-full h-12 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-bold transition-all active:scale-95"
          >
            No, volver a la lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <h2 className="text-xl font-black text-white">Retirar artículo</h2>
        <button onClick={onClose} className="px-4 py-2 min-h-[40px] bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold rounded-xl active:scale-95 transition-all touch-manipulation">
          ✕ Cancelar
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="text-slate-400 font-medium text-lg">No hay artículos en esta estantería</p>
        </div>
      ) : (
        <>
          <div className="px-4 pt-3 pb-2 border-b border-slate-800 space-y-1.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" aria-hidden />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setScanMsg(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchEnter(); } }}
                placeholder="Buscar artículo u OF, o escanear la etiqueta"
                aria-label="Buscar artículo u OF, o escanear la etiqueta"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="w-full h-12 pl-10 pr-10 bg-slate-800 border border-slate-600 rounded-xl text-base text-white placeholder-slate-500 font-mono focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); setScanMsg(null); searchRef.current?.focus(); }}
                  aria-label="Borrar búsqueda"
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 text-slate-400 hover:text-white text-lg"
                >
                  ✕
                </button>
              )}
            </div>
            {scanMsg && (
              <p role="status" className={`text-sm font-bold ${scanMsg.ok ? 'text-emerald-400' : 'text-amber-300'}`}>{scanMsg.text}</p>
            )}
          </div>

          <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              {q
                ? `${visibleRows.length} de ${rows.length} artículos`
                : `${rows.length} artículo${rows.length !== 1 ? 's' : ''} — toca para seleccionar`}
              {selected.size > 0 && <span className="text-red-300"> · {selected.size} marcado{selected.size !== 1 ? 's' : ''}</span>}
            </p>
            <button
              onClick={toggleAll}
              disabled={visibleRows.length === 0}
              className="shrink-0 min-h-10 px-3 rounded-xl border border-red-500/50 text-sm text-red-300 font-bold hover:bg-red-500/10 active:scale-95 transition-all disabled:opacity-40"
            >
              {allVisibleSelected ? 'Deseleccionar' : 'Seleccionar'} {q ? 'estos' : 'todo'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {visibleGroups.length === 0 && (
              <p className="text-center text-slate-400 py-10">Ningún artículo coincide con «{query}»</p>
            )}
            {visibleGroups.map((group) => (
              <div key={group.position}>
                {/* Encabezado de ubicación */}
                <div className="mb-2 px-2 py-1 flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-300 uppercase tracking-wide">
                    Posición {parseInt(group.position, 10) || group.position}
                  </p>
                  {isUrgentPos(group.position) && (
                    <span className="shrink-0 text-[11px] font-black uppercase tracking-wide text-red-200 bg-red-600/30 border border-red-500/50 rounded-md px-1.5 py-0.5">
                      Urgente
                    </span>
                  )}
                </div>
                {/* Artículos en esta ubicación */}
                <div className="space-y-2">
                  {group.rows.map((row) => {
                    const { key, lead: item } = row;
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
                          <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected ? 'border-red-500 bg-red-500' : 'border-slate-600'
                          }`}>
                            {isSelected && <Check className="w-5 h-5 text-white" strokeWidth={3.5} aria-hidden />}
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
                                  <span className="shrink-0 text-[11px] font-black uppercase tracking-wide text-amber-300 bg-amber-500/15 border border-amber-500/40 rounded-md px-1.5 py-0.5">
                                    Parcial {p.index}/{p.total}
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="text-sm text-slate-400 font-mono mt-0.5">{ofLabel(item.orderFab)}</p>
                            {row.members.length > 1 && (
                              <p className="text-xs font-bold text-sky-300 mt-1">
                                Ocupa {row.members.length} huecos: pos. {row.members.map((m) => m.position).join(' + ')} · se retira de todos
                              </p>
                            )}
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
