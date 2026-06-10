

import React, { useState, useMemo, useEffect } from 'react';
import { Assignments, LocationId } from '../lib/warehouseData';
import { WarehouseConfig } from '../hooks/useWarehouseConfig';
import { CloseIcon, InfoIcon, MultiLayerIcon, PlusCircleIcon, ScannerIcon, CheckIcon } from './Icons';
import { generateLayoutLocations } from '../lib/warehouseLayout';

interface AssignmentModalProps {
  barcode: string;
  orderId: string; 
  onAssign: (barcode: string, locationOrLocations: LocationId | LocationId[]) => void;
  onClose: () => void;
  onScanRequest?: () => void;
  onFinishProduction?: () => void;
  assignments: Assignments;
  config: WarehouseConfig; 
  isBatchMode?: boolean; // New Prop for Batch Logic
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({ barcode, orderId, onAssign, onClose, onScanRequest, onFinishProduction, assignments, config, isBatchMode = false }) => {
  const [selectedLocations, setSelectedLocations] = useState<LocationId[]>([]);
  const [activeWarehouse, setActiveWarehouse] = useState<string>(config.warehouses[0]?.code || '');
  const [isMultiSlotMode, setIsMultiSlotMode] = useState(isBatchMode); // Default to multi if batch

  // Reset selected locations when barcode changes
  useEffect(() => {
    setSelectedLocations([]);
  }, [barcode, orderId]);

  const handleLocationClick = (locId: LocationId) => {
      // In batch mode or Multi-Ub mode, we allow multi-select
      if (isMultiSlotMode || isBatchMode) {
          setSelectedLocations(prev => 
              prev.includes(locId) 
                  ? prev.filter(l => l !== locId) 
                  : [...prev, locId]
          );
      } else {
          setSelectedLocations([locId]);
      }
  };

  const isAlreadyAssigned = useMemo(() => {
    // Only relevant for single item mode
    if (isBatchMode) return false;
    for (const loc in assignments) {
      if (assignments[loc as LocationId].some(i => i.barcode === barcode && i.orderId === orderId)) {
        return true;
      }
    }
    return false;
  }, [assignments, barcode, orderId, isBatchMode]);

  const groupedLocations = useMemo(() => {
    const allLocations = generateLayoutLocations(activeWarehouse);

    const shelfFromLocation = (locId: string) => {
      const parts = locId.split('-');
      if (parts.length < 3) return 'General';
      if (parts[1] === 'E' && parts[2]) return parts[2];
      if (parts[1].startsWith('E')) return parts[1].slice(1) || parts[1];
      return parts[1] || 'General';
    };

    const grouped: Record<string, LocationId[]> = {};
    allLocations.forEach((locId) => {
      const shelf = shelfFromLocation(locId);
      if (!grouped[shelf]) grouped[shelf] = [];
      grouped[shelf].push(locId);
    });

    Object.keys(grouped).forEach((shelf) => {
      grouped[shelf].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    });

    return grouped;
  }, [activeWarehouse]);

  return (
    <div className="fixed inset-0 bg-white md:bg-black/90 z-50 flex items-center justify-center md:p-4" role="dialog" aria-modal="true">
      <div className="relative w-full h-full md:h-auto md:max-w-5xl bg-white dark:bg-slate-900 md:rounded-2xl shadow-2xl flex flex-col max-h-full md:max-h-[95vh] overflow-hidden">
        
        <header className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 z-10 shrink-0">
          <div>
             <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">{isBatchMode ? 'Selección Múltiple' : 'Asignar'}: <span className="text-cyan-600 dark:text-cyan-400 break-all">{barcode}</span></h2>
             <div className="flex items-center gap-2 mt-1">
                 {!isBatchMode && <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-xs font-bold px-2 py-0.5 rounded uppercase">OF: {orderId}</span>}
                 {isBatchMode && <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 text-xs font-bold px-2 py-0.5 rounded uppercase">SELECCIONA LAS UBICACIONES</span>}
             </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {onScanRequest && (
                <button 
                    onClick={onScanRequest}
                    className="flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs md:text-sm transition-all touch-manipulation"
                    title="Escanear Etiqueta"
                >
                    <ScannerIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Escanear</span>
                </button>
            )}

            {!isBatchMode && (
                <button 
                    onClick={() => setIsMultiSlotMode(!isMultiSlotMode)}
                    className={`flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg border font-bold text-xs md:text-sm transition-all touch-manipulation
                        ${isMultiSlotMode
                            ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700' 
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                >
                    <MultiLayerIcon className="h-4 w-4" />
                    {isMultiSlotMode ? 'Multi (ON)' : 'Multi (OFF)'}
                </button>
            )}
            <button onClick={onClose} className="p-2 text-rose-400 hover:text-rose-900 dark:hover:text-white bg-rose-100 dark:bg-rose-800 rounded-full transition-colors touch-manipulation" aria-label="Cerrar">
                <CloseIcon className="h-6 w-6" />
            </button>
          </div>
        </header>
        
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
            <div className="overflow-x-auto smooth-scroll no-scrollbar flex p-2 gap-2 snap-x">
                {config.warehouses.map(wh => (
                <button
                    key={wh.code}
                    onClick={() => { setActiveWarehouse(wh.code); if(!isMultiSlotMode && !isBatchMode) setSelectedLocations([]); }}
                    className={`flex-shrink-0 px-4 py-2 text-sm font-medium transition-all rounded-lg whitespace-nowrap snap-start border
                    ${activeWarehouse === wh.code
                        ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800 shadow-sm'
                        : 'bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    {wh.name}
                </button>
                ))}
            </div>
        </div>

        <div className="overflow-y-auto p-2 md:p-6 flex-grow bg-slate-50 dark:bg-black/20">
            <div className="space-y-4 md:space-y-8">
                {Object.entries(groupedLocations).map(([shelf, locations]) => {
                    const displayName = `Estantería ${shelf}`;

                    return (
                  <div 
                    key={`${activeWarehouse}-E${shelf}`} 
                    className={`bg-white dark:bg-slate-900 p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800`}
                  >
                    <h4 className="text-base md:text-lg font-bold mb-3 pb-2 border-b text-slate-800 dark:text-slate-200 border-slate-100 dark:border-slate-800">
                         {displayName}
                    </h4>
                    
                    <div className="space-y-4">
                        <div>
                          <div className={`grid gap-2 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6`}>
                            {locations.map((locId: LocationId) => {
                                const pos = locId.split('-').pop() || locId;
                                const isSelected = selectedLocations.includes(locId);
                                const occupiedItems = assignments[locId] || [];
                                const isOccupied = occupiedItems.length > 0;
                              
                              return (
                                <button
                                  key={locId}
                                  onClick={() => handleLocationClick(locId)}
                                  className={`p-2 md:p-4 rounded-xl min-h-[70px] md:min-h-[90px] text-left border-2 transition-all duration-200 flex flex-col justify-between relative overflow-hidden touch-manipulation
                                    ${isSelected
                                      ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-500 ring-2 ring-cyan-200 dark:ring-cyan-800 z-10'
                                      : isOccupied 
                                      ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/50' 
                                      : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-cyan-300 dark:hover:border-cyan-700'
                                  }`}
                                >
                                  <p className="font-bold text-center border-b border-black/5 dark:border-white/5 pb-1 mb-1 w-full text-xs md:text-sm truncate">
                                      {pos}
                                  </p>
                                  <div className="flex-grow flex items-center justify-center w-full">
                                    {isOccupied ? (
                                      <div className="text-xs text-center w-full">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <p className="font-bold truncate px-1 text-slate-600 dark:text-slate-400 max-w-[60px]">{occupiedItems[0].barcode}</p>
                                            {occupiedItems.length > 1 && <span className="text-[10px] bg-slate-200 dark:bg-slate-700 rounded px-1">+{occupiedItems.length - 1}</span>}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-xs md:text-sm font-bold text-green-500">Libre</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                    </div>
                  </div>
                );
               })}
            </div>
        </div>

        <footer className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shrink-0 safe-area-inset-bottom">
            <div className="flex flex-col gap-3">
                 {isAlreadyAssigned && onFinishProduction && (
                    <button 
                        onClick={onFinishProduction}
                        className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 shadow-md transition-all flex items-center justify-center gap-2 touch-manipulation"
                    >
                        <CheckIcon className="h-5 w-5" />
                        Finalizar Producción
                    </button>
                 )}

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-rose-100 dark:bg-rose-800 text-rose-700 dark:text-rose-300 rounded-xl hover:bg-rose-200 dark:hover:bg-rose-700 font-bold text-base transition-colors touch-manipulation">
                        Cancelar
                    </button>
                    <button
                        onClick={() => selectedLocations.length > 0 && onAssign(barcode, isBatchMode || isMultiSlotMode ? selectedLocations : selectedLocations[0])}
                        disabled={selectedLocations.length === 0}
                        className={`flex-[2] py-3 text-white font-bold rounded-xl text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all active:scale-[0.98] ${
                            selectedLocations.some(l => (l.includes('URGENTE') || (l.includes('PLE-E1-B1-') && parseInt(l.split('-').pop()?.split(' ').pop() || '99') <= 6)))
                            ? 'bg-red-600 hover:bg-red-500' 
                            : 'bg-cyan-600 hover:bg-cyan-500'
                        }`}
                    >
                        {selectedLocations.length > 1 
                            ? `Confirmar (${selectedLocations.length})` 
                            : 'Confirmar'}
                    </button>
                </div>
            </div>
        </footer>
      </div>
    </div>
  );
};

export default AssignmentModal;


