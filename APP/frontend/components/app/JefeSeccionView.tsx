/**
 * JefeSeccionView — Vista del jefe de sección en móvil.
 * Acceso directo a su estantería. Sin sidebar. Sin carros. Sin almacén.
 *
 * Cascarón fino: el header con la botonera y el cuerpo del flujo los aporta el
 * motor operativo único (useOperativeShelf + OperativeShelfArea).
 */

import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';
import { buildOperativeConfig } from '../../lib/operative/operativeConfig';
import { useOperativeShelf } from '../../hooks/useOperativeShelf';
import OperativeShelfArea from '../operative/OperativeShelfArea';
import OperativeActionButtons from '../operative/OperativeActionButtons';

interface JefeSeccionViewProps {
  onBack?: () => void;
}

const JefeSeccionView: React.FC<JefeSeccionViewProps> = ({ onBack }) => {
  const { displayName, operarioId, firebaseUser, section, assignedShelf, logout } = useAuth();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';

  // assignedShelf contiene el CÓDIGO de estantería correcto (ej: 'PLE' para PLEGADORA).
  // NO usar `section` directamente — es el nombre de la sección ('PLEGADORA'), no el código.
  const shelfCode = assignedShelf ?? SHELF_DEFINITIONS[0]?.code ?? 'MEC';
  const shelfDef = SHELF_DEFINITIONS.find((s) => s.code === shelfCode);

  const config = useMemo(
    () => buildOperativeConfig('JEFE_SECCION', { lockedShelfCode: shelfCode, section }),
    [shelfCode, section],
  );

  const engine = useOperativeShelf({
    config,
    shelfCode,
    operarioId: effectiveOperarioId,
    displayName,
  });

  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <span className="text-2xl">🏭</span>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none truncate">
                {shelfDef?.name ?? shelfCode ?? 'Mi Sección'}
              </h1>
              <p className="text-[10px] text-slate-500 truncate leading-none mt-0.5">{displayName} · {operarioId}</p>
            </div>
          </div>

          <OperativeActionButtons engine={engine} config={config} />

          <button
            onClick={onBack ? onBack : logout}
            className="px-2 py-1 text-[11px] font-bold bg-slate-100 text-slate-700 rounded-lg whitespace-nowrap flex-shrink-0">
            {onBack ? 'Volver' : 'Salir'}
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 min-w-0 w-full overflow-hidden">
        <OperativeShelfArea engine={engine} config={config} fullscreenGrid />
      </main>
    </div>
  );
};

export default JefeSeccionView;
