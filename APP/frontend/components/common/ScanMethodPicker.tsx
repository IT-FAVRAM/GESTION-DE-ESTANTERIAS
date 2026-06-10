import React from 'react';
import type { ScanMethod } from '../../lib/types/scan';

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
            className="text-rose-400 hover:text-rose-700 text-2xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-2">
          {/* QR Scanner - Opción principal */}
          <button
            type="button"
            onClick={() => onSelect('barcode')}
            className="w-full rounded-xl border-2 border-blue-300 hover:border-blue-600 bg-blue-50 px-4 py-3 text-left transition-colors shadow-sm hover:shadow-md"
          >
            <span className="font-bold text-blue-900">📱 Escanear Código QR</span>
            <span className="block text-xs text-blue-700/80 mt-0.5">
              Lee el QR con tu dispositivo (Artículo + OF)
            </span>
          </button>

          {/* OCR como opción alternativa */}
          <button
            type="button"
            onClick={() => onSelect('ocr')}
            className="w-full rounded-xl border-2 border-purple-200 hover:border-purple-500 bg-purple-50 px-4 py-3 text-left transition-colors"
          >
            <span className="font-bold text-purple-900">📸 OCR con cámara</span>
            <span className="block text-xs text-purple-700/80 mt-0.5">
              Lee etiquetas automáticamente (alternativa)
            </span>
          </button>

          {/* Entrada manual */}
          <button
            type="button"
            onClick={() => onSelect('manual')}
            className="w-full rounded-xl border-2 border-slate-200 hover:border-slate-400 bg-white px-4 py-3 text-left transition-colors"
          >
            <span className="font-bold text-slate-800">⌨️ Escribir manualmente</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Introduce el código del artículo a mano
            </span>
          </button>
        </div>

        {/* Información */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-slate-600">
            💡 <strong>Tip:</strong> Usa el QR para la mejor precisión
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScanMethodPicker;
