


import React from 'react';
import { CheckIcon, BellIcon } from './Icons';
import { formatLocation } from '../lib/warehouseData';

interface ProcessFinishedModalProps {
  item: { barcode: string; orderId: string; location: string };
  onConfirm: () => void;
  onCancel: () => void;
}

const ProcessFinishedModal: React.FC<ProcessFinishedModalProps> = ({ item, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-end md:items-center justify-center md:p-4 animate-fade-in">
      <div className="w-full md:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 flex flex-col gap-5 max-h-[90dvh] overflow-y-auto pb-safe">
        
        <div className="flex flex-col items-center text-center gap-2">
             <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400">
                <CheckIcon className="h-10 w-10" />
             </div>
             <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Confirmar Finalización</h3>
        </div>
        
        <div className="text-slate-600 dark:text-slate-300 text-center text-base leading-relaxed">
            <p className="mb-2">¿Desea marcar que el artículo <strong className="text-slate-900 dark:text-white">{item.barcode}</strong> ha acabado su producción y ha subido a almacén?</p>
            
            <p className="text-sm font-bold mt-2">Ubicación actual en planta:</p>
            <div className="my-3 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl font-mono text-lg font-bold border-2 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                {formatLocation(item.location)}
            </div>
            
            <p className="text-sm text-slate-500">
                Esta acción liberará la ubicación y moverá el ítem al histórico de terminados.
            </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-2">
            <button 
                onClick={onCancel}
                className="min-h-[44px] py-3.5 px-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
                Cancelar
            </button>
            <button 
                onClick={onConfirm}
                className="min-h-[44px] py-3.5 px-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
            >
                Confirmar
            </button>
        </div>
      </div>
    </div>
  );
};

export default ProcessFinishedModal;
