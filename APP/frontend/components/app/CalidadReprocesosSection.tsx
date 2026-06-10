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
      <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-amber-100/60 border-b-2 border-amber-500 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs text-amber-700 font-black uppercase tracking-wider">💰 Total Reprocesos</p>
            <p className="text-xs text-amber-600 mt-0.5">{totalPiezas} piezas en CAL 001-022</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-3xl font-black text-amber-700 leading-none">{formatEuros(totalImporte)}</p>
            <p className="text-[10px] text-amber-600 font-bold mt-1">Dinero en reproceso</p>
          </div>
        </div>
        {oldestDays !== undefined && oldestDays > 0 && (
          <p className={`mt-2 text-xs font-bold px-3 py-2 rounded-lg inline-block ${
            oldestDays > 30
              ? 'bg-red-100 text-red-700'
              : oldestDays > 7
              ? 'bg-amber-200 text-amber-800'
              : 'bg-amber-100 text-amber-700'
          }`}>
            ⏱ Artículo más antiguo: {oldestDays} día{oldestDays !== 1 ? 's' : ''} sin mover
            {oldestDays > 30 ? ' — dinero parado ⚠️' : ''}
          </p>
        )}
      </div>
    )}

    <div className={`hidden sm:block mx-4 mt-3 rounded-2xl border px-4 py-3 ${
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


