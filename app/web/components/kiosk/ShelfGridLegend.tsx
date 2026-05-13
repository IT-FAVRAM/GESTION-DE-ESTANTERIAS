import React from 'react';

interface ShelfGridLegendProps {
  compact?: boolean;
}

const ShelfGridLegend: React.FC<ShelfGridLegendProps> = ({ compact = false }) => {
  if (compact) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-3 px-2 text-xs text-slate-400">
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-2"><span className="h-3 w-3 rounded border border-slate-500/40 bg-slate-500/30" /> Vacio</span>
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-2"><span className="h-3 w-3 rounded border border-cyan-400/40 bg-cyan-400/30" /> Ocupado</span>
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-2"><span className="h-3 w-3 rounded border border-red-500/40 bg-red-500/30" /> Urgente</span>
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-2"><span className="h-3 w-3 rounded border border-amber-500/40 bg-amber-500/30" /> Rev. tecnica</span>
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-2"><span className="h-3 w-3 rounded border border-sky-400/40 bg-sky-400/30" /> Aluminio</span>
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-2"><span className="h-3 w-3 rounded border border-purple-400/40 bg-purple-400/30" /> Reproceso</span>
    </div>
  );
};

export default ShelfGridLegend;
