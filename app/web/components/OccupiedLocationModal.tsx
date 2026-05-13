
import React, { useMemo } from 'react';
import { InfoIcon, PlusCircleIcon, CloseIcon, MoveIcon, MultiLayerIcon, BoxIcon, CheckIcon } from './Icons';
import { AssignmentItem, LocationId, formatLocation } from '../lib/warehouseData';

interface OccupiedLocationModalProps {
  locationId: LocationId;
  existingItems: AssignmentItem[];
  newItem: { barcode: string; orderId: string };
  onConfirm: (mode: 'merge' | 'new_batch') => void;
  onCancel: () => void;
}

const OccupiedLocationModal: React.FC<OccupiedLocationModalProps> = ({ 
  locationId, 
  existingItems, 
  newItem, 
  onConfirm, 
  onCancel 
}) => {
  
  // Analizar si existe la misma OF en la ubicación
  const matchingBatch = useMemo(() => {
      return existingItems.find(item => item.barcode === newItem.barcode && item.orderId === newItem.orderId);
  }, [existingItems, newItem]);

  const hasSameArticleDifferentOF = useMemo(() => {
      return existingItems.some(item => item.barcode === newItem.barcode && item.orderId !== newItem.orderId);
  }, [existingItems, newItem]);

  // Agrupar items existentes por OF
  const groupedItems = useMemo(() => {
      const groups: Record<string, AssignmentItem[]> = {};
      existingItems.forEach(item => {
          const key = `${item.barcode}-${item.orderId}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
      });
      return Object.values(groups);
  }, [existingItems]);

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-l-4 border-amber-500 p-6 flex flex-col gap-5 relative max-h-[90vh] overflow-hidden">
        
        <div className="absolute top-4 right-4">
            <button 
                onClick={onCancel} 
                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-full transition-colors"
            >
            <CloseIcon className="h-5 w-5" />
            </button>
        </div>

        <div className="flex flex-col items-center text-center gap-2 mt-2">
             <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 dark:text-amber-400 shadow-sm">
                <InfoIcon className="h-8 w-8" />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Ubicación Ocupada</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Gestión de stock en <strong className="text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{formatLocation(locationId)}</strong>
                </p>
             </div>
        </div>
        
        {/* Contenido Actual vs Entrada */}
        <div className="grid grid-cols-2 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            
            {/* IZQUIERDA: Entrada */}
            <div className="bg-cyan-50 dark:bg-cyan-900/10 p-3 rounded-xl border border-cyan-100 dark:border-cyan-800/30">
                <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1 block">Entrada</span>
                <div className="font-bold text-slate-900 dark:text-white text-lg leading-none">{newItem.barcode}</div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">OF: {newItem.orderId}</div>
            </div>

            {/* DERECHA: Análisis */}
            <div className="flex flex-col justify-center text-right">
                {matchingBatch ? (
                    <>
                        <span className="text-green-600 dark:text-green-400 font-bold text-sm flex items-center justify-end gap-1">
                            <CheckIcon className="h-4 w-4" /> Coincidencia
                        </span>
                        <span className="text-xs text-slate-500">Mismo artículo y OF detectados.</span>
                    </>
                ) : hasSameArticleDifferentOF ? (
                    <>
                        <span className="text-amber-600 dark:text-amber-400 font-bold text-sm flex items-center justify-end gap-1">
                            <MultiLayerIcon className="h-4 w-4" /> Lote Diferente
                        </span>
                        <span className="text-xs text-slate-500">Mismo artículo, distinta OF.</span>
                    </>
                ) : (
                    <>
                        <span className="text-red-500 dark:text-red-400 font-bold text-sm flex items-center justify-end gap-1">
                            <BoxIcon className="h-4 w-4" /> Artículo Diferente
                        </span>
                        <span className="text-xs text-slate-500">Contenido distinto.</span>
                    </>
                )}
            </div>
        </div>

        {/* Lista Contenido */}
        <div className="overflow-y-auto flex-grow pr-1 max-h-40">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 sticky top-0 bg-white dark:bg-slate-900 pb-1 z-10">Contenido Actual:</h4>
            <div className="space-y-2">
                {groupedItems.map((group, idx) => {
                    const item = group[0];
                    const isMatch = item.barcode === newItem.barcode && item.orderId === newItem.orderId;
                    
                    return (
                        <div key={idx} className={`flex justify-between items-center p-3 rounded-lg border text-sm ${isMatch ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                            <div>
                                <div className="font-bold text-slate-800 dark:text-slate-200">{item.barcode}</div>
                                <div className="text-xs font-mono text-slate-500">OF: {item.orderId}</div>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-slate-600 dark:text-slate-400 text-lg">x{group.length}</span>
                                {isMatch && <div className="text-[10px] text-green-600 dark:text-green-400 font-bold">COINCIDE</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
        
        {/* Acciones */}
        <div className="flex flex-col gap-3 mt-auto">
            {/* Opción 1: Mismo Lote (Prioritaria) */}
            {matchingBatch && (
                <button 
                    onClick={() => onConfirm('merge')}
                    className="w-full py-4 px-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-[0.98] flex items-center gap-3 group"
                >
                    <div className="p-2 bg-green-700 rounded-lg group-hover:bg-green-600 transition-colors">
                        <PlusCircleIcon className="h-6 w-6" />
                    </div>
                    <div className="text-left leading-tight flex-grow">
                        <span className="block text-sm uppercase tracking-wide">Añadir al mismo Lote</span>
                        <span className="block text-xs opacity-80 font-normal">Agrupar con la OF existente</span>
                    </div>
                </button>
            )}

            {/* Opción 2: Nuevo Lote / Mezclar */}
            <button 
                onClick={() => onConfirm('new_batch')}
                className={`w-full py-3 px-4 font-bold rounded-xl border-2 transition-all active:scale-[0.98] flex items-center gap-3 text-left group
                    ${matchingBatch 
                        ? 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-500' 
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10'
                    }`}
            >
                <div className={`p-2 rounded-lg transition-colors ${matchingBatch ? 'bg-slate-100 dark:bg-slate-700' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
                    <MultiLayerIcon className="h-5 w-5" />
                </div>
                <div className="leading-tight flex-grow">
                    <span className="block text-sm uppercase tracking-wide">
                        {hasSameArticleDifferentOF ? 'Añadir como Lote Diferente' : 'Añadir (Mezclar)'}
                    </span>
                    <span className="block text-[10px] opacity-70 font-normal">
                        Crear una nueva entrada separada en esta ubicación.
                    </span>
                </div>
            </button>

            {/* Opción 3: Cancelar / Mover */}
            <button 
                onClick={onCancel}
                className="w-full py-3 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
                <MoveIcon className="h-4 w-4" />
                Cambiar Ubicación / Cancelar
            </button>
        </div>
      </div>
    </div>
  );
};

export default OccupiedLocationModal;
