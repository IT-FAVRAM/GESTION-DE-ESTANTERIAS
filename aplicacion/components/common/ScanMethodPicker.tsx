import React from 'react';
import type { ScanMethod } from '../../lib/types/scan';
import { FEATURE_CAMERA_QR_SCAN } from '../../lib/featureFlags';

interface ScanMethodPickerProps {
  open: boolean;
  actionLabel: string;
  onSelect: (method: ScanMethod) => void;
  onBatch?: () => void;
  /** MOVER: alternativa a escanear — abre la lista de artículos de la estantería. */
  onSelectList?: () => void;
  /** UBICAR (carretillero/admin): flujo de SUBCONTRATACIÓN (foto etiqueta o código manual). */
  onSubcontratacion?: () => void;
  onClose: () => void;
  /** Modo kiosko: solo mostrar opción manual. */
  kioskMode?: boolean;
}

const ScanMethodPicker: React.FC<ScanMethodPickerProps> = ({
  open,
  actionLabel,
  onSelect,
  onBatch,
  onSelectList,
  onSubcontratacion,
  onClose,
  kioskMode = false,
}) => {
  const selectRef = React.useRef<boolean>(false);

  if (!open) {
    selectRef.current = false;
    return null;
  }

  // En modo kiosko, abrir directamente la entrada manual sin mostrar el picker
  if (kioskMode && !selectRef.current) {
    selectRef.current = true;
    setTimeout(() => onSelect('manual'), 0);
    return null;
  }

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
          {/* Escaneo con cámara — oculto tras FEATURE_CAMERA_QR_SCAN.
              El ERP no puede imprimir etiquetas con OF + artículo, así que no
              hay nada que leer. La pistola USB no pasa por aquí y sigue activa. */}
          {FEATURE_CAMERA_QR_SCAN && (
            <button
              type="button"
              onClick={() => onSelect('barcode')}
              className="w-full rounded-xl border-2 border-blue-300 hover:border-blue-600 bg-blue-50 px-4 py-3 text-left transition-colors shadow-sm hover:shadow-md"
            >
              <span className="font-bold text-blue-900">Escanear código (QR / barras)</span>
              <span className="block text-xs text-blue-700/80 mt-0.5">
                Lee el código con la cámara o la pistola (Artículo + OF)
              </span>
            </button>
          )}

          {/* OCR como opción alternativa */}
          <button
            type="button"
            onClick={() => onSelect('ocr')}
            className="w-full rounded-xl border-2 border-purple-200 hover:border-purple-500 bg-purple-50 px-4 py-3 text-left transition-colors"
          >
            <span className="font-bold text-purple-900">OCR con cámara</span>
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
            <span className="font-bold text-slate-800">Escribir manualmente</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Introduce el código del artículo a mano
            </span>
          </button>

          {/* MOVER: seleccionar de la lista de artículos de la estantería */}
          {onSelectList && (
            <button
              type="button"
              onClick={onSelectList}
              className="w-full rounded-xl border-2 border-amber-200 hover:border-amber-500 bg-amber-50 px-4 py-3 text-left transition-colors"
            >
              <span className="font-bold text-amber-900">Seleccionar de lista</span>
              <span className="block text-xs text-amber-700/80 mt-0.5">
                Elige el artículo entre los ya ubicados en la estantería
              </span>
            </button>
          )}

          {/* Lote: varios artículos en las mismas posiciones */}
          {onBatch && (
            <button
              type="button"
              onClick={onBatch}
              className="w-full rounded-xl border-2 border-cyan-200 hover:border-cyan-500 bg-cyan-50 px-4 py-3 text-left transition-colors"
            >
              <span className="font-bold text-cyan-900">Varios artículos (lote)</span>
              <span className="block text-xs text-cyan-700/80 mt-0.5">
                Escanéalos uno tras otro y ubícalos juntos en las mismas posiciones
              </span>
            </button>
          )}

          {/* Subcontratación: foto de la etiqueta (código amarillo) o código manual */}
          {onSubcontratacion && (
            <button
              type="button"
              onClick={onSubcontratacion}
              className="w-full rounded-xl border-2 border-orange-300 hover:border-orange-500 bg-orange-50 px-4 py-3 text-left transition-colors"
            >
              <span className="font-bold text-orange-900">Subcontratación</span>
              <span className="block text-xs text-orange-700/80 mt-0.5">
                Foto de la etiqueta (lee el código amarillo) o escríbelo a mano
              </span>
            </button>
          )}
        </div>

        {/* Información */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-slate-600">
            <strong>Tip:</strong>{' '}
            {FEATURE_CAMERA_QR_SCAN
              ? 'Usa el QR para la mejor precisión'
              : 'Escribe el nº de OF y el artículo se rellena solo'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScanMethodPicker;
