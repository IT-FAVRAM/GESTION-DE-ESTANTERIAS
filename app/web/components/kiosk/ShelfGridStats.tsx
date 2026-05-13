import React from 'react';

interface ShelfGridStatsProps {
  emptySlots: number;
  occupiedSlots: number;
  totalSlots: number;
  occupancy: number;
  compact?: boolean;
}

const ShelfGridStats: React.FC<ShelfGridStatsProps> = ({ emptySlots, occupiedSlots, totalSlots, occupancy, compact = false }) => {
  if (compact) return null;

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 shadow-lg shadow-emerald-950/10"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300/70">Huecos libres</p><p className="mt-2 text-2xl font-black text-white">{emptySlots}</p></div>
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 shadow-lg shadow-cyan-950/10"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300/70">Huecos ocupados</p><p className="mt-2 text-2xl font-black text-white">{occupiedSlots}</p></div>
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 shadow-lg shadow-cyan-950/10"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300/70">Capacidad</p><p className="mt-2 text-2xl font-black text-white">{totalSlots}</p></div>
      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 shadow-lg shadow-slate-950/20"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Ocupacion</p><p className="mt-2 text-2xl font-black text-white">{occupancy}%</p></div>
    </div>
  );
};

export default ShelfGridStats;
