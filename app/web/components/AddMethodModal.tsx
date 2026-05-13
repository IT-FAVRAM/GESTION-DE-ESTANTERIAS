
import React from 'react';
import { CloseIcon, CameraIcon, KeyboardIcon } from './Icons';

interface AddMethodModalProps {
  title?: string;
  subtitle?: string;
  onSelectManual: () => void;
  onSelectPhoto: () => void;
  onClose: () => void;
}

const AddMethodModal: React.FC<AddMethodModalProps> = ({ title = "Seleccionar Método", subtitle, onSelectManual, onSelectPhoto, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800">
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-full transition-colors"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        <div className="text-center mb-8">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
            {subtitle && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-mono text-cyan-600 dark:text-cyan-400 break-all">
                    {subtitle}
                </p>
            )}
        </div>

        <div className="flex flex-col gap-4">
            <button 
                onClick={onSelectPhoto}
                className="w-full py-4 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg shadow-lg shadow-purple-900/20 flex items-center justify-center gap-3 transition-transform active:scale-[0.98]"
            >
                <CameraIcon className="h-6 w-6" />
                <span>Usar Cámara (IA)</span>
            </button>

            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase">O bien</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
            </div>

            <button 
                onClick={onSelectManual}
                className="w-full py-4 px-6 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold text-lg border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center gap-3 transition-transform active:scale-[0.98]"
            >
                <KeyboardIcon className="h-6 w-6" />
                <span>Entrada Manual</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default AddMethodModal;
