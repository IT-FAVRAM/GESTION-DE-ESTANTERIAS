import React from 'react';

interface ShelfGridLegendProps {
  compact?: boolean;
}

// Muestras con los MISMOS colores que pinta ShelfRackView en cada estado.
const ITEMS: Array<{ label: string; bg: string; border: string }> = [
  { label: 'Vacío', bg: '#FAFAF7', border: 'rgba(148,163,184,0.7)' },
  { label: 'Ocupado', bg: 'rgba(219,234,254,1)', border: 'rgba(59,130,246,0.55)' },
  { label: 'Urgente', bg: 'rgba(254,226,226,1)', border: 'rgba(239,68,68,0.65)' },
  { label: 'Rev. técnica / Aluminio', bg: 'rgba(254,243,199,1)', border: 'rgba(245,158,11,0.6)' },
  { label: 'Búsqueda', bg: 'rgba(253,242,248,1)', border: 'rgba(236,72,153,0.75)' },
  { label: 'Seleccionado', bg: 'rgba(224,242,254,1)', border: 'rgba(14,165,233,0.7)' },
];

const ShelfGridLegend: React.FC<ShelfGridLegendProps> = ({ compact = false }) => {
  if (compact) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
      {ITEMS.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
          <span className="h-3.5 w-3.5 rounded" style={{ background: it.bg, border: `1.5px solid ${it.border}` }} />
          {it.label}
        </span>
      ))}
    </div>
  );
};

export default ShelfGridLegend;
