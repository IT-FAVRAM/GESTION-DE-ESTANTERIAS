import React, { useState } from 'react';

interface SubcontratacionCaptureProps {
  /** Abrir la cámara OCR (lee el código amarillo de la etiqueta). */
  onPhoto: () => void;
  /** Confirmar un código escrito a mano. */
  onManual: (code: string) => void;
  /** Cerrar / cancelar el flujo de subcontratación. */
  onClose: () => void;
}

/**
 * SubcontratacionCapture — Selector de captura para SUBCONTRATACIÓN.
 *
 * La etiqueta de subcontratación sólo tiene un código (subrayado en amarillo).
 * El usuario puede capturarlo con la cámara (OCR de la zona superior) o
 * escribirlo a mano. No se usa la pistola/QR ni se pide OF.
 */
const SubcontratacionCapture: React.FC<SubcontratacionCaptureProps> = ({ onPhoto, onManual, onClose }) => {
  const [manualMode, setManualMode] = useState(false);
  const [code, setCode] = useState('');

  const trimmed = code.trim().toUpperCase();

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-orange-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-orange-100 flex justify-between items-start bg-orange-50">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Subcontratación</p>
            <h3 className="text-lg font-black text-orange-900">Capturar código</h3>
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

        {!manualMode ? (
          <div className="p-4 space-y-2">
            <button
              type="button"
              onClick={onPhoto}
              className="w-full rounded-xl border-2 border-orange-300 hover:border-orange-500 bg-orange-50 px-4 py-3 text-left transition-colors shadow-sm hover:shadow-md"
            >
              <span className="font-bold text-orange-900">📸 Hacer foto a la etiqueta</span>
              <span className="block text-xs text-orange-700/80 mt-0.5">
                Lee automáticamente el código subrayado en amarillo (arriba)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setManualMode(true)}
              className="w-full rounded-xl border-2 border-slate-200 hover:border-slate-400 bg-white px-4 py-3 text-left transition-colors"
            >
              <span className="font-bold text-slate-800">⌨️ Escribir código</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Introduce el código de la etiqueta a mano
              </span>
            </button>
          </div>
        ) : (
          <form
            className="p-4 space-y-3"
            onSubmit={(e) => { e.preventDefault(); if (trimmed) onManual(trimmed); }}
          >
            <label className="block text-orange-700 text-xs font-bold uppercase tracking-widest">Código</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="EJ: ECV-4.0-12010 C 25-01/536"
              className="w-full bg-slate-50 text-slate-900 text-lg font-mono font-bold tracking-wide border border-slate-300 focus:border-orange-500 focus:outline-none rounded-xl p-3"
              autoFocus
              inputMode="text"
              enterKeyHint="done"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setManualMode(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
              >
                ← Volver
              </button>
              <button
                type="submit"
                disabled={!trimmed}
                className={`flex-1 py-3 rounded-xl font-bold transition-colors text-sm ${
                  trimmed ? 'bg-orange-600 text-white hover:bg-orange-500' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Continuar
              </button>
            </div>
          </form>
        )}

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-slate-600">
            💡 El código amarillo es el único identificador (sin OF). Luego elige la celda.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubcontratacionCapture;
