/**
 * KioskSearchBar — Barra de búsqueda para el kiosko
 * Gestor de Estanterías WMS v3.0
 *
 * Busca en toda la nave. Muestra fichas visuales con artículo, OF y todas las ubicaciones.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { LogOut, MapPin, Search, X } from 'lucide-react';
import { collection, query as firestoreQuery, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { ShelfLocationState } from '../../hooks/useShelf';
import { useGlobalSearchWithCache, type GlobalSearchResult } from '../../hooks/useGlobalSearchWithCache';
import { SHELF_DEFINITIONS, CART_DEFINITIONS, COLLECTIONS, type HistoryEntryDoc } from '../../lib/firestoreSchema';
import { parseLocationId } from '../../lib/schema/shelves';
import { formatDecimal } from '../../lib/numberFormat';
import { ofLabel } from '../../lib/ofLabel';

interface KioskSearchBarProps {
  locations: ShelfLocationState[];
  /** itemKey = "articleCode|orderFab" del resultado pinchado, para resaltarlo en rosa oscuro dentro de celdas con varios artículos. */
  onHighlight: (positions: string[], itemKey?: string) => void;
  placeholder?: string;
  global?: boolean;
  currentShelfCode?: string;
  canNavigateToShelf?: boolean;
  /** Navega a otra estantería al pinchar un resultado y resalta sus posiciones. */
  onShelfNavigate?: (shelfCode: string, highlightPositions?: string[], itemKey?: string) => void;
  /**
   * Permite navegar a una estantería concreta aunque `canNavigateToShelf` sea
   * false (p.ej. OPERARIO/JEFE solo dentro de sus secciones accesibles).
   * Si devuelve false y tampoco hay `canNavigateToShelf`, se mantiene el
   * comportamiento actual (mostrar la ficha con la ubicación, sin navegar).
   */
  isShelfNavigable?: (shelfCode: string) => boolean;
  onResultSelect?: (result: GlobalSearchResult) => void;
  onOutOfShelfResult?: (result: GlobalSearchResult) => void;
  /** §7bis — Si se pasa, muestra "Solicitar traer" en la ficha del resultado. */
  onSolicitarTraer?: (result: GlobalSearchResult) => void;
  /** Callback para abrir historial de movimientos */
  onOpenHistory?: (articleCode: string, orderFab: string) => void;
  /** Buscador dentro de la cabecera: resultados y ficha flotan sobre el contenido. */
  floating?: boolean;
}

function shelfNameFor(code: string): string {
  const shelf = SHELF_DEFINITIONS.find((s) => s.code === code);
  if (shelf) return shelf.name;
  const cart = CART_DEFINITIONS.find((c) => c.code === code);
  if (cart) return cart.name;
  return code;
}

/**
 * Etiquetas de posición para mostrar: las numéricas como número ("1", formato
 * habitual del buscador) y las con nombre tal cual ("URG MEC-PRE 004", "SUELO").
 * Antes las con nombre daban NaN al hacer parseInt y se perdían → "pos." vacío.
 */
function positionLabels(posStrs: string[]): string[] {
  const nums: number[] = [];
  const named: string[] = [];
  for (const p of posStrs) {
    const idx = p.lastIndexOf('_');
    const raw = (idx >= 0 ? p.slice(idx + 1) : p).trim();
    if (/^\d+$/.test(raw)) nums.push(parseInt(raw, 10));
    else if (raw) named.push(raw);
  }
  return [
    ...[...new Set(nums)].sort((a, b) => a - b).map(String),
    ...[...new Set(named)].sort(),
  ];
}

/**
 * Posición "desnuda" (sin prefijo de estantería) tal y como la espera el grid.
 * Los resultados globales vienen como "SHELF_001"; el grid resalta por "001".
 */
function barePosition(posStr: string): string {
  const idx = posStr.lastIndexOf('_');
  return idx >= 0 ? posStr.slice(idx + 1) : posStr;
}

const KioskSearchBar: React.FC<KioskSearchBarProps> = ({
  locations,
  onHighlight,
  placeholder = 'Buscar artículo o número de OF...',
  global = false,
  currentShelfCode,
  canNavigateToShelf = false,
  onShelfNavigate,
  isShelfNavigable,
  onResultSelect,
  onOutOfShelfResult,
  onOpenHistory,
  onSolicitarTraer,
  floating = false,
}) => {
  const [query, setQuery] = useState('');
  const [resultCount, setResultCount] = useState(0);
  const [selectedResult, setSelectedResult] = useState<GlobalSearchResult | null>(null);
  // Recorrido detectado para resultados ACTIVOS (no-ghost): el hook ya calcula
  // hasMultipleLocations para ghosts, pero para artículos ubicados hay que
  // consultar el historial al seleccionarlos.
  const [activeRecorrido, setActiveRecorrido] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const { results, loading, hasQuery, hasExactShelfMatch, clear, isCached, cacheInfo } = useGlobalSearchWithCache(query, currentShelfCode || '');

  const doSearch = useCallback(
    (searchText: string) => {
      setQuery(searchText);
      setSelectedResult(null);

      if (!searchText.trim()) {
        onHighlight([]);
        setResultCount(0);
        return;
      }

      if (global) {
        setResultCount(0);
        return;
      }

      // Modo local
      const q = searchText.trim().toUpperCase();
      const matchingPositions: string[] = [];
      for (const loc of locations) {
        if (loc.isEmpty || !loc.items || loc.items.length === 0) continue;
        const hasMatch = loc.items.some(
          (item) =>
            (item.articleCode || '').toUpperCase().includes(q) ||
            (item.orderFab || '').toUpperCase().includes(q),
        );
        if (hasMatch) matchingPositions.push(loc.position);
      }
      onHighlight(matchingPositions);
      setResultCount(matchingPositions.length);
    },
    [locations, onHighlight, global],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      setSelectedResult(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(val), 200);
    },
    [doSearch],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setSelectedResult(null);
    onHighlight([]);
    setResultCount(0);
    inputRef.current?.focus();
  }, [onHighlight]);

  const handleResultClick = useCallback((result: GlobalSearchResult) => {
    if (onResultSelect) {
      onResultSelect(result);
      return;
    }
    setSelectedResult(result);
    // El grid resalta por posición "desnuda" (001), no por "SHELF_001".
    const barePositions = result.positions.map(barePosition);
    const itemKey = `${result.articleCode}|${result.orderFab}`;
    if (result.matchesCurrentShelf) {
      onHighlight(barePositions, itemKey);
      return;
    }
    // Resultado en OTRA estantería: navegar y resaltar la celda si el rol puede.
    // - canNavigateToShelf: roles de ámbito total (admin/superadmin/carretillero/solo visual)
    // - isShelfNavigable: roles limitados (operario/jefe) solo en sus secciones accesibles
    const mayNavigate = !!onShelfNavigate &&
      (canNavigateToShelf || (isShelfNavigable?.(result.shelfCode) ?? false));
    if (mayNavigate && onShelfNavigate) {
      onShelfNavigate(result.shelfCode, barePositions, itemKey);
      return;
    }
    // Si no puede navegar, se mantiene el comportamiento actual: la ficha
    // seleccionada muestra en qué estantería/posición está el artículo.
    // El dropdown se oculta solo: showDropdown depende de !selectedResult
    onOutOfShelfResult?.(result);
  }, [onResultSelect, onHighlight, canNavigateToShelf, onShelfNavigate, isShelfNavigable, onOutOfShelfResult]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Al seleccionar un resultado ACTIVO (no-ghost), consultar el historial por
  // articleCode para saber si ha pasado por más de una OF/estantería y así
  // mostrar "🔄 Ver recorrido" en vez de "📋 Historial" también en este caso.
  useEffect(() => {
    if (!selectedResult || selectedResult.isGhost) {
      setActiveRecorrido(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const q = firestoreQuery(
          collection(db, COLLECTIONS.HISTORY),
          where('articleCode', '==', selectedResult.articleCode),
          orderBy('timestamp', 'desc'),
          limit(20),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const shelfCodes = new Set<string>();
        const orderFabs = new Set<string>();
        snap.docs.forEach((d) => {
          const data = d.data() as HistoryEntryDoc;
          if (data.orderFab) orderFabs.add(data.orderFab);
          const loc = data.toLocation || data.fromLocation;
          const parsed = loc ? parseLocationId(loc) : null;
          if (parsed) shelfCodes.add(parsed.shelfCode);
        });
        setActiveRecorrido(shelfCodes.size > 1 || orderFabs.size > 1);
      } catch (err) {
        console.warn('[KioskSearchBar] recorrido check failed', err);
        setActiveRecorrido(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedResult]);

  const showDropdown = global && hasQuery && !loading && !selectedResult;

  return (
    <div className={floating ? 'relative w-full' : 'px-4 pt-2 pb-1'}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl
            text-sm text-slate-900 placeholder-slate-400 shadow-sm
            focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none
            transition-all"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors text-lg"
            aria-label="Limpiar búsqueda"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        )}
      </div>

      {/* En modo flotante (buscador en la cabecera del kiosko) todo lo que va
          bajo el input se superpone a la estantería en vez de empujarla. */}
      <div className={floating ? 'absolute left-0 right-0 top-full z-50 max-h-[75dvh] overflow-y-auto' : ''}>
      {/* Solo avisa si los datos guardados tienen cierta antigüedad (≥ 5 min). */}
      {isCached && cacheInfo && cacheInfo.age !== null && cacheInfo.age >= 5 / 60 && (
        <div className="mt-1 text-xs text-amber-700 flex items-center gap-1">
          Resultados guardados · hace {cacheInfo.age < 1
            ? `${Math.round(cacheInfo.age * 60)} min`
            : `${formatDecimal(cacheInfo.age, 1)} h`}
        </div>
      )}

      {/* Dropdown de resultados */}
      {showDropdown && (
        <div className="mt-1 z-20 relative">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            {results.length === 0 ? (
              <div className="px-4 py-4 text-sm text-slate-500 text-center">
                Sin resultados para <span className="text-slate-900 font-mono">"{query}"</span>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {results.map((result, index) => {
                  const shelf = shelfNameFor(result.shelfCode);
                  const positions = positionLabels(result.positions);

                  // Ghost result: no clickeable, sin navegación
                  if (result.isGhost) {
                    return (
                      <div
                        key={`${result.aggregateKey}-${result.shelfCode}-${index}`}
                        className="w-full text-left px-4 py-3 bg-slate-50 border-l-2 border-dashed border-slate-400"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 text-base font-mono leading-tight truncate">
                              {result.articleCode}
                            </p>
                            {result.orderFab && (
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{ofLabel(result.orderFab)}</p>
                            )}
                            {result.subcontratacion && (
                              <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-500 text-white">Subcontratación</span>
                            )}
                          </div>
                          <span className="shrink-0 text-[10px] bg-slate-200 text-slate-700 border border-slate-300 rounded-full px-1.5 py-0.5 font-bold mt-0.5">
                            Sin ubicación
                          </span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {result.lastLocation && (
                            <div className="flex items-baseline gap-1.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0 self-center" aria-hidden />
                              <span className="text-xs text-slate-600">
                                Última ubicación: {shelfNameFor(result.lastLocation.shelfCode)}
                                <span className="text-slate-400 mx-1">·</span>
                                pos. {result.lastLocation.position}
                                <span className="text-slate-400 mx-1">·</span>
                                <span className="text-[10px]">{new Date(result.lastLocation.timestamp).toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                              </span>
                            </div>
                          )}
                          {result.lastWithdrawal && (
                            <div className="flex items-baseline gap-1.5">
                              <LogOut className="w-3 h-3 text-slate-400 shrink-0 self-center" aria-hidden />
                              <span className="text-xs text-slate-600">
                                Última retirada: {shelfNameFor(result.lastWithdrawal.shelfCode)}
                                <span className="text-slate-400 mx-1">·</span>
                                pos. {result.lastWithdrawal.position}
                                <span className="text-slate-400 mx-1">·</span>
                                <span className="text-[10px]">{new Date(result.lastWithdrawal.timestamp).toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={`${result.aggregateKey}-${result.shelfCode}-${index}`}
                      className={`
                        w-full text-left px-4 py-3 hover:bg-sky-50 transition-colors
                        ${result.matchesCurrentShelf ? 'border-l-2 border-emerald-500' : ''}
                      `}
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 text-base font-mono leading-tight truncate">
                            {result.articleCode}
                          </p>
                          {result.orderFab && (
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{ofLabel(result.orderFab)}</p>
                          )}
                          {result.subcontratacion && (
                            <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-500 text-white">Subcontratación</span>
                          )}
                        </div>
                        {result.matchesCurrentShelf && (
                          <span className="shrink-0 text-[11px] bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full px-2 py-0.5 font-bold mt-0.5">
                            Aquí
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0 self-center" aria-hidden />
                        <span className="text-xs text-slate-500">
                          {shelf}
                          <span className="text-slate-300 mx-1">·</span>
                          {positions.length > 0 && `pos. ${positions.join(', ')}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ficha seleccionada — se muestra al hacer click en un resultado */}
      {selectedResult && (
        <div className={`
          mt-2 rounded-2xl border p-3 relative shadow-sm
          ${selectedResult.isGhost
            ? 'bg-slate-50 border-dashed border-slate-400'
            : selectedResult.matchesCurrentShelf
            ? 'bg-emerald-50 border-emerald-300'
            : 'bg-white border-slate-200'}
        `}>
          <button
            onClick={handleClear}
            className="absolute top-2 right-2 text-slate-400 hover:text-slate-700 text-sm p-1"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
          <div className="pr-6">
            <p className="font-black text-slate-900 text-lg font-mono leading-tight">
              {selectedResult.articleCode}
            </p>
            {selectedResult.orderFab && (
              <p className="text-xs text-slate-500 font-mono mt-0.5">{ofLabel(selectedResult.orderFab)}</p>
            )}
            {selectedResult.isGhost && (
              <p className="text-xs text-slate-600 mt-1">Sin ubicación activa</p>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
            {selectedResult.isGhost ? (
              <>
                {selectedResult.lastLocation && (
                  <div className="flex items-baseline gap-2">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0 self-center" aria-hidden />
                    <div>
                      <span className="text-xs font-bold text-slate-700">Última ubicación</span>
                      <span className="text-xs text-slate-600 ml-1">
                        {shelfNameFor(selectedResult.lastLocation.shelfCode)} — posición {selectedResult.lastLocation.position}
                      </span>
                      {selectedResult.lastLocation.operarioName && (
                        <span className="text-[10px] text-slate-500 ml-1 block">
                          Ubicado por: {selectedResult.lastLocation.operarioName}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 ml-1">
                        {new Date(selectedResult.lastLocation.timestamp).toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                )}
                {selectedResult.lastWithdrawal && (
                  <div className="flex items-baseline gap-2">
                    <LogOut className="w-3 h-3 text-slate-400 shrink-0 self-center" aria-hidden />
                    <div>
                      <span className="text-xs font-bold text-slate-700">Última retirada</span>
                      <span className="text-xs text-slate-600 ml-1">
                        {shelfNameFor(selectedResult.lastWithdrawal.shelfCode)} — posición {selectedResult.lastWithdrawal.position}
                      </span>
                      {selectedResult.lastWithdrawal.operarioName && (
                        <span className="text-[10px] text-slate-500 ml-1 block">
                          Retirado por: {selectedResult.lastWithdrawal.operarioName}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 ml-1">
                        {new Date(selectedResult.lastWithdrawal.timestamp).toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Agrupar posiciones por estantería */}
                {(() => {
                  // Agrupar: { shelfCode → positions[] }
                  const byShelf: Record<string, string[]> = {};
                  for (const posStr of selectedResult.positions) {
                    const idx = posStr.lastIndexOf('_');
                    const sc = idx >= 0 ? posStr.slice(0, idx) : selectedResult.shelfCode;
                    (byShelf[sc] ??= []).push(posStr);
                  }
                  return Object.entries(byShelf).map(([sc, list]) => [sc, positionLabels(list)] as const).map(([sc, nums]) => (
                    <div key={sc} className="flex items-baseline gap-2">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0 self-center" aria-hidden />
                      <div>
                        <span className="text-xs font-bold text-slate-700">{shelfNameFor(sc)}</span>
                        <span className="text-xs text-slate-500 ml-1">
                          {nums.length === 0 ? '' : nums.length === 1 ? `— posición ${nums[0]}` : `— posiciones ${nums.join(', ')}`}
                        </span>
                      </div>
                    </div>
                  ));
                })()}
              </>
            )}
          </div>
          {!selectedResult.isGhost && !selectedResult.matchesCurrentShelf && (
            <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
              Artículo fuera de esta estantería
            </div>
          )}
          <div className="mt-3 flex gap-2">
            {onOpenHistory && (() => {
              const hasRecorrido = selectedResult.isGhost
                ? !!selectedResult.hasMultipleLocations
                : activeRecorrido;
              return (
                <button
                  onClick={() => onOpenHistory(selectedResult.articleCode, selectedResult.orderFab)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold active:scale-[0.98] transition-all touch-manipulation ${
                    hasRecorrido
                      ? 'bg-violet-600 hover:bg-violet-500 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
                >
                  {hasRecorrido ? 'Ver recorrido' : 'Historial'}
                </button>
              );
            })()}
            {onSolicitarTraer && (
              <button
                onClick={() => onSolicitarTraer(selectedResult)}
                className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-white py-2.5 text-sm font-bold active:scale-[0.98] transition-all touch-manipulation"
              >
                Solicitar traer
              </button>
            )}
          </div>
        </div>
      )}

      {(!global || !hasQuery || loading) && query.trim() && !selectedResult && (
        <p className={`text-xs mt-1 ml-1 text-slate-500 ${floating ? 'bg-white rounded-lg px-2 py-1 shadow w-fit' : ''}`}>
          {resultCount === 0
            ? 'Sin resultados'
            : `${resultCount} ubicación${resultCount === 1 ? '' : 'es'} encontrada${resultCount === 1 ? '' : 's'}`}
        </p>
      )}
      </div>
    </div>
  );
};

export default KioskSearchBar;


