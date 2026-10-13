import React from 'react';

interface ShelfGridStatsProps {
  emptySlots: number;
  occupiedSlots: number;
  totalSlots: number;
  occupancy: number;
  compact?: boolean;
}

// Tema claro (igual que OperativeKpiStrip): etiqueta gris pequeña + número grande oscuro.
const Stat: React.FC<{ label: string; value: string | number; accent: string }> = ({ label, value, accent }) => (
  <div className={`rounded-2xl border bg-white px-4 py-3 shadow-sm ${accent}`}>
    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-black text-slate-900 tabular-nums leading-none">{value}</p>
  </div>
);

const ShelfGridStats: React.FC<ShelfGridStatsProps> = ({ emptySlots, occupiedSlots, totalSlots, occupancy, compact = false }) => {
  if (compact) return null;

  return (
    <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Huecos libres" value={emptySlots} accent="border-emerald-200" />
      <Stat label="Huecos ocupados" value={occupiedSlots} accent="border-sky-200" />
      <Stat label="Capacidad" value={totalSlots} accent="border-slate-200" />
      <Stat label="Ocupación" value={`${occupancy}%`} accent="border-slate-200" />
    </div>
  );
};

export default ShelfGridStats;
