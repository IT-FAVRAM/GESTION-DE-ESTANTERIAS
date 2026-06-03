/**
 * CalidadView — Vista de Calidad (estantería CAL, con reprocesos).
 *
 * Cascarón fino: conserva su chrome propio (cabecera con totales de reprocesos)
 * y delega el flujo operativo al motor único. La lógica de reprocesos
 * (importe/cantidad al ubicar, editor de celda, costes en el grid) la gestiona
 * el motor a través de `config.reprocesos`.
 */

import React, { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { isReprocesosLocation } from '../../lib/firestoreSchema';
import { calcReprocesosTotal } from '../../lib/api/reprocesosApi';
import CalidadReprocesosSection from './CalidadReprocesosSection';
import { buildOperativeConfig } from '../../lib/operative/operativeConfig';
import { useOperativeShelf } from '../../hooks/useOperativeShelf';
import OperativeShelfArea from '../operative/OperativeShelfArea';
import OperativeActionButtons from '../operative/OperativeActionButtons';

const SHELF = 'CAL';

const CalidadView: React.FC = () => {
  const { operarioId, firebaseUser, displayName, logout, canEditReprocesses, canViewReprocessCosts } = useAuth();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';

  const config = useMemo(
    () => buildOperativeConfig('CALIDAD', { canEditReprocesses, canViewReprocessCosts }),
    [canEditReprocesses, canViewReprocessCosts],
  );

  const engine = useOperativeShelf({
    config,
    shelfCode: SHELF,
    operarioId: effectiveOperarioId,
    displayName,
  });

  const { locations } = engine;

  // Totales de reprocesos (cabecera)
  const reprocesosItems = useMemo(
    () => locations
      .filter((l) => isReprocesosLocation(SHELF, parseInt(l.position, 10)))
      .flatMap((l) => l.items || []),
    [locations],
  );
  const { totalImporte, totalPiezas } = calcReprocesosTotal(reprocesosItems);
  const oldestDays = useMemo(() => {
    if (reprocesosItems.length === 0) return 0;
    const now = Date.now();
    const times = reprocesosItems.map((i) => new Date(i.locatedAt).getTime()).filter((t) => !isNaN(t));
    if (times.length === 0) return 0;
    return Math.floor((now - Math.min(...times)) / 86_400_000);
  }, [reprocesosItems]);

  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <span className="text-xl">🔍</span>
            <div className="min-w-0">
              <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">Calidad — CAL</h1>
              <p className="text-[10px] text-slate-500 truncate leading-none mt-0.5">{displayName}</p>
            </div>
          </div>

          <OperativeActionButtons engine={engine} config={config} />

          <button onClick={logout}
            className="px-2 py-1 text-[11px] font-bold bg-slate-100 text-slate-700 rounded-lg whitespace-nowrap flex-shrink-0">
            Salir
          </button>
        </div>
      </header>

      <CalidadReprocesosSection
        canViewReprocessCosts={canViewReprocessCosts}
        canEditReprocesses={canEditReprocesses}
        totalImporte={totalImporte}
        totalPiezas={totalPiezas}
        oldestDays={oldestDays}
      />

      <main className="flex-1 min-h-0 min-w-0 w-full overflow-hidden">
        <OperativeShelfArea engine={engine} config={config} fullscreenGrid />
      </main>
    </div>
  );
};

export default CalidadView;
