
import React, { useState } from 'react';
import { BellIcon } from './Icons';

interface RequestConfirmationModalProps {
  item: { barcode: string; orderId: string };
  onConfirm: (priority: 'normal' | 'high') => void;
  onCancel: () => void;
}

const RequestConfirmationModal: React.FC<RequestConfirmationModalProps> = ({ item, onConfirm, onCancel }) => {
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-end md:items-center justify-center md:p-4 animate-fade-in">
      <div className="w-full md:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 flex flex-col gap-5 max-h-[90dvh] overflow-y-auto pb-safe">

        <div className="flex flex-col items-center text-center gap-2">
          <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
            <BellIcon className="h-10 w-10" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Enviar Solicitud</h3>
        </div>

        <div className="text-slate-600 dark:text-slate-300 text-center text-base leading-relaxed">
          <p>Va a solicitar al carretillero el siguiente material:</p>

          <div className="my-4 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border-2 border-purple-100 dark:border-purple-900/30">
            <div className="text-sm text-slate-400 uppercase font-bold">Artículo</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mb-2">{item.barcode}</div>
            <div className="text-sm text-slate-400 uppercase font-bold">Orden (OF)</div>
            <div className="text-lg font-mono text-purple-600 dark:text-purple-400">{item.orderId}</div>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-4">
            <button
              onClick={() => setPriority('normal')}
              className={`flex-1 min-h-[44px] py-2 text-sm font-bold rounded-lg transition-all ${priority === 'normal' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Normal
            </button>
            <button
              onClick={() => setPriority('high')}
              className={`flex-1 min-h-[44px] py-2 text-sm font-bold rounded-lg transition-all ${priority === 'high' ? 'bg-red-500 text-white shadow-sm ring-1 ring-red-400' : 'text-slate-500 dark:text-slate-400 hover:text-red-500'}`}
            >
              Urgente
            </button>
          </div>

          <p>¿Desea enviar esta notificación ahora?</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <button
            onClick={onCancel}
            className="min-h-[44px] py-3.5 px-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(priority)}
            className={`min-h-[44px] py-3.5 px-4 font-bold rounded-xl shadow-lg transition-all active:scale-95 ${priority === 'high' ? 'bg-red-600 text-white hover:bg-red-500 shadow-red-900/20' : 'bg-purple-600 text-white hover:bg-purple-500 shadow-purple-900/20'}`}
          >
            {priority === 'high' ? 'Enviar URGENTE' : 'Enviar Solicitud'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestConfirmationModal;


