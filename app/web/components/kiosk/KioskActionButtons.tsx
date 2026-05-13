import React from 'react';
import type { KioskAction } from './kioskShared';

interface KioskActionButtonsProps {
  action: KioskAction;
  onStartAction: (action: KioskAction) => void;
}

const KioskActionButtons: React.FC<KioskActionButtonsProps> = ({ action, onStartAction }) => {
  if (action !== 'idle') return null;

  return (
    <div className="flex-shrink-0 border-t border-slate-800 bg-slate-950/90 p-4 backdrop-blur-md">
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 lg:grid-cols-4">
        <button onClick={() => onStartAction('ubicar')} className="h-24 rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 active:scale-95 text-white font-black text-lg flex flex-col items-center justify-center gap-1 shadow-xl shadow-emerald-950/40 transition-all"><span className="text-2xl">📦</span>UBICAR</button>
        <button onClick={() => onStartAction('retirar')} className="h-24 rounded-3xl border border-red-400/20 bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 active:scale-95 text-white font-black text-lg flex flex-col items-center justify-center gap-1 shadow-xl shadow-red-950/40 transition-all"><span className="text-2xl">📤</span>RETIRAR</button>
        <button onClick={() => onStartAction('mover')} className="h-24 rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 active:scale-95 text-white font-black text-lg flex flex-col items-center justify-center gap-1 shadow-xl shadow-blue-950/40 transition-all"><span className="text-2xl">🔄</span>MOVER</button>
        <button onClick={() => onStartAction('avisar')} className="h-24 rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 active:scale-95 text-white font-black text-lg flex flex-col items-center justify-center gap-1 shadow-xl shadow-amber-950/40 transition-all"><span className="text-2xl">🚚</span>CARRETILLERO</button>
      </div>
    </div>
  );
};

export default KioskActionButtons;
