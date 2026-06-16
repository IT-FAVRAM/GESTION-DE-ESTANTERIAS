/**
 * CarretilleroView — Vista principal del carretillero (y modo "Operar" de admin).
 * Gestor de Estanterías WMS v3.0
 *
 * Cascarón fino: aporta el chrome propio (sidebar de secciones + carros,
 * pestañas, recogidas) y delega TODO el flujo operativo al motor único
 * (useOperativeShelf + OperativeShelfArea). Antes usaba ShelfNavigator, que
 * reimplementaba el flujo de forma divergente respecto al kiosko.
 */

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import PickupQueue from './PickupQueue';
import CarrosView from './CarrosView';
import { SHELF_DEFINITIONS, SECTION_DISPLAY_NAMES } from '../../lib/firestoreSchema';
import { buildOperativeConfig, canUseScanTray } from '../../lib/operative/operativeConfig';
import { useOperativeShelf } from '../../hooks/useOperativeShelf';
import OperativeShelfArea from '../operative/OperativeShelfArea';
import OperativeActionButtons from '../operative/OperativeActionButtons';
import OperativeActionBar from '../operative/OperativeActionBar';
import AppHeader from '../common/AppHeader';
import { useFormFactor } from '../../hooks/useFormFactor';

const ChaperoView = React.lazy(() => import('../chapero/ChaperoView'));

type CarretilleroTab = 'shelves' | 'pickups' | 'carts' | 'chapero';

interface CarretilleroViewProps {
  onBack?: () => void;
  initialTab?: CarretilleroTab;
  chatButton?: React.ReactNode;
}

const CarretilleroView: React.FC<CarretilleroViewProps> = ({ onBack, initialTab = 'shelves', chatButton }) => {
  const { role, displayName, operarioId, firebaseUser, email, logout } = useAuth();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';
  const { pendingCount } = usePickupQueue();

  const formFactor = useFormFactor();
  const isTouch = formFactor !== 'desktop';

  const [activeTab, setActiveTab] = useState<CarretilleroTab>(initialTab);
  // Sidebar abierto por defecto solo en escritorio. Reacciona a la rotación del
  // tablet / cambios de tamaño (antes se fijaba solo al montar y al girar el
  // iPad quedaba en estado incorrecto).
  const [sidebarOpen, setSidebarOpen] = useState(formFactor === 'desktop');
  useEffect(() => { setSidebarOpen(formFactor === 'desktop'); }, [formFactor]);
  const [selectedShelf, setSelectedShelf] = useState<string>(SHELF_DEFINITIONS[0]?.code ?? 'PRE');

  const effectiveRole = role ?? 'CARRETILLERO';
  const config = useMemo(
    () => buildOperativeConfig(effectiveRole, { currentShelfCode: selectedShelf }),
    [effectiveRole, selectedShelf],
  );

  // Bandeja de escaneo (scan-first): solo carretillero + superadmins por email (§7).
  const enableScanTray = useMemo(
    () => canUseScanTray(effectiveRole, email ?? firebaseUser?.email),
    [effectiveRole, email, firebaseUser],
  );

  const engine = useOperativeShelf({
    config,
    shelfCode: selectedShelf,
    setShelfCode: setSelectedShelf,
    operarioId: effectiveOperarioId,
    displayName,
    enableScanTray,
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

  const openChapero = () => {
    if (!isIdle) engine.cancelAction();
    setActiveTab('chapero');
  };

  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
      {/* Header — cabecera única compartida (AppHeader) */}
      <AppHeader
        icon="🚚"
        title={engine.shelfDef?.name || titleByRole}
        subtitle={`${displayName} · ${operarioId}`}
        chatButton={chatButton}
        right={effectiveRole === 'CARRETILLERO' ? (
          <button onClick={() => {
            if (!isIdle) engine.cancelAction();
            setActiveTab(activeTab === 'pickups' ? 'shelves' : 'pickups');
          }}
            className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'pickups' ? 'bg-orange-500 text-white shadow-md' : 'bg-orange-100 text-orange-700'
            }`}>
            📦 REC{pendingCount > 0 && <span className="ml-0.5 font-black">({pendingCount})</span>}
          </button>
        ) : undefined}
        onBack={onBack}
        onLogout={logout}
        secondRow={(activeTab === 'shelves' && !isTouch) ? (
          <div className="flex items-center justify-center flex-wrap gap-0.5">
            <OperativeActionButtons engine={engine} config={config} size="compact" />
          </div>
        ) : activeTab === 'chapero' ? (
          <div className="text-center">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Modo Chapero activo</span>
          </div>
        ) : undefined}
      />

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
                    .filter((sec) => {
                      if (seen.has(sec)) return false;
                      if (sec === 'PINTURA') return false;
                      seen.add(sec);
                      return true;
                    });
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
                <p className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Chapero</p>
                <button onClick={openChapero}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                    activeTab === 'chapero' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-200'
                  }`}>
                  🔩 Chapero
                </button>
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
            <OperativeShelfArea engine={engine} config={config} setShelfCode={setSelectedShelf} fullscreenGrid userSection={null} />
          ) : activeTab === 'pickups' ? (
            <div className="h-full overflow-y-auto">
              <PickupQueue currentShelf={selectedShelf} />
            </div>
          ) : activeTab === 'chapero' ? (
            <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-500 text-sm">Cargando chapero…</div>}>
              <ChaperoView onClose={() => setActiveTab('shelves')} />
            </Suspense>
          ) : (
            <CarrosView />
          )}
        </div>
      </main>

      {isTouch && activeTab === 'shelves' && (
        <OperativeActionBar engine={engine} config={config} />
      )}
    </div>
  );
};

export default CarretilleroView;
