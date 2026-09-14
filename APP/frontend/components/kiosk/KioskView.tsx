import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useKiosk } from '../../hooks/useKiosk';
import { useDeviceConfig } from '../../hooks/useDeviceConfig';
import ShelfSelector from './ShelfSelector';
import DeviceInfoModal from '../common/DeviceInfoModal';
import KioskEmptyState from './KioskEmptyState';
import KioskHeader from './KioskHeader';
import KioskHelpModal from './KioskHelpModal';
import { buildOperativeConfig } from '../../lib/operative/operativeConfig';
import { useOperativeShelf } from '../../hooks/useOperativeShelf';
import OperativeShelfArea from '../operative/OperativeShelfArea';
import OperativeActionButtons from '../operative/OperativeActionButtons';
import OperativeActionBar from '../operative/OperativeActionBar';
import { useFormFactor } from '../../hooks/useFormFactor';
import { getCartsForSection, type WarehouseSection } from '../../lib/firestoreSchema';
import CarrosView from '../carretillero/CarrosView';
import { ArrowLeftRight, Bell, Package, PackageMinus, ShoppingCart, Warehouse } from 'lucide-react';

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
  const { excludedCarts, visualOnly, allowedShelves } = useDeviceConfig(deviceId);
  // Usuarios con auth por email (p.ej. JEFE_SECCION en modo operativo) no tienen
  // operarioId numérico; usamos su UID para mantener la trazabilidad.
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';

  const { kiosk, shelves, currentShelf, setCurrentShelf } = useKiosk(kioskId, allowedShelves);

  // Usar shelves que ahora incluye allowedShelves como fallback
  const effectiveShelves = useMemo(() => {
    const base = kiosk?.shelves || [];
    // Unir con allowedShelves del dispositivo para que la búsqueda pueda navegar
    // a estanterías accesibles que no están en la lista fija del kiosko.
    const merged = new Set([...base, ...allowedShelves]);
    return [...merged];
  }, [kiosk?.shelves, allowedShelves]);
  const shelfCode = currentShelf || assignedShelf || '';

  const [showDeviceInfo, setShowDeviceInfo] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showCarts, setShowCarts] = useState(false);
  // Mostrar la estantería directamente al entrar (los kioskos de sección deben
  // ver su(s) estantería(s) sin pasar por la pantalla de acciones). Las acciones
  // (UBICAR/RETIRAR/...) quedan accesibles en la cabecera vía OperativeActionButtons.
  const [showShelf, setShowShelf] = useState(true);
  const isTouch = useFormFactor() !== 'desktop';

  // Carros disponibles para esta sección, excluyendo los configurados para el dispositivo
  const availableCarts = useMemo(
    () => (section ? getCartsForSection(section as WarehouseSection, excludedCarts) : []),
    [section, excludedCarts],
  );

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

  // Si está viendo carros, mostrar CarrosView
  if (showCarts) {
    return <CarrosView onBack={() => setShowCarts(false)} section={section} />;
  }

  // Loading state takes priority to avoid race condition with empty state
  if (loading && !shelfCode) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-sky-50">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-400 font-medium">Cargando estantería...</p>
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
        onHelp={() => setShowHelp(true)}
        actionButtons={(!isTouch && showShelf && action === 'idle') ? (
          <OperativeActionButtons engine={engine} config={config} />
        ) : undefined}
      />

      {effectiveShelves.length > 1 && (
        <div className="bg-sky-50 border-b border-slate-200 px-4 py-2 flex justify-center">
          <ShelfSelector
            shelves={effectiveShelves}
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
            <button disabled={visualOnly} onClick={() => startAction('ubicar')} className={`h-32 rounded-3xl border border-emerald-400/20 font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl transition-all ${visualOnly ? 'bg-emerald-100 text-emerald-400 cursor-not-allowed opacity-50' : 'bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 active:scale-95 text-white shadow-emerald-950/40'}`}><Package className="w-10 h-10" strokeWidth={2.25} aria-hidden />UBICAR</button>
            <button disabled={visualOnly} onClick={() => startAction('retirar')} className={`h-32 rounded-3xl border border-red-400/20 font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl transition-all ${visualOnly ? 'bg-red-100 text-red-400 cursor-not-allowed opacity-50' : 'bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 active:scale-95 text-white shadow-red-950/40'}`}><PackageMinus className="w-10 h-10" strokeWidth={2.25} aria-hidden />RETIRAR</button>
            <button disabled={visualOnly} onClick={() => startAction('mover')} className={`h-32 rounded-3xl border border-blue-400/20 font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl transition-all ${visualOnly ? 'bg-blue-100 text-blue-400 cursor-not-allowed opacity-50' : 'bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 active:scale-95 text-white shadow-blue-950/40'}`}><ArrowLeftRight className="w-10 h-10" strokeWidth={2.25} aria-hidden />MOVER</button>
            {config.actions.almacen !== 'none' ? (
              <button disabled={visualOnly} onClick={() => startAction('almacen')} className={`h-32 rounded-3xl border border-purple-400/20 font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl transition-all ${visualOnly ? 'bg-purple-100 text-purple-400 cursor-not-allowed opacity-50' : 'bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 active:scale-95 text-white shadow-purple-950/40'}`}><Warehouse className="w-10 h-10" strokeWidth={2.25} aria-hidden />ALMACÉN</button>
            ) : config.actions.avisar !== 'none' ? (
              <button disabled={visualOnly} onClick={() => startAction('avisar')} className={`h-32 rounded-3xl border border-amber-400/20 font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl transition-all ${visualOnly ? 'bg-amber-100 text-amber-400 cursor-not-allowed opacity-50' : 'bg-gradient-to-br from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 active:scale-95 text-white shadow-amber-950/40'}`}><Bell className="w-10 h-10" strokeWidth={2.25} aria-hidden />CARRETILLERO</button>
            ) : <div />}
            {availableCarts.length > 0 && (
              <button disabled={visualOnly} onClick={() => setShowCarts(true)} className={`h-32 rounded-3xl border border-orange-400/20 font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl transition-all ${visualOnly ? 'bg-orange-100 text-orange-400 cursor-not-allowed opacity-50' : 'bg-gradient-to-br from-orange-500 to-orange-700 hover:from-orange-400 hover:to-orange-600 active:scale-95 text-white shadow-orange-950/40'}`}><ShoppingCart className="w-10 h-10" strokeWidth={2.25} aria-hidden />CARROS</button>
            )}
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
          <OperativeShelfArea
            engine={engine}
            config={config}
            fullscreenGrid
            forceSingleBlock
            userSection={null}
            setShelfCode={(code, force) => { if (action !== 'idle') cancelAction(); setCurrentShelf(code, force); }}
            accessibleShelves={effectiveShelves}
          />
        </div>
      )}

      {isTouch && showArea && <OperativeActionBar engine={engine} config={config} />}

      {/* La inspección de celda la renderiza OperativeShelfArea (antes se
          mostraban DOS overlays apilados: este drawer + el modal del área). */}
      {showDeviceInfo && (
        <DeviceInfoModal deviceId={deviceId} onClose={() => setShowDeviceInfo(false)} />
      )}
      {showHelp && <KioskHelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
};

export default KioskView;
