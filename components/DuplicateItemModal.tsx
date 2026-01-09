


import React from 'react';
import { InfoIcon, MoveIcon, PlusCircleIcon, CloseIcon } from './Icons';
import { formatLocation } from '../lib/warehouseData';

interface DuplicateItemModalProps {
  item: { barcode: string; orderId: string; location: string };
  onMove: () => void;
  onAdd: () => void;
  onCancel: () => void;
}

const DuplicateItemModal: React.FC<DuplicateItemModalProps> = ({ item, onMove, onAdd, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-6 relative">
        
        <button 
            onClick={onCancel} 
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-full transition-colors"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center gap-2">
             <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                <InfoIcon className="h-10 w-10" />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Artículo Existente</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    El artículo <strong className="text-slate-900 dark:text-white">{item.barcode}</strong> (OF: {item.orderId}) ya está en:
                </p>
             </div>
        </div>
        
        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono text-lg font-bold border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-center">
            {formatLocation(item.location)}
        </div>
        
        <div className="flex flex-col gap-3">
            <p className="text-center text-sm font-bold text-slate-500 mb-1">¿Qué desea hacer?</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                    onClick={onMove}
                    className="p-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl border-2 border-slate-300 dark:border-slate-600 transition-all active:scale-[0.98] flex flex-col items-center gap-2"
                >
                    <MoveIcon className="h-6 w-6" />
                    <span>MOVER</span>
                    <span className="text-[10px] opacity-70 font-normal">Cambiar ubicación actual</span>
                </button>

                <button 
                    onClick={onAdd}
                    className="p-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl border-2 border-cyan-500 shadow-lg shadow-cyan-900/20 transition-all active:scale-[0.98] flex flex-col items-center gap-2"
                >
                    <PlusCircleIcon className="h-6 w-6" />
                    <span>AÑADIR PARTE</span>
                    <span className="text-[10px] opacity-80 font-normal">Nueva partida / Palet extra</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DuplicateItemModal;