/**
 * OperativeShelfArea — Cuerpo presentacional del motor operativo único.
 *
 * Renderiza, debajo del header de cada rol: barra de estado de acción, barra de
 * lote, buscador, grid y TODOS los modales del flujo. Consume el `engine`
 * (useOperativeShelf) que le pasa la vista del rol.
 *
 * Todo el comportamiento vive en el hook; aquí solo hay JSX. Así KIOSKO,
 * CARRETILLERO, JEFE_SECCIÓN, CALIDAD y ADMIN comparten exactamente la misma UI
 * de flujo y es imposible que diverjan.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { ScanLine } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS } from '../../lib/schema/collections';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskSearchBar from '../kiosk/KioskSearchBar';
import ScannerInput from '../kiosk/ScannerInput';
import ScanMethodPicker from '../common/ScanMethodPicker';
import SubcontratacionCapture from './SubcontratacionCapture';
import ConfirmationModal from '../common/ConfirmationModal';
// Escáneres de cámara/QR: lazy. Arrastran html5-qrcode/tesseract (pesados) y solo
// se abren bajo demanda, así no lastran la carga del área de estanterías.
const CameraQRScanner = React.lazy(() => import('../common/CameraQRScanner'));
const CameraOCRScanner = React.lazy(() => import('../common/CameraOCRScanner'));
const QRScanner = React.lazy(() => import('../common/QRScanner'));
import RetirarArticleList from '../kiosk/RetirarArticleList';
import RetirarCellModal from '../kiosk/RetirarCellModal';
import HistoryModal from '../kiosk/HistoryModal';
import MoverArticleList from '../kiosk/MoverArticleList';
import ReprocesosUbicacionModal from '../kiosk/ReprocesosUbicacionModal';
import ReprocesosEditor from '../kiosk/ReprocesosEditor';
import RecogidaModal from '../kiosk/RecogidaModal';
import TraerArticuloModal from '../kiosk/TraerArticuloModal';
import CarretilleroPicker from '../carretillero/CarretilleroPicker';
import SoldaduraStationPicker from '../common/SoldaduraStationPicker';
import { REQUEST_SECTIONS, type RequestSection } from '../../lib/operative/requestSections';
import type { CarretilleroOption } from '../../lib/api/pickupQueueApi';
import AddShelfPositionModal from './AddShelfPositionModal';
import ScanTray from './ScanTray';
import OperativeKpiStrip from './OperativeKpiStrip';
import OperativeShelfSidebar from './OperativeShelfSidebar';
import LocationPhotoGallery from '../common/LocationPhotoGallery';
import PhotoCarousel from '../common/PhotoCarousel';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';
import { parseScanInput, parseScanInputLenient } from '../../lib/qrParser';
import { validateContiguity } from '../../lib/contiguityValidator';
import { useScannerCapture } from '../../hooks/useScannerCapture';
import { useUrgentAlerts } from '../../hooks/useUrgentAlerts';
import { useFormFactor } from '../../hooks/useFormFactor';
import { useOperativeKeyboardShortcuts } from '../../hooks/useOperativeKeyboardShortcuts';
import type { GlobalSearchResult } from '../../hooks/useGlobalSearchWithCache';
import type { RoleOperativeConfig } from '../../lib/operative/operativeConfig';
import type { UseOperativeShelfReturn } from '../../hooks/useOperativeShelf';

interface OperativeShelfAreaProps {
  engine: UseOperativeShelfReturn;
  config: RoleOperativeConfig;
  /** El chrome puede cambiar de sección (scope='all'). force=true bypass para navegación por búsqueda. */
  setShelfCode?: (code: string, force?: boolean) => void;
  /** Grid a pantalla completa (kiosko / carretillero). */
  fullscreenGrid?: boolean;
  /** Kiosk mode: always show one block at a time with navigation. */
  forceSingleBlock?: boolean;
  /** Sección asignada del usuario (para JEFE_SECCION) */
  userSection?: string | null;
  /**
   * Estanterías a las que el rol limitado (OPERARIO/JEFE) puede navegar desde el
   * buscador (su estantería + secciones accesibles). Si el rol es de ámbito total
   * (carretillero/admin) se ignora: puede navegar a cualquier estantería.
   */
  accessibleShelves?: string[] | null;
  /**
   * Activa el sidebar de navegación de estanterías en escritorio (#2 layout 2
   * paneles). Opt-in: solo lo usan vistas que NO tienen ya su propia navegación
   * lateral (p.ej. JEFE_SECCION). Carretillero/Admin tienen aside propio.
   */
  enableShelfSidebar?: boolean;
}

const padPos = (p: string) => parseInt(p, 10);
const displayPos = (p: string) => { const n = parseInt(p, 10); return Number.isNaN(n) ? p : String(n); };
/** Número de posición legible a partir de "SHELF_pos" o "pos". */
const positionNumber = (posStr: string): string => {
  const idx = posStr.lastIndexOf('_');
  const raw = idx >= 0 ? posStr.slice(idx + 1) : posStr;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? raw : String(n);
};

const OperativeShelfArea: React.FC<OperativeShelfAreaProps> = ({ engine, config, setShelfCode, fullscreenGrid = true, forceSingleBlock = false, userSection = null, accessibleShelves = null, enableShelfSidebar = false }) => {
  const {
    operarioId, displayName,
    action, scanData, selectedPositions, scannerActive, processing, feedback,
    shelfCode, shelfDef, locations, loading,
    selectedCell, setSelectedCell,
    confirmModal, setConfirmModal,
    scanMethodPickerOpen, pendingAction,
    showCameraQR, setShowCameraQR, showCameraOCR, setShowCameraOCR, showBarcodeForm, setShowBarcodeForm,
    batchMode, batchArticles, batchProcessedCount,
    subcontratacionMode, beginSubcontratacion, handleSubcontratacionResult, cancelSubcontratacion,
    additionalShelfPositions, showAddShelfModal, setShowAddShelfModal,
    showRetirarArticleList, showRetirarCellModal, retirarCellPosition, retirarCellItems,
    pendingRetirarQueue, finalizeRetirarQueue,
    showMoverArticleList,
    showReprocesosUbicacionModal, reprocesosCell, setReprocesosCell,
    pendingCell,
    showOFQuestion, handleOFAnswer, handleOFCancel, handleCellFirstConfirmPositions,
    sectionPicker, reubicarCtx, reubicarNeeded,
    showRecogidaModal, setShowRecogidaModal, showTraerModal, setShowTraerModal,
    showCarretilleroPicker, selectedCarretillero, handleAvisarCarretilleroPicked,
    successModal, dismissSuccess,
    moverNeeded, highlightedPositions,
    setScannerActive, setHighlightedSearch,
    cancelAction, applyScanMethod, beginBatchMode, showToast,
    prepareChangeMethod, scanMore, handleScanMethodPickerClose,
    handleStopBatch,
    handleScan, handleCellPress,
    handleUbicarConfirm, handleUbicarBatchConfirm, handleUbicarBatchStart,
    handleReprocesosUbicacionConfirm, handleReprocesosUbicacionSkip,
    handleRetirarArticleListConfirm, handleRetirarCellItemsConfirm,
    handleMoverSelectArticle, handleMoverConfirm, chooseMoverFromList, handleReubicarConfirm,
    handleSectionPicked, handleRecogidaConfirm, handleTraerConfirm,
    addAdditionalShelf,
    setShowRetirarArticleList, setShowMoverArticleList, setSectionPicker, setScanMethodPickerOpen,
    scanArticleOnly,
    enableScanTray, trayItems, addToTray, removeFromTray, clearTray, ubicarTray, retirarTray,
    requestDeliveryToSection,
  } = engine;

  const { alerts: urgentAlerts } = useUrgentAlerts();

  // Atajos de teclado para power-users de escritorio (U/R/M, /, Esc). No-op en
  // kioskos/tablets táctiles para no interferir con el flujo de producción.
  const isDesktop = useFormFactor() === 'desktop';
  useOperativeKeyboardShortcuts(engine, config, isDesktop);

  // Modal de historial de movimientos
  const [showHistoryModal, setShowHistoryModal] = React.useState(false);
  const [historyArticle, setHistoryArticle] = React.useState<{ articleCode: string; orderFab: string } | null>(null);

  const handleOpenHistory = (articleCode: string, orderFab: string) => {
    setHistoryArticle({ articleCode, orderFab });
    setShowHistoryModal(true);
  };

  // Buscador: al pinchar un resultado en otra estantería, cambiar de estantería
  // y resaltar (rosa) la celda donde está el artículo.
  // force=true para que useKiosk acepte la estantería aunque no esté en kiosk.shelves.
  const searchNavPending = useRef(false);
  const [highlightedItemKey, setHighlightedItemKey] = React.useState<string | null>(null);
  const handleSearchNavigate = useCallback((code: string, positions?: string[], itemKey?: string) => {
    searchNavPending.current = true;
    setShelfCode?.(code, true);
    setHighlightedSearch(positions ?? []);
    setHighlightedItemKey(itemKey ?? null);
    // Reset the flag after the render cycle so manual shelf changes clear highlights
    setTimeout(() => { searchNavPending.current = false; }, 0);
  }, [setShelfCode, setHighlightedSearch]);

  const handleSearchHighlight = useCallback((positions: string[], itemKey?: string) => {
    setHighlightedSearch(positions);
    setHighlightedItemKey(itemKey ?? null);
  }, [setHighlightedSearch]);

  // Limpiar highlights de búsqueda cuando el usuario cambia de estantería manualmente
  // (tabs, selector). Si el cambio viene del buscador (searchNavPending), no limpiar.
  const prevShelfRef = useRef(shelfCode);
  useEffect(() => {
    if (shelfCode !== prevShelfRef.current) {
      prevShelfRef.current = shelfCode;
      if (!searchNavPending.current) {
        setHighlightedSearch([]);
        setHighlightedItemKey(null);
      }
    }
  }, [shelfCode, setHighlightedSearch]);

  // Roles de ámbito total navegan a cualquier estantería; los limitados
  // (OPERARIO/JEFE) solo a las de sus secciones accesibles.
  const isShelfNavigable = useCallback((code: string) => {
    if (!setShelfCode) return false;
    if (config.shelfScope === 'all') return true;
    // Roles limitados: solo navegar a estanterías accesibles (sección + adicionales)
    if (accessibleShelves && accessibleShelves.length > 0) {
      return accessibleShelves.map((s) => s.toUpperCase()).includes(code.toUpperCase());
    }
    // Sin lista de accesibles: no navegar
    return false;
  }, [setShelfCode, config.shelfScope, accessibleShelves]);

  // Estanterías navegables para el sidebar de escritorio (#2 layout 2 paneles).
  // Ámbito total → todas las estanterías reales (excluye carros y COM).
  // Ámbito limitado → solo las accesibles (sección + adicionales).
  const navigableShelves = React.useMemo(() => {
    if (!setShelfCode) return [];
    if (config.shelfScope === 'all') {
      return SHELF_DEFINITIONS
        .filter((s) => s.type === 'shelf' && s.code !== 'COM')
        .map((s) => ({ code: s.code, name: s.name }));
    }
    if (accessibleShelves && accessibleShelves.length > 0) {
      return accessibleShelves
        .map((code) => SHELF_DEFINITIONS.find((s) => s.code.toUpperCase() === code.toUpperCase()))
        .filter((s): s is typeof SHELF_DEFINITIONS[number] => !!s)
        .map((s) => ({ code: s.code, name: s.name }));
    }
    return [];
  }, [setShelfCode, config.shelfScope, accessibleShelves]);

  // El sidebar solo aparece si la vista lo activa, en escritorio y con >1 destino.
  const showShelfSidebar = enableShelfSidebar && isDesktop && navigableShelves.length > 1;

  const handleSidebarSelect = useCallback((code: string) => {
    cancelAction();
    setShelfCode?.(code);
  }, [cancelAction, setShelfCode]);

  const reprocesosCosts = !!config.reprocesos?.showCosts;
  const canMultiSection = config.ubicar.allowMultiSection;

  // Determinar si el usuario puede editar notas basado en su rol
  const canEditNotes = React.useMemo(() => {
    const role = config.role;
    // ADMIN, SUPERADMIN, CARRETILLERO pueden editar en cualquier ubicación
    if (role === 'ADMIN' || role === 'SUPERADMIN' || role === 'CARRETILLERO') {
      return true;
    }
    // JEFE_SECCION solo en su sección
    if (role === 'JEFE_SECCION' && userSection) {
      const shelfDef = SHELF_DEFINITIONS.find(s => s.code === shelfCode);
      if (shelfDef && shelfDef.section === userSection) {
        return true;
      }
      return false;
    }
    // CALIDAD solo en CAL
    if (role === 'CALIDAD') {
      return shelfCode === 'CAL';
    }
    // OPERARIO, SOLO_VISUAL, otros: sin acceso
    return false;
  }, [config.role, shelfCode, userSection]);

  // ── Fotos de ubicación (sección SOLDADURA) ──
  const isSoldaduraShelf = shelfDef?.section === 'SOLDADURA';
  const canManagePhotos = React.useMemo(() => {
    if (!isSoldaduraShelf) return false;
    const role = config.role;
    if (role === 'ADMIN' || role === 'SUPERADMIN' || role === 'CARRETILLERO') return true;
    if (role === 'JEFE_SECCION') return userSection === 'SOLDADURA';
    return false;
  }, [isSoldaduraShelf, config.role, userSection]);
  const [showPhotoCarousel, setShowPhotoCarousel] = React.useState(false);
  const shelfPhotoEntries = React.useMemo(
    () => locations.flatMap((loc) => (loc.photos ?? []).map((photo) => ({ photo, position: loc.position }))),
    [locations],
  );

  // §7bis — "Solicitar traer" disponible en el buscador para TODOS menos el carretillero.
  const canSolicitarTraer = config.role !== 'CARRETILLERO';
  const [traerResult, setTraerResult] = React.useState<GlobalSearchResult | null>(null);
  // Flujo del buscador: 1) elegir carretillero  2) destino  3) puesto soldadura.
  const [traerCarretillero, setTraerCarretillero] = React.useState<CarretilleroOption | null>(null);
  const [traerDest, setTraerDest] = React.useState<RequestSection | null>(null);

  const resetTraerFlow = React.useCallback(() => {
    setTraerResult(null);
    setTraerCarretillero(null);
    setTraerDest(null);
  }, []);

  // Resetear el selector de "solicitar traer" al cambiar de estantería
  React.useEffect(() => {
    resetTraerFlow();
  }, [shelfCode, resetTraerFlow]);

  const submitTraerFromSearch = React.useCallback((dest: RequestSection, station: number | null) => {
    if (!traerResult) return;
    const positions = traerResult.positions
      .map(positionNumber)
      .filter((v, i, arr) => arr.indexOf(v) === i);
    const result = traerResult;
    const target = traerCarretillero;
    resetTraerFlow();
    void requestDeliveryToSection(
      { articleCode: result.articleCode, orderFab: result.orderFab, shelfCode: result.shelfCode, positions },
      { code: dest.code, name: dest.name, section: dest.section, station },
      target,
    );
  }, [traerResult, traerCarretillero, resetTraerFlow, requestDeliveryToSection]);

  // Detector de pistola global (scan-first): activo solo en idle y sin modales abiertos.
  const anyModalOpen =
    confirmModal.open || scanMethodPickerOpen || !!selectedCell || sectionPicker.open ||
    showRecogidaModal || showTraerModal || showCarretilleroPicker || showRetirarArticleList || showRetirarCellModal ||
    showMoverArticleList || !!reprocesosCell || showReprocesosUbicacionModal || showOFQuestion ||
    showAddShelfModal || showCameraQR || showCameraOCR || showBarcodeForm || !!traerResult;

  useScannerCapture({
    active: !!enableScanTray && action === 'idle' && !anyModalOpen,
    onScan: addToTray,
  });

  const handleSaveNota = useCallback(async (nota: string, locationId: string) => {
    try {
      const ref = doc(db, COLLECTIONS.SHELVES, shelfCode, COLLECTIONS.LOCATIONS, locationId);
      await updateDoc(ref, { nota });
      showToast('success', '✓ Nota guardada');
    } catch (err) {
      console.error('[OperativeShelfArea] Error saving nota:', err);
      showToast('error', '❌ Error al guardar nota');
    }
  }, [shelfCode, showToast]);

  const actionLabel =
    pendingAction === 'ubicar' ? 'Ubicar artículo' :
    pendingAction === 'retirar' ? 'Retirar artículo' :
    pendingAction === 'mover' ? 'Mover artículo' :
    pendingAction === 'almacen' ? 'Enviar a almacén' :
    pendingAction === 'reubicar' ? 'Reubicar artículo' : 'Escanear';

  return (
    <div className="flex flex-row h-full w-full min-w-0 overflow-hidden">
      {/* ── Sidebar de estanterías (solo escritorio, #2 layout 2 paneles) ── */}
      {showShelfSidebar && (
        <OperativeShelfSidebar
          shelves={navigableShelves}
          currentCode={shelfCode}
          onSelect={handleSidebarSelect}
        />
      )}
      {/* ── Columna principal (estado, KPIs, buscador, grid, modales) ── */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
      {/* ── Barra de estado de acción ── */}
      {action !== 'idle' && !batchMode && (
        <div className="flex-shrink-0 px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* cellFirst fase 1: seleccionar una o varias celdas antes de escanear */}
            {action === 'ubicar' && config.reprocesos?.cellFirst && !scanData && !pendingCell && (
              selectedPositions.length === 0 ? (
                <span className="text-xs text-emerald-700 font-bold">👇 Toca las celdas de reprocesos donde ubicar</span>
              ) : (
                <>
                  <span className="text-xs text-emerald-700 font-bold">{selectedPositions.length} celda(s) seleccionada(s)</span>
                  <button
                    onClick={handleCellFirstConfirmPositions}
                    disabled={processing}
                    className="px-4 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-all touch-manipulation"
                  >
                    ✓ Continuar
                  </button>
                </>
              )
            )}
            {scannerActive && !scanData && !(action === 'ubicar' && config.reprocesos?.cellFirst && !pendingCell) && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-100 border border-sky-300 text-sky-700 text-sm font-bold animate-pulse">
                <ScanLine className="w-5 h-5" aria-hidden />
                Listo para escanear…
              </span>
            )}
            {scanData && (
              <span className="text-xs text-slate-800 font-bold truncate">{scanData.articleCode} · {scanData.orderFab}</span>
            )}
            {action === 'retirar' && (
              <span className="text-xs text-red-600 font-bold">
                {pendingRetirarQueue.length === 0
                  ? '👇 Toca una celda ocupada para retirar'
                  : `${pendingRetirarQueue.reduce((s, q) => s + q.items.length, 0)} en cola — toca otra celda o finaliza`}
              </span>
            )}
            {action === 'retirar' && pendingRetirarQueue.length > 0 && (
              <button
                onClick={finalizeRetirarQueue}
                disabled={processing}
                className="px-4 py-2 min-h-[40px] bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-all touch-manipulation"
              >
                {processing ? '⏳' : '✓'} Finalizar retirada ({pendingRetirarQueue.reduce((s, q) => s + q.items.length, 0)})
              </button>
            )}
            {action === 'ubicar' && scanData && (
              <span className="text-xs text-emerald-700 font-bold">
                {selectedPositions.length === 0
                  ? '👇 Toca las celdas donde ubicar'
                  : (() => {
                      const validation = validateContiguity(selectedPositions, shelfDef);
                      return validation.isContiguous
                        ? `${shelfCode}: pos. ${selectedPositions.map(displayPos).join(', ')}`
                        : `❌ ${validation.message}`;
                    })()
                }
                {additionalShelfPositions.map((e) => (
                  <span key={e.shelfCode} className="ml-1 text-blue-600">· {e.shelfName}: pos. {e.positions.map(displayPos).join(', ')}</span>
                ))}
              </span>
            )}
            {action === 'ubicar' && scanData && selectedPositions.length > 0 && canMultiSection && (
              <button
                onClick={() => setShowAddShelfModal(true)}
                disabled={processing}
                className="px-3 py-2 bg-blue-100 hover:bg-blue-200 active:scale-95 text-blue-700 text-xs font-bold rounded-xl disabled:opacity-50 transition-all touch-manipulation"
              >
                ➕ Otra sección
              </button>
            )}
            {action === 'ubicar' && scanData && selectedPositions.length > 0 && (
              <button
                onClick={() => handleUbicarConfirm()}
                disabled={processing}
                className="px-4 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-all touch-manipulation"
              >
                {processing ? '⏳' : '✓'} Ubicar
              </button>
            )}
            {action === 'mover' && scanData && (
              <span className="text-xs font-bold px-3 py-2 rounded-xl bg-blue-100 text-blue-700 border border-blue-200">
                {selectedPositions.length}/{moverNeeded} destinos
                {moverNeeded > 1 && selectedPositions.length === 1 && ' · o apila todo aquí'}
              </span>
            )}
            {/* Confirmar: destinos exactos (1:1) o un único destino para apilar todas las presencias */}
            {action === 'mover' && scanData && (selectedPositions.length === moverNeeded || (moverNeeded > 1 && selectedPositions.length === 1)) && (
              <button
                onClick={handleMoverConfirm}
                disabled={processing}
                className="px-4 py-2 min-h-[40px] bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-all touch-manipulation"
              >
                {processing ? '⏳' : '🔄'} {moverNeeded > 1 && selectedPositions.length === 1
                  ? `Apilar ${moverNeeded} aquí`
                  : 'Confirmar mover'}
              </button>
            )}
            {action === 'reubicar' && scanData && reubicarCtx && (
              <span className="text-xs font-bold px-3 py-2 rounded-xl bg-indigo-100 text-indigo-700 border border-indigo-200">
                {scanData.articleCode} → {shelfDef?.name || shelfCode}: {selectedPositions.length}/{reubicarNeeded} destinos
              </span>
            )}
            {action === 'reubicar' && scanData && reubicarCtx && selectedPositions.length === reubicarNeeded && (
              <button
                onClick={handleReubicarConfirm}
                disabled={processing}
                className="px-4 py-2 min-h-[40px] bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-all touch-manipulation"
              >
                {processing ? '⏳' : '🔀'} Confirmar reubicar
              </button>
            )}
          </div>
          {/* Estilo de cancelar unificado: sólido, ≥40px de alto (operable con guantes) */}
          <button
            onClick={cancelAction}
            className="px-4 py-2 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold active:scale-95 transition-all touch-manipulation flex-shrink-0"
          >
            ✕ Cancelar
          </button>
        </div>
      )}

      {/* ── Barra de lote (ubicar varios artículos) ── */}
      {batchMode && action === 'ubicar' && (
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-900">📦 Lote</span>
              <span className="bg-cyan-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">{batchArticles.length} art.</span>
              {selectedPositions.length > 0 && (() => {
                const validation = validateContiguity(selectedPositions, shelfDef);
                return (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                    validation.isContiguous 
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                      : 'bg-red-100 text-red-700 border-red-200'
                  }`}>
                    {selectedPositions.length} pos. {validation.isContiguous ? '✓' : '✗'}
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={prepareChangeMethod}
                className="px-3 py-2 min-h-[40px] rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-700 text-xs font-bold active:scale-95 transition-all touch-manipulation"
              >
                🔄 Cambiar método
              </button>
              <button
                onClick={handleStopBatch}
                className="px-4 py-2 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold active:scale-95 transition-all touch-manipulation"
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
          {batchArticles.length > 0 && (
            <div className="max-h-20 overflow-y-auto bg-slate-50 rounded-lg p-2 mb-2">
              {batchArticles.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-slate-700 font-mono truncate">
                    <span className="text-cyan-600 font-bold">{i + 1}.</span> {a.articleCode}
                  </span>
                  <span className="text-slate-500 font-mono text-[10px]">{a.orderFab}</span>
                </div>
              ))}
            </div>
          )}
          {selectedPositions.length === 0 && batchArticles.length > 0 && (
            <p className="text-xs text-slate-500 mb-2">👇 Toca celda(s) en el grid para seleccionar ubicación</p>
          )}
          {batchProcessedCount > 0 && (
            <button
              onClick={handleStopBatch}
              className="w-full min-h-[40px] mb-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold active:scale-95 transition-all touch-manipulation"
            >
              ⏹ Detener análisis (ubicar {batchProcessedCount} ya procesados)
            </button>
          )}
          <div className="flex gap-2">
            <button
              onClick={scanMore}
              className="flex-1 min-h-[40px] rounded-xl bg-slate-100 text-slate-700 text-xs font-bold active:scale-95 transition-all touch-manipulation"
            >
              + Escanear más
            </button>
            <button
              onClick={handleUbicarBatchStart}
              disabled={selectedPositions.length === 0 || batchArticles.length === 0 || processing}
              className="flex-[2] min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-40 active:scale-95 transition-all touch-manipulation"
            >
              {processing ? '⏳' : '✓'} Ubicar {batchArticles.length} artículo{batchArticles.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* ── Feedback ── */}
      {feedback && (
        <div className={`flex-shrink-0 mx-4 mt-2 p-3 rounded-xl text-center font-bold text-sm
          ${feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-700' :
            feedback.type === 'info' ? 'bg-blue-500/20 text-blue-700' :
            'bg-red-500/20 text-red-700'}`}>
          {feedback.message}
        </div>
      )}

      {/* ── Franja de KPIs (solo escritorio, idle) ── */}
      {action === 'idle' && isDesktop && !loading && (
        <OperativeKpiStrip
          locations={locations}
          shelfDef={shelfDef}
          shelfName={shelfDef?.name ?? shelfCode}
          urgentCount={urgentAlerts.length}
        />
      )}

      {/* ── Buscador (idle) ── */}
      {action === 'idle' && (
        <div className="flex-shrink-0" data-op-search>
          <KioskSearchBar
            locations={locations}
            onHighlight={handleSearchHighlight}
            global
            currentShelfCode={shelfCode}
            canNavigateToShelf={config.shelfScope === 'all'}
            onShelfNavigate={setShelfCode ? handleSearchNavigate : undefined}
            isShelfNavigable={isShelfNavigable}
            onSolicitarTraer={canSolicitarTraer ? setTraerResult : undefined}
            onOpenHistory={handleOpenHistory}
            onOutOfShelfResult={(result) => {
              // Solo informativo cuando el rol NO puede navegar a esa estantería.
              if (!isShelfNavigable(result.shelfCode)) {
                showToast('info', `Está en ${result.shelfCode} (pos. ${result.positions.map((p) => padPos(p)).join(', ')})`);
              }
            }}
          />
        </div>
      )}

      {/* ── Bandeja de escaneo (scan-first, idle) ── */}
      {action === 'idle' && enableScanTray && (
        <ScanTray
          items={trayItems}
          onUbicar={ubicarTray}
          onRetirar={retirarTray}
          onClear={clearTray}
          onRemove={removeFromTray}
          disabled={processing}
        />
      )}

      {/* ── Grid ── */}
      <div className="flex-1 min-h-0 min-w-0 w-full overflow-y-auto overscroll-contain p-2 sm:p-4 [scrollbar-width:thin] [scrollbar-color:rgba(30,41,59,0.8)_transparent] flex flex-col gap-4">
        {loading ? (
          // Skeleton del grid: transmite "cargando" sin salto de layout ni spinner.
          <div className="animate-pulse" aria-busy="true" aria-label="Cargando estantería">
            <div className="h-6 w-40 bg-slate-200 rounded mb-4" />
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="aspect-square bg-slate-200 rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <ShelfGrid
            locations={locations}
            shelfDef={shelfDef}
            onCellPress={handleCellPress}
            selectedPositions={selectedPositions}
            highlightedPositions={highlightedPositions}
            highlightedItemKey={highlightedItemKey}
            showReprocessCosts={reprocesosCosts}
            fullscreenMode={fullscreenGrid}
            forceSingleBlock={forceSingleBlock}
          />
        )}
      </div>

      {/* ── Escáner (pistola/teclado) ── */}
      <ScannerInput
        onScan={handleScan}
        active={scannerActive}
        disabled={processing}
        showCameraButtons={batchMode}
        dualField
        ofOptional={scanArticleOnly}
      />

      {/* ── Modales ── */}
      {/* El picker ofrece "Varios artículos (lote)" al ubicar (sustituye a la
          antigua pregunta previa "¿uno o varios?"). En cellFirst se conservan
          las celdas ya seleccionadas. */}
      <ScanMethodPicker
        open={scanMethodPickerOpen}
        actionLabel={batchMode ? 'Ubicar en lote' : actionLabel}
        onSelect={applyScanMethod}
        onBatch={
          !batchMode && config.ubicar.askMultiArticle &&
          (pendingAction === 'ubicar' || (action === 'ubicar' && !!pendingCell))
            ? () => beginBatchMode(!!pendingCell)
            : undefined
        }
        onSelectList={pendingAction === 'mover' ? chooseMoverFromList : undefined}
        onSubcontratacion={
          ['CARRETILLERO', 'ADMIN', 'SUPERADMIN'].includes(config.role) && !batchMode &&
          (pendingAction === 'ubicar' || (action === 'ubicar' && !!pendingCell))
            ? beginSubcontratacion
            : undefined
        }
        onClose={handleScanMethodPickerClose}
      />

      {showCameraQR && (
        <React.Suspense fallback={<div className="p-4 text-center">Cargando escáner…</div>}>
          <CameraQRScanner
            onScan={(text) => { setShowCameraQR(false); handleScan(parseScanInput(text)); }}
            onClose={() => { setShowCameraQR(false); setScannerActive(true); }}
          />
        </React.Suspense>
      )}
      {showCameraOCR && (
        <React.Suspense fallback={<div className="p-4 text-center">Cargando escáner OCR...</div>}>
          <CameraOCRScanner
            mode={subcontratacionMode ? 'subcontratacion' : 'normal'}
            onResult={(text) => {
              setShowCameraOCR(false);
              if (subcontratacionMode) handleSubcontratacionResult(text);
              else handleScan(parseScanInputLenient(text));
            }}
            onClose={() => {
              setShowCameraOCR(false);
              if (subcontratacionMode) cancelSubcontratacion();
              else setScannerActive(true);
            }}
          />
        </React.Suspense>
      )}

      {/* SUBCONTRATACIÓN: selector dedicado (foto OCR amarillo o código manual)
          mientras no haya código capturado. Sólo carretillero/admin en UBICAR. */}
      {subcontratacionMode && !scanData && !showCameraOCR && (
        <SubcontratacionCapture
          onPhoto={() => setShowCameraOCR(true)}
          onManual={(code) => handleSubcontratacionResult(code)}
          onClose={() => cancelSubcontratacion()}
        />
      )}

      {showBarcodeForm && (
        <React.Suspense fallback={<div className="p-4 text-center">Cargando escáner…</div>}>
          <QRScanner
            active={showBarcodeForm}
            disabled={processing}
            onScan={(result) => { setShowBarcodeForm(false); handleScan(result); }}
            onClose={() => { setShowBarcodeForm(false); setScannerActive(true); }}
          />
        </React.Suspense>
      )}

      {showRetirarArticleList && (
        <RetirarArticleList
          locations={locations}
          shelfCode={shelfCode}
          onConfirm={handleRetirarArticleListConfirm}
          onClose={() => { setShowRetirarArticleList(false); cancelAction(); }}
          urgentAlerts={urgentAlerts}
        />
      )}

      <RetirarCellModal
        open={showRetirarCellModal}
        position={retirarCellPosition}
        items={retirarCellItems}
        onConfirm={handleRetirarCellItemsConfirm}
        onClose={() => engine.setShowRetirarCellModal(false)}
        loading={processing}
      />

      {historyArticle && (
        <HistoryModal
          open={showHistoryModal}
          articleCode={historyArticle.articleCode}
          orderFab={historyArticle.orderFab}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {showMoverArticleList && (
        <MoverArticleList
          locations={locations}
          shelfCode={shelfCode}
          onSelect={handleMoverSelectArticle}
          onClose={() => { setShowMoverArticleList(false); cancelAction(); }}
        />
      )}

      {/* Selector de sección (retirar por sección / reubicar) */}
      {sectionPicker.open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {sectionPicker.purpose === 'reubicar-origen' ? 'Reubicar — origen' :
                 sectionPicker.purpose === 'reubicar-destino' ? 'Reubicar — destino' : 'Retirar'}
              </p>
              <h3 className="text-lg font-black text-slate-900">
                {sectionPicker.purpose === 'reubicar-origen' ? '¿De qué sección retiras el artículo?' :
                 sectionPicker.purpose === 'reubicar-destino' ? '¿A qué sección lo llevas?' :
                 '¿De qué sección?'}
              </h3>
            </div>
            <div className="p-3 max-h-[60vh] overflow-y-auto space-y-1.5">
              {sectionPicker.purpose !== 'reubicar-destino' && (
                <button
                  onClick={() => handleSectionPicked(shelfCode)}
                  className="w-full text-left rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900"
                >
                  📍 Sección actual — {shelfDef?.name || shelfCode}
                </button>
              )}
              {SHELF_DEFINITIONS.filter((s) => s.code !== (sectionPicker.purpose === 'reubicar-destino' ? reubicarCtx?.fromShelf : shelfCode) && s.code !== 'COM').map((s) => (
                <button
                  key={s.code}
                  onClick={() => handleSectionPicked(s.code)}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
                >
                  {s.name} <span className="text-xs text-slate-400 font-mono">({s.code})</span>
                </button>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-100">
              <button
                onClick={() => { setSectionPicker((p) => ({ ...p, open: false })); cancelAction(); }}
                className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white py-3 text-sm font-bold active:scale-[0.98] transition-all touch-manipulation"
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* §7bis — "Solicitar traer" desde el buscador: carretillero → destino → puesto */}
      {/* Paso 1: elegir carretillero */}
      <CarretilleroPicker
        open={!!traerResult && !traerCarretillero}
        onSelect={(c) => setTraerCarretillero(c)}
        onClose={resetTraerFlow}
      />

      {/* Paso 2: elegir sección destino */}
      {traerResult && traerCarretillero && !traerDest && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Solicitar traer · 🚜 {traerCarretillero.name}</p>
              <h3 className="text-lg font-black text-slate-900">¿A qué sección debe traerlo?</h3>
              <p className="text-xs text-slate-500 mt-1 font-mono truncate">{traerResult.articleCode} · {traerResult.orderFab}</p>
            </div>
            <div className="p-3 max-h-[60vh] overflow-y-auto grid grid-cols-2 gap-2">
              {REQUEST_SECTIONS.map((s) => (
                <button
                  key={s.code}
                  disabled={processing}
                  onClick={() => {
                    if (s.isSoldadura) setTraerDest(s);
                    else submitTraerFromSearch(s, null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-3 text-center font-semibold text-slate-800 disabled:opacity-50 active:scale-95 transition-all"
                >
                  <span className="block text-2xl mb-1">{s.emoji}</span>
                  <span className="block text-sm">{s.name}</span>
                </button>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-100">
              <button
                onClick={resetTraerFlow}
                className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white py-3 text-sm font-bold active:scale-[0.98] transition-all touch-manipulation"
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paso 3: puesto de soldadura si el destino es SOLDADURA */}
      <SoldaduraStationPicker
        open={!!traerResult && !!traerCarretillero && !!traerDest}
        variant="destino"
        processing={processing}
        onBack={() => setTraerDest(null)}
        onSelect={(n) => { if (traerDest) submitTraerFromSearch(traerDest, n); }}
      />

      {/* Multi-sección (ubicar artículo grande) */}
      <AddShelfPositionModal
        open={showAddShelfModal}
        currentShelfCode={shelfCode}
        onAdd={addAdditionalShelf}
        onClose={() => setShowAddShelfModal(false)}
      />

      {/* Calidad cellFirst: pregunta si el artículo tiene OF antes de escanear */}
      <ConfirmationModal
        open={showOFQuestion}
        onClose={handleOFCancel}
        title="¿Tiene OF?"
        message="¿Este artículo tiene hoja de ruta / orden de fabricación?"
        icon="📋"
        variant="info"
        confirmText="SÍ, tiene OF"
        onConfirm={() => handleOFAnswer(true)}
        extraButton={{ text: 'NO, sin OF', onClick: () => handleOFAnswer(false) }}
        hideCancel
        loading={false}
      />

      {/* Reprocesos: importe/cantidad al ubicar (calidad) */}
      <ReprocesosUbicacionModal
        open={showReprocesosUbicacionModal}
        articleCode={scanData?.articleCode || ''}
        orderFab={scanData?.orderFab || ''}
        position={selectedPositions[0] || ''}
        onConfirm={handleReprocesosUbicacionConfirm}
        onSkip={handleReprocesosUbicacionSkip}
        onClose={() => { engine.setShowReprocesosUbicacionModal(false); cancelAction(); }}
      />

      {/* Reprocesos: editor en celda idle (calidad) */}
      {reprocesosCell && (
        <ReprocesosEditor
          position={reprocesosCell.position}
          items={(reprocesosCell.items || []) as never}
          onClose={() => setReprocesosCell(null)}
          onUpdated={() => {
            const updated = locations.find((l) => l.position === reprocesosCell.position);
            if (updated) setReprocesosCell(updated);
          }}
        />
      )}

      {/* Avisar: paso 1 — elegir carretillero asignado */}
      <CarretilleroPicker
        open={showCarretilleroPicker}
        onSelect={handleAvisarCarretilleroPicked}
        onClose={cancelAction}
      />

      {/* Avisar: mensaje final de confirmación (proceso terminado) */}
      <ConfirmationModal
        open={!!successModal}
        onClose={dismissSuccess}
        title={successModal?.title || ''}
        message={successModal?.message || ''}
        icon="🚚"
        variant="success"
        confirmText="Entendido"
        onConfirm={dismissSuccess}
        hideCancel
        loading={false}
      />

      {/* Avisar: recogida */}
      <RecogidaModal
        open={showRecogidaModal}
        currentShelfCode={shelfCode}
        processing={processing}
        targetCarretilleroName={selectedCarretillero?.name}
        onConfirm={handleRecogidaConfirm}
        onClose={() => { setShowRecogidaModal(false); cancelAction(); }}
      />

      {/* Avisar: traer */}
      {showTraerModal && (
        <TraerArticuloModal
          open={showTraerModal}
          currentShelfCode={shelfCode}
          targetCarretilleroName={selectedCarretillero?.name}
          onClose={() => { setShowTraerModal(false); cancelAction(); }}
          onConfirm={handleTraerConfirm}
          loading={processing}
        />
      )}

      {/* Confirmaciones (incluye ghost, bucles, almacén, avisar) */}
      <ConfirmationModal
        open={confirmModal.open}
        onClose={confirmModal.onClose ?? (() => setConfirmModal((p) => ({ ...p, open: false })))}
        title={confirmModal.title}
        message={confirmModal.message}
        icon={confirmModal.icon}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        extraButton={confirmModal.extraButton}
        hideCancel={confirmModal.hideCancel}
        loading={processing}
      />

      {/* Inspección de celda: pulsar una ubicación ocupada la amplía para ver su
          contenido; pulsar fuera (backdrop) vuelve al tamaño normal. */}
      {selectedCell && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedCell(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ubicación</p>
                <h3 className="text-lg font-black text-slate-900 font-mono truncate">
                  {shelfCode} {padPos(selectedCell.position) || selectedCell.position}
                </h3>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] font-bold font-mono px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  {selectedCell.items.length} art.
                </span>
                <button
                  onClick={() => setSelectedCell(null)}
                  className="text-rose-500 hover:text-rose-700 text-2xl leading-none"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-3 max-h-[60vh] overflow-y-auto space-y-2">
              {selectedCell.items.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">Ubicación vacía</p>
              ) : (
                selectedCell.items.map((item, idx) => (
                  <div key={`${item.articleCode}-${item.orderFab}-${idx}`} className={`rounded-xl px-3 py-2.5 border ${item.subcontratacion ? 'bg-orange-50 border-orange-300' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[15px] font-black font-mono text-slate-900 leading-tight break-all">{item.articleCode}</p>
                      {item.subcontratacion && (
                        <span className="flex-shrink-0 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-500 text-white">🏭 Subcon.</span>
                      )}
                    </div>
                    {item.orderFab && <p className="text-[12px] font-bold font-mono text-cyan-700 leading-tight break-all">{item.orderFab}</p>}
                    {reprocesosCosts && item.quantity != null && item.unitCost != null && item.unitCost > 0 && (
                      <p className="text-[11px] text-amber-600 font-mono mt-0.5">{item.quantity} ud · {item.unitCost.toFixed(2)} €/ud</p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-1 break-words">
                      {item.locatedByName}{item.locatedAt ? ` · ${new Date(item.locatedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                    </p>
                  </div>
                ))
              )}
              {isSoldaduraShelf && (
                <LocationPhotoGallery
                  shelfCode={shelfCode}
                  position={selectedCell.position}
                  photos={selectedCell.photos ?? []}
                  canManage={canManagePhotos}
                  uploadedBy={operarioId}
                  uploadedByName={displayName}
                  onPhotosUpdated={(photos) => setSelectedCell((prev) => (prev ? { ...prev, photos } : null))}
                />
              )}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nota</p>
                  {!canEditNotes && (
                    <span className="text-[9px] font-bold text-amber-600 uppercase">Solo lectura</span>
                  )}
                </div>
                {canEditNotes ? (
                  <textarea
                    key={selectedCell.locationId}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:border-cyan-500 transition-colors"
                    placeholder="Añadir nota..."
                    rows={2}
                    defaultValue={selectedCell.nota ?? ''}
                    onBlur={(e) => handleSaveNota(e.target.value, selectedCell.locationId)}
                  />
                ) : (
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 italic min-h-[60px] flex items-center">
                    {selectedCell.nota ? (
                      <p>{selectedCell.nota}</p>
                    ) : (
                      <p className="text-slate-400">Sin nota</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante: carrusel de TODAS las fotos del shelf (solo SOLDADURA) */}
      {action === 'idle' && isSoldaduraShelf && shelfPhotoEntries.length > 0 && (
        <button
          onClick={() => setShowPhotoCarousel(true)}
          className="fixed bottom-24 right-4 z-40 bg-violet-600 hover:bg-violet-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-xl active:scale-95 transition-all"
          aria-label="Ver carrusel de fotos"
        >
          <span className="text-2xl">📷</span>
          <span className="absolute -top-1 -right-1 bg-white text-violet-600 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow">
            {shelfPhotoEntries.length}
          </span>
        </button>
      )}

      {showPhotoCarousel && shelfPhotoEntries.length > 0 && (
        <PhotoCarousel
          entries={shelfPhotoEntries}
          canManage={canManagePhotos}
          onDelete={async (entry) => {
            if (!entry.position) return;
            const { photoApi } = await import('../../lib/api/photoApi');
            await photoApi.deletePhoto(shelfCode, entry.position, entry.photo);
          }}
          onClose={() => setShowPhotoCarousel(false)}
        />
      )}
      </div>
    </div>
  );
};

export default OperativeShelfArea;
