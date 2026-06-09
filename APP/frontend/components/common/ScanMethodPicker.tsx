import React from 'react';

export type ScanMethod = 'manual' | 'barcode' | 'ocr';

interface ScanMethodPickerProps {
  open: boolean;
  actionLabel: string;
  onSelect: (method: ScanMethod) => void;
  onBatch?: () => void;
  onClose: () => void;
}

const ScanMethodPicker: React.FC<ScanMethodPickerProps> = ({
  open,
  actionLabel,
  onSelect,
  onBatch,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-start">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cómo capturar</p>
            <h3 className="text-lg font-black text-slate-900">{actionLabel}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-2">
          <button
            type="button"
            onClick={() => onSelect('barcode')}
            className="w-full rounded-xl border-2 border-cyan-200 hover:border-cyan-500 bg-cyan-50 px-4 py-3 text-left transition-colors"
          >
            <span className="font-bold text-cyan-900">📝 Texto / Código de barras</span>
            <span className="block text-xs text-cyan-700/80 mt-0.5">Escribe código o escanea con pistola</span>
          </button>
          <button
            type="button"
            onClick={() => onSelect('ocr')}
            className="w-full rounded-xl border-2 border-purple-200 hover:border-purple-500 bg-purple-50 px-4 py-3 text-left transition-colors"
          >
            <span className="font-bold text-purple-900">📸 OCR con cámara</span>
            <span className="block text-xs text-purple-700/80 mt-0.5">Lee la etiqueta automáticamente</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScanMethodPicker;


