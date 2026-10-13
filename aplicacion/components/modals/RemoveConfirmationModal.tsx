


import React from 'react';
import { TrashIcon } from './Icons';
import { formatLocation } from '../lib/warehouseData';
import { ofLabel } from '../../lib/ofLabel';

interface RemoveConfirmationModalProps {
  item: { barcode: string; orderId: string; location: string };
  onConfirm: () => void;
  onCancel: () => void;
  onWithdraw?: () => void;
}

const RemoveConfirmationModal: React.FC<RemoveConfirmationModalProps> = ({ item, onConfirm, onCancel, onWithdraw }) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-end md:items-center justify-center md:p-4 animate-fade-in">
      <div className="w-full md:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 flex flex-col gap-5 max-h-[90dvh] overflow-y-auto pb-safe">

        <div className="flex flex-col items-center text-center gap-2">
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400">
            <TrashIcon className="h-10 w-10" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Retirar Artículo</h3>
        </div>

        <div className="text-slate-600 dark:text-slate-300 text-center text-base leading-relaxed">
          <p>El artículo <strong className="text-slate-900 dark:text-white">{item.barcode}</strong> ({ofLabel(item.orderId)}) se encuentra actualmente en:</p>

          <div className="my-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono text-lg font-bold border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
            {formatLocation(item.location)}
          </div>

          <p>¿Desea <strong className="text-red-600 dark:text-red-400">retirarlo</strong> permanentemente de esta ubicación?</p>
        </div>

        <div className="grid grid-cols-1 gap-3 mt-2">
          {onWithdraw && (
            <button
              onClick={onWithdraw}
              className="w-full min-h-[44px] py-3.5 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              Pasar a "En Trabajo"
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onCancel}
              className="min-h-[44px] py-3.5 px-4 bg-rose-100 dark:bg-rose-800 text-rose-700 dark:text-rose-300 font-bold rounded-xl hover:bg-rose-200 dark:hover:bg-rose-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="min-h-[44px] py-3.5 px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-500 shadow-lg shadow-red-900/20 transition-all active:scale-95 text-sm"
            >
              Eliminar Definitivemente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemoveConfirmationModal;


