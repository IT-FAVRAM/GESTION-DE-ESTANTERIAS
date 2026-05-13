
import React from 'react';
import { BatchItem } from '../types/batch';
import { CloseIcon, BellIcon, TrashIcon, CheckIcon } from './Icons';

interface RequestReviewModalProps {
  items: BatchItem[];
  onConfirm: () => void;
  onClose: () => void;
  onRemoveItem: (index: number) => void;
}

const RequestReviewModal: React.FC<RequestReviewModalProps> = ({ items, onConfirm, onClose, onRemoveItem }) => {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-3 md:p-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <header className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
              <BellIcon className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-tight">Confirmar Solicitudes</h2>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                Se enviarán <span className="font-bold text-purple-600 dark:text-purple-400">{items.length}</span> notificaciones.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors">
            <CloseIcon className="h-6 w-6" />
          </button>
        </header>

        {/* List Content */}
        <div className="overflow-y-auto p-3 md:p-6 bg-slate-50 dark:bg-black/20 flex-grow">
          <div className="space-y-2 md:space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2">
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">ART</span>
                    <p className="font-bold text-sm md:text-lg text-slate-800 dark:text-white truncate">{item.article}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">OF</span>
                    <p className="text-xs md:text-sm font-mono text-slate-500 dark:text-slate-400 truncate">{item.order}</p>
                  </div>
                </div>
                <button 
                  onClick={() => onRemoveItem(idx)}
                  className="p-2 md:p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                  title="Eliminar de la lista"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="p-4 md:p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl flex gap-3 justify-end flex-shrink-0 safe-area-inset-bottom">
          <button 
            onClick={onClose}
            className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm md:text-base"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 md:flex-none px-4 md:px-8 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2 transition-transform active:scale-95 text-sm md:text-base"
          >
            <BellIcon className="h-5 w-5" />
            <span>Enviar Todo</span>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default RequestReviewModal;
