
import React, { useState } from 'react';
import { CloseIcon, TrashIcon, CameraIcon, PlusCircleIcon, CheckIcon } from './Icons';
import { BatchItem } from '../types/batch';
import PhotoAnalyzerModal from './PhotoAnalyzerModal';

interface BatchScannerProps {
  onComplete: (items: BatchItem[]) => void;
  onClose: () => void;
  mode?: 'assign' | 'request'; // 'assign' for Lote/Multi-Ub, 'request' for Solicitudes
}

const BatchScanner: React.FC<BatchScannerProps> = ({ onComplete, onClose, mode = 'assign' }) => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const title = mode === 'request' ? "Crear Solicitud" : "Escaneo de Lote";
  const actionLabel = mode === 'request' ? "REVISAR SOLICITUD" : "FINALIZAR Y UBICAR";
  
  const handlePhotoResult = (result: string | { article: string; order: string }) => {
      // We expect the combined mode result here
      if (typeof result === 'object' && result.article && result.order) {
           setItems(prev => [...prev, { article: result.article, order: result.order }]);
           setIsCameraOpen(false); // Close camera after each scan to review/add next
      } else {
          // Fallback if somehow string returned
          setIsCameraOpen(false);
      }
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // If camera is open, show the analyzer modal on top
  if (isCameraOpen) {
      return (
          <PhotoAnalyzerModal 
              onCodeExtracted={handlePhotoResult} 
              onClose={() => setIsCameraOpen(false)} 
              instruction="Etiqueta: Artículo + OF"
              mode="combined"
          />
      );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="relative z-20 p-4 flex justify-between items-center bg-slate-800 border-b border-slate-700 shadow-md">
         <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="text-slate-400 text-sm">{items.length} artículos en lista</p>
         </div>
         <button onClick={onClose} className="p-2 rounded-full bg-slate-700 text-white hover:bg-slate-600 transition-colors">
            <CloseIcon className="h-6 w-6" />
         </button>
      </div>

      {/* List Area */}
      <div className="flex-grow p-4 overflow-hidden flex flex-col">
         <div className="flex-grow overflow-y-auto space-y-3 pb-24">
            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                    <div className="p-4 bg-slate-800 rounded-full animate-pulse">
                        <CameraIcon className="h-12 w-12 opacity-50" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-lg text-slate-300">Lista Vacía</p>
                        <p className="text-sm mt-1 max-w-xs mx-auto text-slate-400">
                            Pulsa el botón <strong>(+)</strong> para hacer una foto a la etiqueta (Artículo + OF).
                        </p>
                    </div>
                </div>
            ) : (
                items.map((item, idx) => (
                    <div key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm animate-slide-in-right">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">ART</span>
                                <span className="font-bold text-white text-lg">{item.article}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded">OF</span>
                                <span className="font-mono text-purple-400">{item.order}</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleRemoveItem(idx)} 
                            className="p-3 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                ))
            )}
         </div>
      </div>

      {/* Floating Action Button for Add */}
      <div className="absolute bottom-24 right-6 z-30">
          <button 
            onClick={() => setIsCameraOpen(true)}
            className="h-16 w-16 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-lg flex items-center justify-center border-4 border-slate-900 active:scale-95 transition-all"
            title="Añadir Artículo"
          >
              <PlusCircleIcon className="h-8 w-8" />
          </button>
      </div>

      {/* Footer Actions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 flex gap-3 z-30 safe-area-inset-bottom">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700">
              Cancelar
          </button>
          <button 
            onClick={() => onComplete(items)} 
            disabled={items.length === 0}
            className={`flex-[2] py-3 rounded-xl font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2
                ${mode === 'request' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-cyan-600 hover:bg-cyan-500'}
            `}
          >
              {mode !== 'request' && <CheckIcon className="h-5 w-5" />}
              <span>{actionLabel} ({items.length})</span>
          </button>
      </div>
    </div>
  );
};

export default BatchScanner;
