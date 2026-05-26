import React from 'react';
import { formatEuros } from '../../lib/api/reprocesosApi';

interface CalidadReprocesosSectionProps {
  canViewReprocessCosts: boolean;
  canEditReprocesses: boolean;
  totalImporte: number;
  totalPiezas: number;
  oldestDays?: number;
}

const CalidadReprocesosSection: React.FC<CalidadReprocesosSectionProps> = ({
  canViewReprocessCosts,
  canEditReprocesses,
  totalImporte,
  totalPiezas,
  oldestDays,
}) => (
  <>
    {canViewReprocessCosts && (
      <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-300/60 font-bold uppercase">Total Reprocesos</p>
            <p className="text-xs text-slate-400">{totalPiezas} piezas en CAL 001-022</p>
          </div>
          <p className="text-xl font-black text-amber-300">{formatEuros(totalImporte)}</p>
        </div>
        {oldestDays !== undefined && oldestDays > 0 && (
          <p className={`mt-1 text-xs font-bold ${oldestDays > 30 ? 'text-red-400' : oldestDays > 7 ? 'text-amber-400' : 'text-slate-500'}`}>
            ⏱ Artículo más antiguo: {oldestDays} día{oldestDays !== 1 ? 's' : ''} sin mover
            {oldestDays > 30 ? ' — dinero parado' : ''}
          </p>
        )}
      </div>
    )}

    <div className={`mx-4 mt-3 rounded-2xl border px-4 py-3 ${
      canEditReprocesses ? 'border-amber-500/20 bg-amber-500/10' : 'border-slate-800 bg-slate-900/70'
    }`}>
      <p className={`text-xs font-black uppercase tracking-[0.18em] ${
        canEditReprocesses ? 'text-amber-300/75' : 'text-slate-500'
      }`}>
        Reprocesos CAL 001-022
      </p>
      <p className={`mt-1 text-sm ${canEditReprocesses ? 'text-slate-200' : 'text-slate-400'}`}>
        {canEditReprocesses
          ? 'Pulsa cualquier ubicacion de CAL 001-022 — vacia o con articulos — para registrar o editar cantidad e importe. El total solo se muestra en sesiones con acceso a costes.'
          : 'Tu sesion actual no permite editar reprocesos en CAL 001-022.'}
      </p>
    </div>
  </>
);

export default CalidadReprocesosSection;


