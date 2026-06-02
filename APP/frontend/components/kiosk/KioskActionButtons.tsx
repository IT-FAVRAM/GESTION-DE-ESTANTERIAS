import React from 'react';
import type { KioskAction } from './kioskShared';

interface KioskActionButtonsProps {
  action: KioskAction;
  onStartAction: (action: KioskAction) => void;
  showShelf?: boolean;
}

const KioskActionButtons: React.FC<KioskActionButtonsProps> = ({ action, onStartAction, showShelf = false }) => {
  if (action !== 'idle') return null;

  // Modo compacto en estantería
  if (showShelf) {
    return (
      <div className="flex-shrink-0 border-t border-slate-200 bg-white px-2 pt-2 shadow-md" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-1.5 justify-center flex-wrap max-w-full">
          <button onClick={() => onStartAction('ubicar')} className="min-h-[44px] px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all touch-manipulation">
            📦 UBICAR
          </button>
          <button onClick={() => onStartAction('retirar')} className="min-h-[44px] px-4 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 active:scale-95 transition-all touch-manipulation">
            📤 RETIRAR
          </button>
          <button onClick={() => onStartAction('mover')} className="min-h-[44px] px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all touch-manipulation">
            🔄 MOVER
          </button>
          <button onClick={() => onStartAction('avisar')} className="min-h-[44px] px-4 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 active:scale-95 transition-all touch-manipulation">
            🚚 CARRETILLERO
          </button>
        </div>
      </div>
    );
  }

  // Modo grande en menú principal
  return (
    <div className="flex-shrink-0 border-t border-slate-800 bg-slate-950/90 px-4 pt-4 backdrop-blur-md" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 lg:grid-cols-4">
        <button onClick={() => onStartAction('ubicar')} className="h-24 rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 active:scale-95 text-white font-black text-lg flex flex-col items-center justify-center gap-1 shadow-xl shadow-emerald-950/40 transition-all touch-manipulation"><span className="text-2xl">📦</span>UBICAR</button>
        <button onClick={() => onStartAction('retirar')} className="h-24 rounded-3xl border border-red-400/20 bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 active:scale-95 text-white font-black text-lg flex flex-col items-center justify-center gap-1 shadow-xl shadow-red-950/40 transition-all touch-manipulation"><span className="text-2xl">📤</span>RETIRAR</button>
        <button onClick={() => onStartAction('mover')} className="h-24 rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 active:scale-95 text-white font-black text-lg flex flex-col items-center justify-center gap-1 shadow-xl shadow-blue-950/40 transition-all touch-manipulation"><span className="text-2xl">🔄</span>MOVER</button>
        <button onClick={() => onStartAction('avisar')} className="h-24 rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 active:scale-95 text-white font-black text-lg flex flex-col items-center justify-center gap-1 shadow-xl shadow-amber-950/40 transition-all touch-manipulation"><span className="text-2xl">🚚</span>CARRETILLERO</button>
      </div>
    </div>
  );
};

export default KioskActionButtons;


