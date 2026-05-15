/**
 * KioskSearchBar — Barra de búsqueda para el kiosko
 * Gestor de Estanterías WMS v3.0
 *
 * Busca por código de artículo o número de OF en las ubicaciones.
 * Resalta las posiciones encontradas en el grid.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ShelfLocationState } from '../../hooks/useShelf';
import { useGlobalSearchWithCache, type GlobalSearchResult } from '../../hooks/useGlobalSearchWithCache';

interface KioskSearchBarProps {
  /** Todas las ubicaciones de la estantería actual */
  locations: ShelfLocationState[];
  /** Callback cuando se encuentran posiciones que coinciden */
  onHighlight: (positions: string[]) => void;
  /** Placeholder personalizado */
  placeholder?: string;
  
  /** Modo global (busca en todas las estanterías) */
  global?: boolean;
  /** Código de la estantería actual para filtrado y navegación */
  currentShelfCode?: string;
  /** Permite navegar a otras estanterías */
  canNavigateToShelf?: boolean;
  /** Callback para navegar a una estantería diferente */
  onShelfNavigate?: (shelfCode: string) => void;
  /** Callback cuando se selecciona un resultado (opcional, para sobrescribir comportamiento por defecto) */
  onResultSelect?: (result: GlobalSearchResult) => void;
  /** Callback opcional para mostrar aviso cuando el resultado está fuera de la estantería actual */
  onOutOfShelfResult?: (result: GlobalSearchResult) => void;
}

const KioskSearchBar: React.FC<KioskSearchBarProps> = ({
  locations,
  onHighlight,
  placeholder = 'Buscar por artículo o OF...',
  global = false,
  currentShelfCode,
  canNavigateToShelf = false,
  onShelfNavigate,
  onResultSelect,
  onOutOfShelfResult,
}) => {
  const [query, setQuery] = useState('');
  const [resultCount, setResultCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const { results, loading, hasQuery, hasExactShelfMatch, clear, isCached, cacheInfo } = useGlobalSearchWithCache(query, currentShelfCode || '');

  const doSearch = useCallback(
    (searchText: string) => {
      setQuery(searchText);
      
      if (!searchText.trim()) {
        onHighlight([]);
        setResultCount(0);
        return;
      }

      if (global) {
        // En modo global, no llamamos directamente a onHighlight
        // Los resultados se manejan a través del hook y se muestran en el dropdown
        setResultCount(0); // Reset count for global mode
        return;
      }

      // Modo local (comportamiento original)
      const q = searchText.trim().toUpperCase();
      const matchingPositions: string[] = [];

      for (const loc of locations) {
        if (loc.isEmpty || !loc.items || loc.items.length === 0) continue;
        const hasMatch = loc.items.some(
          (item) =>
            (item.articleCode || '').toUpperCase().includes(q) ||
            (item.orderFab || '').toUpperCase().includes(q),
        );
        if (hasMatch) {
          matchingPositions.push(loc.position);
        }
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

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(val), 200);
    },
    [doSearch],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    onHighlight([]);
    setResultCount(0);
    inputRef.current?.focus();
  }, [onHighlight]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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
       
       {/* Cache indicator */}
       {isCached && cacheInfo && (
         <div className="mt-1 text-xs text-amber-300 flex items-center gap-1">
           📦 Búsqueda en caché {cacheInfo.age !== null && `(${cacheInfo.age.toFixed(1)}h)`}
         </div>
       )}

       {/* Global search dropdown */}
       {global && hasQuery && !loading && (
         <div className="absolute left-0 right-0 mt-1 z-20">
           <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg z-50 w-full">
             {results.length === 0 ? (
               <div className="px-3 py-2 text-xs text-slate-400">
                 No se encontraron resultados para "{query}"
               </div>
             ) : (
               <div className="max-h-60 overflow-y-auto">
                 {results.map((result, index) => (
                   <div
                     key={`${result.aggregateKey}-${result.shelfCode}-${index}`}
                     className={`
                       px-3 py-2 cursor-pointer hover:bg-slate-700
                       ${result.matchesCurrentShelf ? 'border-l-2 border-emerald-400' : ''}
                     `}
                     onClick={() => {
                       if (onResultSelect) {
                         onResultSelect(result);
                       } else {
                         // Comportamiento por defecto
                         if (result.matchesCurrentShelf) {
                           // Resaltar en estantería actual
                           onHighlight(result.positions);
                         } else if (canNavigateToShelf && onShelfNavigate) {
                           // Navegar a otra estantería
                           onShelfNavigate(result.shelfCode);
                         } else if (onOutOfShelfResult) {
                           // Mostrar aviso
                           onOutOfShelfResult(result);
                         }
                       }
                     }}
                   >
                     <div className="flex justify-between">
                       <div>
                         <div className="font-mono text-xs">
                           {result.articleCode} {result.orderFab}
                         </div>
                         {!result.matchesCurrentShelf && (
                           <div className="text-[10px] text-slate-400 italic">
                             Estantería: {result.shelfCode}
                           </div>
                         )}
                       </div>
                       <div className="text-[10px] text-slate-400">
                         {result.positions.length} pos.
                       </div>
                     </div>
                     {!result.matchesCurrentShelf && result.positions.length > 0 && (
                       <div className="mt-1 text-[9px] text-slate-500">
                         {result.positions.slice(0, 3).join(', ')}{result.positions.length > 3 ? '...' : ''}
                       </div>
                     )}
                   </div>
                 ))}
               </div>
             )}
           </div>
         </div>
       )}
       
       {(!global || !hasQuery || loading) && query.trim() && (
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
