/**
 * SoldaduraStationPicker — Paso extra para indicar el puesto de soldadura (1..18).
 *
 * Aparece cuando SOLDADURA es el origen (recoger) o el destino (traer/llevar).
 * Solo aplica a la sección SOLDADURA (SOL), no a robot (RSO) ni por puntos (SXP).
 */

import React from 'react';
import { SOLDADURA_STATIONS } from '../../lib/operative/requestSections';

interface SoldaduraStationPickerProps {
  open: boolean;
  /** "origen" → "¿De qué puesto?"; "destino" → "¿A qué puesto?". */
  variant?: 'origen' | 'destino';
  selected?: number | null;
  processing?: boolean;
  onSelect: (station: number) => void;
  onBack: () => void;
}

const SoldaduraStationPicker: React.FC<SoldaduraStationPickerProps> = ({
  open,
  variant = 'destino',
  selected = null,
  processing = false,
  onSelect,
  onBack,
}) => {
  if (!open) return null;

  const title = variant === 'origen'
    ? '🔥 ¿De qué puesto de soldadura?'
    : '🔥 ¿A qué puesto de soldadura?';

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
        <button
          onClick={onBack}
          disabled={processing}
          className="text-slate-400 hover:text-white transition-colors p-1 text-sm font-bold"
        >
          ← Volver
        </button>
        <h2 className="text-lg font-black text-white flex-1 text-center">{title}</h2>
        <div className="w-16" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Selecciona el puesto (1 al 18):
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {SOLDADURA_STATIONS.map((n) => (
            <button
              key={n}
              onClick={() => onSelect(n)}
              disabled={processing}
              className={`aspect-square rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all active:scale-95 ${
                selected === n
                  ? 'border-orange-400 bg-orange-500/20 text-orange-300'
                  : 'border-slate-700 bg-slate-800/60 text-slate-200 hover:border-slate-500'
              } disabled:opacity-50`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SoldaduraStationPicker;
