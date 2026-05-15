
import React, { useState, useMemo } from 'react';
import { HistoryEntry, ActionType } from '../lib/warehouseData';
import { SearchIcon, HistoryIcon, CloseIcon, FilterIcon } from './Icons';
import HistoryTimeline from './HistoryTimeline';
import { downloadHistoryCSV } from '../lib/csv';
import { useRoles } from '../hooks/useRoles';

interface HistoryViewProps {
  history: HistoryEntry[];
}

const HistoryView: React.FC<HistoryViewProps> = ({ history }) => {
  const { canExport } = useRoles();

  // Filters State
  const [filterArticle, setFilterArticle] = useState('');
  const [filterOF, setFilterOF] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterAction, setFilterAction] = useState<ActionType | 'all'>('all');
  
  // Filtering Logic
  const filteredHistory = useMemo(() => {
    return history.filter(entry => {
      // Normalize inputs
      const fArticle = filterArticle.trim().toUpperCase();
      const fOF = filterOF.trim().toUpperCase();
      const fLoc = filterLocation.trim().toUpperCase();

      const matchesArticle = !fArticle || entry.barcode.toUpperCase().includes(fArticle);
      const matchesOF = !fOF || (entry.orderId && entry.orderId.toUpperCase().includes(fOF));
      const matchesLocation = !fLoc || 
                              (entry.fromLocation && entry.fromLocation.toUpperCase().includes(fLoc)) ||
                              (entry.toLocation && entry.toLocation.toUpperCase().includes(fLoc));
      const matchesAction = filterAction === 'all' || entry.action === filterAction;

      return matchesArticle && matchesOF && matchesLocation && matchesAction;
    });
  }, [history, filterArticle, filterOF, filterLocation, filterAction]);

  const isSpecificSearch = filterArticle.length > 0 || filterOF.length > 0 || filterLocation.length > 0;

  // Clear all filters
  const clearFilters = () => {
      setFilterArticle('');
      setFilterOF('');
      setFilterLocation('');
      setFilterAction('all');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center justify-center gap-2 mb-2 text-center">
           <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
              <HistoryIcon className="h-8 w-8" />
           </div>
           <h2 className="text-2xl font-black text-slate-900 dark:text-white">Historial y Trazabilidad</h2>
           <p className="text-slate-500 dark:text-slate-400 text-sm">
              Utiliza los filtros para encontrar movimientos específicos.
          </p>
      </div>

      {/* Advanced Filters Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-4 text-slate-400 dark:text-slate-500 uppercase text-xs font-bold tracking-wider">
              <FilterIcon className="h-4 w-4" /> Filtros de Búsqueda
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filter: Article */}
              <div className="relative">
                  <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">ARTÍCULO</label>
                  <div className="relative flex items-center">
                      <input
                          type="text"
                          placeholder="Código Artículo..."
                          value={filterArticle}
                          onChange={(e) => setFilterArticle(e.target.value)}
                          className="w-full pl-10 pr-10 py-3 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-cyan-500 rounded-xl outline-none font-bold uppercase text-slate-800 dark:text-white transition-all"
                      />
                      <SearchIcon className="absolute left-3 h-5 w-5 text-slate-400"/>
                      {filterArticle && (
                          <button onClick={() => setFilterArticle('')} className="absolute right-3 text-slate-400 hover:text-slate-600">
                              <CloseIcon className="h-4 w-4" />
                          </button>
                      )}
                  </div>
              </div>

              {/* Filter: OF */}
              <div className="relative">
                  <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">OF</label>
                  <div className="relative flex items-center">
                      <input
                          type="text"
                          placeholder="Orden Fabricación..."
                          value={filterOF}
                          onChange={(e) => setFilterOF(e.target.value)}
                          className="w-full pl-10 pr-10 py-3 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-purple-500 rounded-xl outline-none font-bold uppercase text-slate-800 dark:text-white transition-all"
                      />
                      <SearchIcon className="absolute left-3 h-5 w-5 text-slate-400"/>
                      {filterOF && (
                          <button onClick={() => setFilterOF('')} className="absolute right-3 text-slate-400 hover:text-slate-600">
                              <CloseIcon className="h-4 w-4" />
                          </button>
                      )}
                  </div>
              </div>

              {/* Filter: Location */}
              <div className="relative">
                  <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">ESTANTERÍA / UBICACIÓN</label>
                  <div className="relative flex items-center">
                      <input 
                          type="text" 
                          placeholder="Ej: MEC-E1..." 
                          value={filterLocation}
                          onChange={(e) => setFilterLocation(e.target.value)}
                          className="w-full pl-10 pr-10 py-3 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-blue-500 rounded-xl outline-none font-bold uppercase text-slate-800 dark:text-white transition-all"
                      />
                      <SearchIcon className="absolute left-3 h-5 w-5 text-slate-400"/>
                      {filterLocation && (
                          <button onClick={() => setFilterLocation('')} className="absolute right-3 text-slate-400 hover:text-slate-600">
                              <CloseIcon className="h-4 w-4" />
                          </button>
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* Controls & Type Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto max-w-full">
                <button 
                    onClick={() => setFilterAction('all')}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap ${filterAction === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    Todo
                </button>
                <button 
                    onClick={() => setFilterAction('assigned')}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap ${filterAction === 'assigned' ? 'bg-green-600 text-white' : 'text-slate-500 hover:text-green-600'}`}
                >
                    Entradas
                </button>
                <button 
                    onClick={() => setFilterAction('relocated')}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap ${filterAction === 'relocated' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-600'}`}
                >
                    Movimientos
                </button>
            </div>
            
            <div className="flex gap-2 items-center">
                {(isSpecificSearch || filterAction !== 'all') && (
                    <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-bold underline mr-2">
                        Borrar filtros
                    </button>
                )}
                 {canExport() && (
                    <button onClick={() => downloadHistoryCSV(filteredHistory)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-sm hover:bg-slate-300 dark:hover:bg-slate-700 whitespace-nowrap">
                        Exportar CSV
                    </button>
                )}
            </div>
      </div>

      {/* Timeline Results */}
      <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 min-h-[400px]">
          {isSpecificSearch && (
              <div className="mb-8 pb-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                   <div>
                       <h3 className="font-bold text-lg text-purple-600 dark:text-purple-400 mb-1">Resultados de Búsqueda</h3>
                       <p className="text-sm text-slate-500">Mostrando {filteredHistory.length} movimientos encontrados.</p>
                   </div>
              </div>
          )}
          
          <HistoryTimeline history={filteredHistory} isSpecificSearch={isSpecificSearch} />
      </div>

    </div>
  );
};

export default HistoryView;
