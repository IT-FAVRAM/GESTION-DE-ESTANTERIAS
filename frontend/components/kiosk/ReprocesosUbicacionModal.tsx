import React, { useState, useCallback } from 'react';

interface ReprocesosUbicacionModalProps {
  open: boolean;
  articleCode: string;
  orderFab: string;
  position: string;
  onConfirm: (importe?: number, cantidad?: number) => void;
  onSkip: () => void;
  onClose: () => void;
}

const ReprocesosUbicacionModal: React.FC<ReprocesosUbicacionModalProps> = ({
  open,
  articleCode,
  orderFab,
  position,
  onConfirm,
  onSkip,
  onClose,
}) => {
  const [importe, setImporte] = useState<string>('');
  const [cantidad, setCantidad] = useState<string>('');

  const handleConfirm = useCallback(() => {
    const importeNum = importe.trim() ? parseFloat(importe) : undefined;
    const cantidadNum = cantidad.trim() ? parseInt(cantidad, 10) : undefined;

    if (importeNum !== undefined && isNaN(importeNum)) {
      return;
    }
    if (cantidadNum !== undefined && isNaN(cantidadNum)) {
      return;
    }

    onConfirm(importeNum, cantidadNum);
    setImporte('');
    setCantidad('');
  }, [importe, cantidad, onConfirm]);

  const handleSkip = useCallback(() => {
    setImporte('');
    setCantidad('');
    onSkip();
  }, [onSkip]);

  const handleClose = useCallback(() => {
    setImporte('');
    setCantidad('');
    onClose();
  }, [onClose]);

  if (!open) return null;

  const posNum = parseInt(position, 10);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="w-full max-w-lg bg-slate-900 rounded-t-3xl border-t border-slate-700 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ubicar en Reprocesos</p>
              <h2 className="text-2xl font-black text-white">Posición {Number.isNaN(posNum) ? position : posNum}</h2>
            </div>
            <span className="text-sm text-slate-400 font-mono">📝 Detalles</span>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          {/* Article info */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
            <p className="text-sm text-slate-400">Artículo a ubicar:</p>
            <p className="text-lg font-black text-white mt-1">{articleCode}</p>
            <p className="text-sm text-red-300 font-mono mt-0.5">{orderFab}</p>
          </div>

          {/* Inputs */}
          <div className="space-y-3">
            {/* Importe */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                💰 Importe (€) — Opcional
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                placeholder="Ej: 125.50"
                className="w-full mt-2 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Cantidad */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                📦 Cantidad (pzas) — Opcional
              </label>
              <input
                type="number"
                min="0"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="Ej: 5"
                className="w-full mt-2 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Note */}
          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-700/30 text-xs text-amber-200">
            ℹ️ Estos datos son opcionales. Puedes dejarlos en blanco si lo prefieres.
          </div>
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 pt-2 space-y-2">
          <button
            onClick={handleConfirm}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-600
              text-white font-black text-lg shadow-lg shadow-cyan-950/40
              active:scale-[0.98] transition-all hover:from-cyan-400 hover:to-cyan-500"
          >
            ✅ Confirmar Ubicación
          </button>
          <button
            onClick={handleSkip}
            className="w-full h-12 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold
              hover:bg-slate-700 transition-colors"
          >
            ⏭️ Saltar (sin detalles)
          </button>
          <button
            onClick={handleClose}
            className="w-full h-10 rounded-xl text-sm font-bold text-slate-400
              hover:text-white hover:bg-slate-800 transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReprocesosUbicacionModal;


