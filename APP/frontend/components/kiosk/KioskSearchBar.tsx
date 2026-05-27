/**
 * KioskSearchBar — Barra de búsqueda para el kiosko
 * Gestor de Estanterías WMS v3.0
 *
 * Busca en toda la nave. Muestra fichas visuales con artículo, OF y todas las ubicaciones.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ShelfLocationState } from '../../hooks/useShelf';
import { useGlobalSearchWithCache, type GlobalSearchResult } from '../../hooks/useGlobalSearchWithCache';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';

interface KioskSearchBarProps {
  locations: ShelfLocationState[];
  onHighlight: (positions: string[]) => void;
  placeholder?: string;
  global?: boolean;
  currentShelfCode?: string;
  canNavigateToShelf?: boolean;
  onShelfNavigate?: (shelfCode: string) => void;
  onResultSelect?: (result: GlobalSearchResult) => void;
  onOutOfShelfResult?: (result: GlobalSearchResult) => void;
}

function shelfNameFor(code: string): string {
  return SHELF_DEFINITIONS.find((s) => s.code === code)?.name || code;
}

function positionNumber(posStr: string): number {
  const idx = posStr.lastIndexOf('_');
  const raw = idx >= 0 ? posStr.slice(idx + 1) : posStr;
  return parseInt(raw, 10);
}

const KioskSearchBar: React.FC<KioskSearchBarProps> = ({
  locations,
  onHighlight,
  placeholder = 'Buscar artículo o número de OF...',
  global = false,
  currentShelfCode,
  canNavigateToShelf = false,
  onShelfNavigate,
  onResultSelect,
  onOutOfShelfResult,
}) => {
  const [query, setQuery] = useState('');
  const [resultCount, setResultCount] = useState(0);
  const [selectedResult, setSelectedResult] = useState<GlobalSearchResult | null>(null);
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
    if (result.matchesCurrentShelf) {
      onHighlight(result.positions);
    } else if (canNavigateToShelf && onShelfNavigate) {
      onShelfNavigate(result.shelfCode);
    }
    // Cerrar el dropdown
    setQuery(prev => prev); // mantener el texto pero ocultar dropdown actualizando estado sin cambiar query
  }, [onResultSelect, onHighlight, canNavigateToShelf, onShelfNavigate]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const showDropdown = global && hasQuery && !loading && !selectedResult;

  return (
    <div className="px-4 pt-2 pb-1">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg pointer-events-none">
          🔍
        </span>
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
          className="w-full pl-10 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl
            text-sm text-white placeholder-slate-500
            focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none
            transition-all"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors text-lg"
            aria-label="Limpiar búsqueda"
          >
            ✕
          </button>
        )}
      </div>

      {isCached && cacheInfo && (
        <div className="mt-1 text-xs text-amber-300 flex items-center gap-1">
          📦 Búsqueda en caché {cacheInfo.age !== null && `(${cacheInfo.age.toFixed(1)}h)`}
        </div>
      )}

      {/* Dropdown de resultados */}
      {showDropdown && (
        <div className="mt-1 z-20 relative">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">
            {results.length === 0 ? (
              <div className="px-4 py-4 text-sm text-slate-400 text-center">
                Sin resultados para <span className="text-white font-mono">"{query}"</span>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
                {results.map((result, index) => {
                  const shelf = shelfNameFor(result.shelfCode);
                  const positions = result.positions
                    .map((p) => positionNumber(p))
                    .filter((n) => !Number.isNaN(n))
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .sort((a, b) => a - b);

                  return (
                    <button
                      key={`${result.aggregateKey}-${result.shelfCode}-${index}`}
                      className={`
                        w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors
                        ${result.matchesCurrentShelf ? 'border-l-2 border-emerald-400' : ''}
                      `}
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-black text-white text-base font-mono leading-tight truncate">
                            {result.articleCode}
                          </p>
                          {result.orderFab && (
                            <p className="text-xs text-slate-400 font-mono mt-0.5">OF: {result.orderFab}</p>
                          )}
                        </div>
                        {result.matchesCurrentShelf && (
                          <span className="shrink-0 text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-1.5 py-0.5 font-bold mt-0.5">
                            Esta
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <span className="text-[10px] text-slate-500">📍</span>
                        <span className="text-xs text-slate-400">
                          {shelf}
                          <span className="text-slate-600 mx-1">·</span>
                          {positions.length === 1
                            ? `pos. ${positions[0]}`
                            : `pos. ${positions.join(', ')}`}
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
          mt-2 rounded-2xl border p-3 relative
          ${selectedResult.matchesCurrentShelf
            ? 'bg-emerald-950/30 border-emerald-500/30'
            : 'bg-slate-900/80 border-slate-700'}
        `}>
          <button
            onClick={handleClear}
            className="absolute top-2 right-2 text-slate-500 hover:text-white text-sm p-1"
          >
            ✕
          </button>
          <div className="pr-6">
            <p className="font-black text-white text-lg font-mono leading-tight">
              {selectedResult.articleCode}
            </p>
            {selectedResult.orderFab && (
              <p className="text-xs text-slate-400 font-mono mt-0.5">OF: {selectedResult.orderFab}</p>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1">
            {/* Agrupar posiciones por estantería */}
            {(() => {
              // Agrupar: { shelfCode → positions[] }
              const byShelf: Record<string, number[]> = {};
              for (const posStr of selectedResult.positions) {
                const idx = posStr.lastIndexOf('_');
                const sc = idx >= 0 ? posStr.slice(0, idx) : selectedResult.shelfCode;
                const num = positionNumber(posStr);
                if (!byShelf[sc]) byShelf[sc] = [];
                if (!Number.isNaN(num)) byShelf[sc].push(num);
              }
              return Object.entries(byShelf).map(([sc, nums]) => (
                <div key={sc} className="flex items-baseline gap-2">
                  <span className="text-[10px] text-slate-500">📍</span>
                  <div>
                    <span className="text-xs font-bold text-slate-300">{shelfNameFor(sc)}</span>
                    <span className="text-xs text-slate-500 ml-1">
                      {nums.length === 1 ? `— posición ${nums[0]}` : `— posiciones ${nums.sort((a,b)=>a-b).join(', ')}`}
                    </span>
                  </div>
                </div>
              ));
            })()}
          </div>
          {!selectedResult.matchesCurrentShelf && (
            <div className="mt-2 text-[10px] text-amber-400/80 bg-amber-500/5 rounded-lg px-2 py-1">
              Artículo fuera de esta estantería
            </div>
          )}
        </div>
      )}

      {(!global || !hasQuery || loading) && query.trim() && !selectedResult && (
        <p className="text-xs mt-1 ml-1 text-slate-500">
          {resultCount === 0
            ? 'Sin resultados'
            : `${resultCount} ubicación${resultCount === 1 ? '' : 'es'} encontrada${resultCount === 1 ? '' : 's'}`}
        </p>
      )}
    </div>
  );
};

export default KioskSearchBar;


