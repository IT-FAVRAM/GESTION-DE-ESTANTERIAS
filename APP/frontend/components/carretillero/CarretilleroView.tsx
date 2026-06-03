/**
 * CarretilleroView — Vista principal del carretillero
 * Gestor de Estanterías WMS v3.0
 */

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import ShelfNavigator, { type NavAction } from './ShelfNavigator';
import PickupQueue from './PickupQueue';
import CarrosView from './CarrosView';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';

type CarretilleroTab = 'shelves' | 'pickups' | 'carts';

interface CarretilleroViewProps {
  onBack?: () => void;
  initialTab?: CarretilleroTab;
}

const CarretilleroView: React.FC<CarretilleroViewProps> = ({ onBack, initialTab = 'shelves' }) => {
  const { displayName, operarioId, logout } = useAuth();
  const { pendingCount } = usePickupQueue();
  const [activeTab, setActiveTab] = useState<CarretilleroTab>(initialTab);
  const [currentShelfAction, setCurrentShelfAction] = useState<NavAction>('idle');
  const [pendingShelfAction, setPendingShelfAction] = useState<NavAction | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [currentShelfCode, setCurrentShelfCode] = useState<string>(SHELF_DEFINITIONS[0]?.code ?? 'MEC');
  const [pendingShelfSelect, setPendingShelfSelect] = useState<string | null>(null);

  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          {/* Título */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <span className="text-xl">🚚</span>
            <div className="min-w-0">
              <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">CARRETILLERO</h1>
              <p className="text-[10px] text-slate-500 truncate leading-none mt-0.5">{displayName} · {operarioId}</p>
            </div>
          </div>

          {/* Botones de acción (sólo en pestaña estanterías y sin acción activa) */}
          {activeTab === 'shelves' && currentShelfAction === 'idle' && (
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
              <button onClick={() => setPendingShelfAction('almacen')}
                className="px-2 py-1 rounded-lg bg-purple-600 text-white text-[11px] font-bold active:scale-95 transition-all touch-manipulation whitespace-nowrap">
                🏭 ALMACÉN
              </button>
            </div>
          )}

          {/* Derecha: RECOGIDAS + Salir */}
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => setActiveTab(activeTab === 'pickups' ? 'shelves' : 'pickups')}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'pickups'
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-orange-100 text-orange-700'
              }`}>
              📦 RECOGIDAS{pendingCount > 0 && <span className="ml-1 font-black">({pendingCount})</span>}
            </button>
            <button
              onClick={onBack ? onBack : logout}
              className="px-2 py-1 text-[11px] font-bold bg-slate-100 text-slate-700 rounded-lg whitespace-nowrap">
              {onBack ? 'Volver' : 'Salir'}
            </button>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 min-h-0 min-w-0 w-full overflow-hidden flex flex-row">
        {/* Barra lateral */}
        <aside className={`flex-shrink-0 bg-slate-100 border-r border-slate-200 flex flex-col overflow-hidden transition-all duration-200 ${
          sidebarOpen && currentShelfAction === 'idle' ? 'w-40 sm:w-48' : 'w-10'
        }`}>
          {/* Toggle */}
          <button onClick={() => setSidebarOpen(o => !o)}
            className="flex-shrink-0 h-10 w-full flex items-center justify-center border-b border-slate-200 bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500 font-bold text-lg">
            {sidebarOpen && currentShelfAction === 'idle' ? '‹' : '›'}
          </button>

          {sidebarOpen && currentShelfAction === 'idle' && (
            <div className="flex-1 overflow-y-auto flex flex-col [scrollbar-width:thin]">
              {/* Estanterías */}
              <div className="flex-1">
                <p className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Estanterías</p>
                {SHELF_DEFINITIONS.map(shelf => (
                  <button key={shelf.code}
                    onClick={() => {
                      setPendingShelfSelect(shelf.code);
                      setCurrentShelfCode(shelf.code);
                      setActiveTab('shelves');
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors truncate ${
                      activeTab === 'shelves' && currentShelfCode === shelf.code
                        ? 'bg-sky-500 text-white'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}>
                    {shelf.name}
                  </button>
                ))}
              </div>

              {/* Carros */}
              <div className="flex-shrink-0 border-t border-slate-300 pb-2">
                <p className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Carros</p>
                <button
                  onClick={() => setActiveTab('carts')}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                    activeTab === 'carts'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}>
                  🛒 Ver carros
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Área principal */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          {activeTab === 'shelves' ? (
            <ShelfNavigator
              onActionChange={setCurrentShelfAction}
              externalActionTrigger={pendingShelfAction}
              onExternalActionConsumed={() => setPendingShelfAction(null)}
              externalShelfTrigger={pendingShelfSelect}
              onExternalShelfConsumed={() => setPendingShelfSelect(null)}
            />
          ) : activeTab === 'pickups' ? (
            <div className="h-full overflow-y-auto">
              <PickupQueue />
            </div>
          ) : (
            <CarrosView />
          )}
        </div>
      </main>
    </div>
  );
};

export default CarretilleroView;
