/**
 * CarretilleroView — Vista principal del carretillero (y modo "Operar" de admin).
 * Gestor de Estanterías WMS v3.0
 *
 * Cascarón fino: aporta el chrome propio (sidebar de secciones + carros,
 * pestañas, recogidas) y delega TODO el flujo operativo al motor único
 * (useOperativeShelf + OperativeShelfArea). Antes usaba ShelfNavigator, que
 * reimplementaba el flujo de forma divergente respecto al kiosko.
 */

import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import PickupQueue from './PickupQueue';
import CarrosView from './CarrosView';
import { SHELF_DEFINITIONS, SECTION_DISPLAY_NAMES } from '../../lib/firestoreSchema';
import { buildOperativeConfig } from '../../lib/operative/operativeConfig';
import { useOperativeShelf } from '../../hooks/useOperativeShelf';
import OperativeShelfArea from '../operative/OperativeShelfArea';
import OperativeActionButtons from '../operative/OperativeActionButtons';

type CarretilleroTab = 'shelves' | 'pickups' | 'carts';

interface CarretilleroViewProps {
  onBack?: () => void;
  initialTab?: CarretilleroTab;
}

const CarretilleroView: React.FC<CarretilleroViewProps> = ({ onBack, initialTab = 'shelves' }) => {
  const { role, displayName, operarioId, firebaseUser, logout } = useAuth();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';
  const { pendingCount } = usePickupQueue();

  const [activeTab, setActiveTab] = useState<CarretilleroTab>(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [selectedShelf, setSelectedShelf] = useState<string>(SHELF_DEFINITIONS[0]?.code ?? 'PRE');

  const effectiveRole = role ?? 'CARRETILLERO';
  const config = useMemo(
    () => buildOperativeConfig(effectiveRole, { currentShelfCode: selectedShelf }),
    [effectiveRole, selectedShelf],
  );

  const engine = useOperativeShelf({
    config,
    shelfCode: selectedShelf,
    setShelfCode: setSelectedShelf,
    operarioId: effectiveOperarioId,
    displayName,
  });

  const isIdle = engine.action === 'idle';
  const titleByRole = effectiveRole === 'CARRETILLERO' ? 'CARRETILLERO' : 'OPERAR';

  const selectShelf = (code: string) => {
    if (!isIdle) {
      engine.cancelAction();
    }
    setSelectedShelf(code);
    setActiveTab('shelves');
  };

  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
      {/* Header — responsive: una línea en escritorio, dos en móvil */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-2 sm:px-3 py-1 sm:py-2 shadow-sm">
        {/* Línea 1: Título + Info */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 min-h-10">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-shrink-0">
            <span className="text-lg sm:text-xl flex-shrink-0">🚚</span>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none truncate">
                {engine.shelfDef?.name || titleByRole}
              </h1>
              <p className="text-[8px] sm:text-[10px] text-slate-500 truncate leading-none mt-0.5">{displayName} · {operarioId}</p>
            </div>
          </div>

          {/* Botones derechos (RECOGIDAS + Salir) */}
          <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
            {effectiveRole === 'CARRETILLERO' && (
              <button onClick={() => {
                if (!isIdle) engine.cancelAction();
                setActiveTab(activeTab === 'pickups' ? 'shelves' : 'pickups');
              }}
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${
                  activeTab === 'pickups' ? 'bg-orange-500 text-white shadow-md' : 'bg-orange-100 text-orange-700'
                }`}>
                📦 REC{pendingCount > 0 && <span className="ml-0.5 font-black">({pendingCount})</span>}
              </button>
            )}
            <button onClick={onBack ? onBack : logout}
              className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-bold bg-slate-100 text-slate-700 rounded-lg whitespace-nowrap">
              {onBack ? '‹' : '⏚'}
            </button>
          </div>
        </div>

        {/* Línea 2: Botones de acciones */}
        {activeTab === 'shelves' && (
          <div className="flex items-center justify-center pt-1 mt-0.5 border-t border-slate-100 flex-wrap gap-0.5">
            <OperativeActionButtons engine={engine} config={config} size="compact" />
          </div>
        )}
      </header>

      {/* Contenido */}
      <main className="flex-1 min-h-0 min-w-0 w-full overflow-hidden flex flex-row">
        {/* Barra lateral */}
        <aside className={`flex-shrink-0 bg-slate-100 border-r border-slate-200 flex flex-col overflow-hidden transition-all duration-200 ${
          sidebarOpen && isIdle ? 'w-40 sm:w-48' : 'w-10'
        }`}>
          <button onClick={() => setSidebarOpen((o) => !o)}
            className="flex-shrink-0 h-10 w-full flex items-center justify-center border-b border-slate-200 bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500 font-bold text-lg">
            {sidebarOpen && isIdle ? '‹' : '›'}
          </button>

          {sidebarOpen && isIdle && (
            <div className="flex-1 overflow-y-auto flex flex-col [scrollbar-width:thin]">
              <div className="flex-1">
                {(() => {
                  const seen = new Set<string>();
                  const sections = SHELF_DEFINITIONS
                    .map((s) => s.section)
                    .filter((sec) => { if (seen.has(sec)) return false; seen.add(sec); return true; });
                  return sections.map((sec) => (
                    <React.Fragment key={sec}>
                      <p className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {SECTION_DISPLAY_NAMES[sec] ?? sec}
                      </p>
                      {SHELF_DEFINITIONS.filter((s) => s.section === sec).map((shelf) => (
                        <button key={shelf.code}
                          onClick={() => selectShelf(shelf.code)}
                          className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors truncate ${
                            activeTab === 'shelves' && selectedShelf === shelf.code
                              ? 'bg-sky-500 text-white'
                              : 'text-slate-600 hover:bg-slate-200'
                          }`}>
                          {shelf.name}
                        </button>
                      ))}
                    </React.Fragment>
                  ));
                })()}
              </div>

              <div className="flex-shrink-0 border-t border-slate-300 pb-2">
                <p className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Carros</p>
                <button onClick={() => setActiveTab('carts')}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                    activeTab === 'carts' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-200'
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
            <OperativeShelfArea engine={engine} config={config} setShelfCode={setSelectedShelf} fullscreenGrid />
          ) : activeTab === 'pickups' ? (
            <div className="h-full overflow-y-auto">
              <PickupQueue currentShelf={selectedShelf} />
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
