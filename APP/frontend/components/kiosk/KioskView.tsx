import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useKiosk } from '../../hooks/useKiosk';
import ShelfSelector from './ShelfSelector';
import DeviceInfoModal from '../common/DeviceInfoModal';
import KioskEmptyState from './KioskEmptyState';
import KioskHeader from './KioskHeader';
import { buildOperativeConfig } from '../../lib/operative/operativeConfig';
import { useOperativeShelf } from '../../hooks/useOperativeShelf';
import OperativeShelfArea from '../operative/OperativeShelfArea';
import OperativeActionButtons from '../operative/OperativeActionButtons';

/**
 * KioskView — Vista del kiosko (rol OPERARIO).
 *
 * Cascarón fino: conserva el chrome propio del kiosko (cabecera, selector de
 * estantería del dispositivo, landing de acciones, drawer de detalle de celda)
 * y delega TODO el flujo operativo al motor único (useOperativeShelf +
 * OperativeShelfArea). Antes este fichero reimplementaba ~800 líneas de flujo.
 */
const KioskView: React.FC = () => {
  const { assignedShelf, operarioId, firebaseUser, section, displayName, logout, kioskId, deviceId } = useAuth();
  // Usuarios con auth por email (p.ej. JEFE_SECCION en modo operativo) no tienen
  // operarioId numérico; usamos su UID para mantener la trazabilidad.
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';

  const { kiosk, shelves, currentShelf, setCurrentShelf } = useKiosk(kioskId);
  const shelfCode = currentShelf || assignedShelf || '';

  const [showDeviceInfo, setShowDeviceInfo] = useState(false);
  // Mostrar la estantería directamente al entrar (los kioskos de sección deben
  // ver su(s) estantería(s) sin pasar por la pantalla de acciones). Las acciones
  // (UBICAR/RETIRAR/...) quedan accesibles en la cabecera vía OperativeActionButtons.
  const [showShelf, setShowShelf] = useState(true);

  const config = useMemo(
    () => buildOperativeConfig('OPERARIO', { lockedShelfCode: shelfCode, section }),
    [shelfCode, section],
  );

  const engine = useOperativeShelf({
    config,
    shelfCode,
    operarioId: effectiveOperarioId,
    displayName,
  });

  const { action, loading, shelfDef, totalArticles, totalOccupied, totalEmpty, cancelAction, startAction } = engine;

  // Loading state takes priority to avoid race condition with empty state
  if (loading && !shelfCode) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-sky-50">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-400 font-medium">Cargando estanteria...</p>
      </div>
    );
  }

  if (!shelfCode) return <KioskEmptyState />;

  const showArea = showShelf || action !== 'idle';

  return (
    <div className="h-dvh w-full bg-sky-50 flex flex-col relative overflow-hidden">
      <KioskHeader
        shelfName={shelfDef?.name || ''}
        shelfCode={shelfCode}
        totalOccupied={totalOccupied}
        totalEmpty={totalEmpty}
        totalArticles={totalArticles}
        displayName={displayName}
        operarioId={operarioId}
        deviceId={deviceId}
        onLogout={logout}
        onInfo={() => setShowDeviceInfo(true)}
        actionButtons={showShelf && action === 'idle' ? (
          <OperativeActionButtons engine={engine} config={config} />
        ) : undefined}
      />

      {kiosk && shelves.length > 1 && (
        <div className="bg-sky-50 border-b border-slate-200 px-4 py-2 flex justify-center">
          <ShelfSelector
            shelves={shelves}
            currentShelf={currentShelf}
            onSelectShelf={(s) => {
              if (action !== 'idle') {
                cancelAction();
              }
              setCurrentShelf(s);
            }}
          />
        </div>
      )}

      {!showArea ? (
        <main className="flex-1 flex flex-col items-center justify-center p-4 w-full">
          <div className="grid grid-cols-2 gap-4 w-full max-w-6xl">
            <button onClick={() => startAction('ubicar')} className="h-32 rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 active:scale-95 text-white font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-emerald-950/40 transition-all"><span className="text-4xl">📦</span>UBICAR</button>
            <button onClick={() => startAction('retirar')} className="h-32 rounded-3xl border border-red-400/20 bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 active:scale-95 text-white font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-red-950/40 transition-all"><span className="text-4xl">📤</span>RETIRAR</button>
            <button onClick={() => startAction('mover')} className="h-32 rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 active:scale-95 text-white font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-blue-950/40 transition-all"><span className="text-4xl">🔄</span>MOVER</button>
            {config.actions.almacen !== 'none' ? (
              <button onClick={() => startAction('almacen')} className="h-32 rounded-3xl border border-purple-400/20 bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 active:scale-95 text-white font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-purple-950/40 transition-all"><span className="text-4xl">🏭</span>ALMACÉN</button>
            ) : config.actions.avisar !== 'none' ? (
              <button onClick={() => startAction('avisar')} className="h-32 rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 active:scale-95 text-white font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-amber-950/40 transition-all"><span className="text-4xl">🚚</span>CARRETILLERO</button>
            ) : <div />}
          </div>
          <button onClick={() => setShowShelf(true)} className="mt-8 px-6 py-3 rounded-full bg-white border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition-colors shadow-sm">
            Mostrar estantería
          </button>
        </main>
      ) : (
        <div className="flex-1 min-h-0 min-w-0 w-full flex flex-col">
          {action === 'idle' && (
            <div className="flex justify-end px-2 pt-2">
              <button onClick={() => setShowShelf(false)} className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 text-xs transition-colors shadow-sm">
                Ocultar estantería
              </button>
            </div>
          )}
          <OperativeShelfArea engine={engine} config={config} fullscreenGrid forceSingleBlock />
        </div>
      )}

      {/* La inspección de celda la renderiza OperativeShelfArea (antes se
          mostraban DOS overlays apilados: este drawer + el modal del área). */}
      {showDeviceInfo && (
        <DeviceInfoModal deviceId={deviceId} onClose={() => setShowDeviceInfo(false)} />
      )}
    </div>
  );
};

export default KioskView;
