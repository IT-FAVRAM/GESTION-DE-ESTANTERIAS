


import React from 'react';
import { MoveIcon } from './Icons';
import { formatLocation } from '../lib/warehouseData';

interface MoveConfirmationModalProps {
  item: { barcode: string; orderId: string; currentLoc: string; targetLoc: string };
  onConfirm: () => void;
  onCancel: () => void;
}

const MoveConfirmationModal: React.FC<MoveConfirmationModalProps> = ({ item, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-5">
        
        <div className="flex flex-col items-center text-center gap-2">
             <div className="p-4 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 dark:text-amber-400">
                <MoveIcon className="h-10 w-10" />
             </div>
             <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Artículo ya Asignado</h3>
        </div>
        
        <div className="text-slate-600 dark:text-slate-300 text-center text-base leading-relaxed">
            <p>El artículo <strong className="text-slate-900 dark:text-white">{item.barcode}</strong> (OF: {item.orderId}) ya se encuentra en:</p>
            
            <div className="my-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono text-lg font-bold border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                {formatLocation(item.currentLoc)}
            </div>
            
            <p>¿Desea <strong className="text-amber-600 dark:text-amber-400">moverlo</strong> a la nueva posición?</p>
             <div className="mt-1 font-mono font-bold text-cyan-600 dark:text-cyan-400 text-sm">
                {formatLocation(item.targetLoc)}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-2">
            <button 
                onClick={onCancel}
                className="py-3.5 px-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
                Cancelar
            </button>
            <button 
                onClick={onConfirm}
                className="py-3.5 px-4 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 shadow-lg shadow-cyan-900/20 transition-all active:scale-95"
            >
                Confirmar
            </button>
        </div>
      </div>
    </div>
  );
};

export default MoveConfirmationModal;

