/**
 * JefeSeccionView — Vista del jefe de sección en móvil
 * Acceso directo a su estantería. Sin sidebar. Sin carros. Sin almacén.
 */

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import ShelfNavigator, { type NavAction } from '../carretillero/ShelfNavigator';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';

interface JefeSeccionViewProps {
  onBack?: () => void;
}

const JefeSeccionView: React.FC<JefeSeccionViewProps> = ({ onBack }) => {
  const { displayName, operarioId, section, logout } = useAuth();
  const [currentShelfAction, setCurrentShelfAction] = useState<NavAction>('idle');
  const [pendingShelfAction, setPendingShelfAction] = useState<NavAction | null>(null);

  const shelfDef = SHELF_DEFINITIONS.find(s => s.code === section);

  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          {/* Título */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <span className="text-xl">🏭</span>
            <div className="min-w-0">
              <h1 className="text-base font-black text-slate-900 tracking-tight leading-none truncate">
                {shelfDef?.name ?? section ?? 'Mi Sección'}
              </h1>
              <p className="text-[10px] text-slate-500 truncate leading-none mt-0.5">{displayName} · {operarioId}</p>
            </div>
          </div>

          {/* Botones de acción (sólo cuando no hay acción activa) */}
          {currentShelfAction === 'idle' && (
            <div className="flex items-center gap-1 flex-wrap justify-center">
              <button onClick={() => setPendingShelfAction('ubicar')}
                className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold active:scale-95 transition-all touch-manipulation whitespace-nowrap">
                📦 UBICAR
              </button>
              <button onClick={() => setPendingShelfAction('retirar')}
                className="px-2 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold active:scale-95 transition-all touch-manipulation whitespace-nowrap">
                📤 RETIRAR
              </button>
              <button onClick={() => setPendingShelfAction('mover')}
                className="px-2 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold active:scale-95 transition-all touch-manipulation whitespace-nowrap">
                🔄 MOVER
              </button>
              <button onClick={() => setPendingShelfAction('avisar')}
                className="px-2 py-1 rounded-lg bg-orange-500 text-white text-[11px] font-bold active:scale-95 transition-all touch-manipulation whitespace-nowrap">
                🔔 AVISAR
              </button>
            </div>
          )}

          {/* Salir */}
          <button
            onClick={onBack ? onBack : logout}
            className="px-2 py-1 text-[11px] font-bold bg-slate-100 text-slate-700 rounded-lg whitespace-nowrap flex-shrink-0">
            {onBack ? 'Volver' : 'Salir'}
          </button>
        </div>
      </header>

      {/* Contenido — ShelfNavigator bloqueado a la sección del jefe */}
      <main className="flex-1 min-h-0 min-w-0 w-full overflow-hidden">
        <ShelfNavigator
          shelfCode={section ?? undefined}
          onActionChange={setCurrentShelfAction}
          externalActionTrigger={pendingShelfAction}
          onExternalActionConsumed={() => setPendingShelfAction(null)}
        />
      </main>
    </div>
  );
};

export default JefeSeccionView;
