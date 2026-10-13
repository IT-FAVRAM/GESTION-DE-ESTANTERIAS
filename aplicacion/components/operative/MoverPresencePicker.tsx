/**
 * MoverPresencePicker — "¿Qué quieres mover?" cuando la pieza ocupa varios
 * huecos de la estantería: toda la pieza o solo uno de sus parciales. Antes
 * MOVER obligaba a mover todas las presencias (o apilarlas en un hueco).
 */
import React from 'react';
import type { MoverPresenceOption } from '../../hooks/useOperativeShelf';

interface MoverPresencePickerProps {
  articleCode: string;
  options: MoverPresenceOption[];
  onAll: () => void;
  onPick: (presenceId: string) => void;
  onCancel: () => void;
}

const posLabel = (p: string) => {
  const n = parseInt(p, 10);
  return Number.isNaN(n) ? p : String(n).padStart(3, '0');
};

const sinceLabel = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `desde ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
};

const MoverPresencePicker: React.FC<MoverPresencePickerProps> = ({ articleCode, options, onAll, onPick, onCancel }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-labelledby="mover-picker-title">
    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 space-y-4">
      <div className="text-center">
        <h2 id="mover-picker-title" className="text-xl font-black text-slate-900">¿Qué quieres mover?</h2>
        <p className="text-sm text-slate-500 mt-1">
          <span className="font-mono font-bold text-slate-700">{articleCode}</span> está en {options.length} huecos
        </p>
      </div>

      <button
        onClick={onAll}
        className="w-full min-h-14 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-lg active:scale-[0.98] transition-all"
      >
        Toda la pieza ({options.length} huecos)
      </button>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">O solo uno:</p>
        {options.map((opt) => (
          <button
            key={opt.presenceId}
            onClick={() => onPick(opt.presenceId)}
            className="w-full min-h-12 px-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 bg-slate-50 flex items-center justify-between gap-3 active:scale-[0.98] transition-all"
          >
            <span className="font-black text-slate-900">Solo el de pos. {posLabel(opt.position)}</span>
            <span className="text-xs text-slate-500">{sinceLabel(opt.locatedAt)}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onCancel}
        className="w-full min-h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
      >
        Cancelar
      </button>
    </div>
  </div>
);

export default MoverPresencePicker;
