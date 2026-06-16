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
import { buildOperativeConfig, canUseScanTray } from '../../lib/operative/operativeConfig';
import { useOperativeShelf } from '../../hooks/useOperativeShelf';
import OperativeShelfArea from '../operative/OperativeShelfArea';
import OperativeActionButtons from '../operative/OperativeActionButtons';
import OperativeActionBar from '../operative/OperativeActionBar';
import AppHeader from '../common/AppHeader';
import { useFormFactor } from '../../hooks/useFormFactor';

const SHELF = 'CAL';

const CalidadView: React.FC = () => {
  const { operarioId, firebaseUser, displayName, logout, canEditReprocesses, canViewReprocessCosts } = useAuth();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';
  const isTouch = useFormFactor() !== 'desktop';

  const config = useMemo(
    () => buildOperativeConfig('CALIDAD', { canEditReprocesses, canViewReprocessCosts }),
    [canEditReprocesses, canViewReprocessCosts],
  );

  const engine = useOperativeShelf({
    config,
    shelfCode: SHELF,
    operarioId: effectiveOperarioId,
    displayName,
    enableScanTray: canUseScanTray('CALIDAD', firebaseUser?.email),
  });

  const { locations } = engine;

  // Totales de reprocesos (cabecera)
  // Solo incluir CAL 001-022 con items que tengan quantity > 0
  const reprocesosItems = useMemo(
    () => locations
      .filter((l) => {
        const posNum = parseInt(l.position, 10);
        return !isNaN(posNum) && posNum >= 1 && posNum <= 22;
      })
      .flatMap((l) => (l.items || []).filter((item) => item.quantity != null && item.quantity > 0)),
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
      <AppHeader
        icon="🔍"
        title="Calidad — CAL"
        subtitle={displayName}
        center={isTouch ? undefined : <OperativeActionButtons engine={engine} config={config} />}
        onLogout={logout}
      />

      <CalidadReprocesosSection
        canViewReprocessCosts={canViewReprocessCosts}
        canEditReprocesses={canEditReprocesses}
        totalImporte={totalImporte}
        totalPiezas={totalPiezas}
        oldestDays={oldestDays}
      />

      <main className="flex-1 min-h-0 min-w-0 w-full overflow-hidden">
        <OperativeShelfArea engine={engine} config={config} fullscreenGrid userSection={null} />
      </main>

      {isTouch && <OperativeActionBar engine={engine} config={config} />}
    </div>
  );
};

export default CalidadView;
