import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useShelf } from '../../hooks/useShelf';
import { useAuth } from '../../hooks/useAuth';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskSearchBar from '../kiosk/KioskSearchBar';
import ScannerInput from '../kiosk/ScannerInput';
import CameraQRScanner from '../common/CameraQRScanner';
import CameraOCRScanner from '../common/CameraOCRScanner';
import ScanMethodPicker, { type ScanMethod } from '../common/ScanMethodPicker';
import ConfirmationModal from '../common/ConfirmationModal';
import ReprocesosEditor from '../kiosk/ReprocesosEditor';
import TraerArticuloModal from '../kiosk/TraerArticuloModal';
import MoverArticleList from '../kiosk/MoverArticleList';
import { isReprocesosLocation } from '../../lib/firestoreSchema';
import { calcReprocesosTotal } from '../../lib/api/reprocesosApi';
import CalidadReprocesosSection from './CalidadReprocesosSection';
import { formatArticleDisplay, type ScanParseResult, parseScanInput, parseScanInputLenient } from '../../lib/qrParser';
import type { ShelfLocationState } from '../../hooks/useShelf';
import type { LocationItem } from '../../lib/schema/locations';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import RetirarCellModal from '../kiosk/RetirarCellModal';
import ReprocesosUbicacionModal from '../kiosk/ReprocesosUbicacionModal';

type CalidadAction = 'idle' | 'ubicar' | 'retirar' | 'mover' | 'avisar';

const SHELF = 'CAL';

const CalidadView: React.FC = () => {
  const [highlightedPositions, setHighlightedPositions] = useState<string[]>([]);
  const [action, setAction] = useState<CalidadAction>('idle');
  const [scannerActive, setScannerActive] = useState(false);
  const [scanData, setScanData] = useState<{ articleCode: string; orderFab: string } | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [reprocesosCell, setReprocesosCell] = useState<ShelfLocationState | null>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showOCRScanner, setShowOCRScanner] = useState(false);
  const [scanMethodPickerOpen, setScanMethodPickerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<CalidadAction | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; message: string; icon: string;
    variant: 'success' | 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    extraButton?: { text: string; onClick: () => void };
    confirmText?: string;
  }>({ open: false, title: '', message: '', icon: '', variant: 'info', onConfirm: () => {} });

  // Batch support
  const [batchMode, setBatchMode] = useState(false);
  const [batchArticles, setBatchArticles] = useState<Array<{ articleCode: string; orderFab: string }>>([]);
  const [batchRetiraPending, setBatchRetiraPending] = useState<Array<{ articleCode: string; orderFab: string; locations: ShelfLocationState[] }>>([]);
  const [currentBatchRetirarIndex, setCurrentBatchRetirarIndex] = useState(0);
  const [retirarPosition, setRetirarPosition] = useState<string | null>(null);
  const [foundLocationsForRetirar, setFoundLocationsForRetirar] = useState<ShelfLocationState[]>([]);
  const [showRetirarCellModal, setShowRetirarCellModal] = useState(false);
  const [retirarCellPosition, setRetirarCellPosition] = useState('');
  const [retirarCellItems, setRetirarCellItems] = useState<LocationItem[]>([]);
  const [pendingRetirarQueue, setPendingRetirarQueue] = useState<Array<{ position: string; items: LocationItem[] }>>([]);
  const [showTraerModal, setShowTraerModal] = useState(false);
  const [showMoverArticleList, setShowMoverArticleList] = useState(false);
  const [showReprocesosUbicacionModal, setShowReprocesosUbicacionModal] = useState(false);
  const [pendingReprocesosUbicacion, setPendingReprocesosUbicacion] = useState<{ importe?: number; cantidad?: number } | null>(null);

  const { locations, loading, shelfDef, ubicar, ubicarMulti, retirar, retirarDeUbicacion, mover, findArticle } = useShelf(SHELF);
  const { operarioId, firebaseUser, displayName, logout, canEditReprocesses, canViewReprocessCosts } = useAuth();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';
  const { createPickupRequest, createDeliveryRequest } = usePickupQueue();

  useEffect(() => {
    if (!reprocesosCell) return;
    const updated = locations.find((location) => location.position === reprocesosCell.position);
    if (updated) {
      setReprocesosCell(updated);
    }
  }, [locations, reprocesosCell]);

  const reprocesosItems = locations
    .filter((l) => isReprocesosLocation(SHELF, parseInt(l.position, 10)))
    .flatMap((l) => l.items || []);
  const { totalImporte, totalPiezas } = calcReprocesosTotal(reprocesosItems);

  const oldestDays = useMemo(() => {
    if (reprocesosItems.length === 0) return 0;
    const now = Date.now();
    const times = reprocesosItems
      .map((i) => new Date(i.locatedAt).getTime())
      .filter((t) => !isNaN(t));
    if (times.length === 0) return 0;
    return Math.floor((now - Math.min(...times)) / 86_400_000);
  }, [reprocesosItems]);

  const moverNeeded = useMemo(() => {
    if (action !== 'mover' || !scanData) return 1;
    return findArticle(scanData.articleCode, scanData.orderFab).length || 1;
  }, [action, scanData, locations]);

  const showToast = useCallback((type: 'success' | 'error', msg: string, ms = 2500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setFeedback({ type, msg });
    toastTimerRef.current = setTimeout(() => {
      setFeedback(null);
      toastTimerRef.current = null;
    }, ms);
  }, []);

  const finishAction = useCallback((type: 'success' | 'error', msg: string) => {
    showToast(type, msg, 2800);
    setTimeout(() => resetAction(), 2800);
  }, [showToast]);

  const resetAction = () => {
    setAction('idle');
    setScanData(null);
    setSelectedPositions([]);
    setScannerActive(false);
    setBatchMode(false);
    setBatchArticles([]);
    setBatchRetiraPending([]);
    setCurrentBatchRetirarIndex(0);
    setRetirarPosition(null);
    setFoundLocationsForRetirar([]);
    setShowRetirarCellModal(false);
    setPendingRetirarQueue([]);
    setShowMoverArticleList(false);
  };

  const applyScanMethod = useCallback((method: ScanMethod) => {
    setScanMethodPickerOpen(false);
    if (!pendingAction) return;
    setAction(pendingAction);
    setPendingAction(null);
    if (method === 'manual') setScannerActive(true);
    else if (method === 'barcode') setShowCameraScanner(true);
    else setShowOCRScanner(true);
  }, [pendingAction]);

  const beginBatchMode = useCallback(() => {
    setScanMethodPickerOpen(false);
    if (!pendingAction) return;
    setAction(pendingAction);
    setBatchMode(true);
    setPendingAction(null);
    setScannerActive(true);
  }, [pendingAction]);

  const startAction = (act: CalidadAction) => {
    setScanData(null);
    setSelectedPositions([]);
    setBatchMode(false);
    setFeedback(null);
    if (act === 'avisar') {
      setAction('avisar');
      setConfirmModal({
        open: true,
        title: '¿Qué necesitas?',
        message: `Selecciona el tipo de solicitud al carretillero`,
        icon: '🚚',
        variant: 'warning',
        onConfirm: async () => {
          setProcessing(true);
          setConfirmModal((prev) => ({ ...prev, open: false }));
          const ok = await createPickupRequest(effectiveOperarioId, displayName, SHELF);
          setProcessing(false);
          if (ok) finishAction('success', '✅ Recogida solicitada');
          else finishAction('error', 'Error al enviar');
        },
        extraButton: {
          text: '📦 TRAER — Que me traigan un artículo',
          onClick: () => {
            setConfirmModal((prev) => ({ ...prev, open: false }));
            setAction('idle');
            setShowTraerModal(true);
          },
        },
      });
      return;
    }
    if (act === 'retirar') {
      setAction('retirar');
      return;
    }
    if (act === 'mover') {
      setAction('mover');
      setShowMoverArticleList(true);
      return;
    }
    setPendingAction(act);
    setScanMethodPickerOpen(true);
  };

  const handleScan = (result: ScanParseResult) => {
    if (!result.success) {
      showToast('error', 'error' in result ? result.error : 'Error de escaneo');
      setScannerActive(true);
      return;
    }
    const { articleCode, orderFab } = result.data;

    if (action === 'ubicar' && batchMode) {
      const duplicate = batchArticles.some((a) => a.articleCode === articleCode && a.orderFab === orderFab);
      if (duplicate) {
        showToast('error', `${articleCode} ya está en el lote`);
        setScannerActive(true);
        return;
      }
      setBatchArticles((prev) => [...prev, { articleCode, orderFab }]);
      showToast('success', `✅ ${articleCode} añadido al lote`);
      setScannerActive(true);
      return;
    }

    if (action === 'retirar' && batchMode) {
      const found = findArticle(articleCode, orderFab);
      if (found.length === 0) {
        showToast('error', `${articleCode} no encontrado`);
        setScannerActive(true);
        return;
      }
      const duplicate = batchRetiraPending.some((a) => a.articleCode === articleCode && a.orderFab === orderFab);
      if (duplicate) {
        showToast('error', 'Este artículo ya está en el lote');
        setScannerActive(true);
        return;
      }
      setBatchRetiraPending((prev) => [...prev, { articleCode, orderFab, locations: found }]);
      showToast('success', `✅ ${articleCode} añadido al lote`);
      setScannerActive(true);
      return;
    }

    setScanData({ articleCode, orderFab });
    setScannerActive(false);

    if (action === 'retirar') {
      const found = findArticle(articleCode, orderFab);
      if (found.length === 0) { showToast('error', 'Artículo no encontrado'); setScannerActive(true); return; }

      if (found.length === 1) {
        setConfirmModal({
          open: true,
          title: 'Confirmar retirada',
          message: `¿Retirar ${formatArticleDisplay(articleCode, orderFab)} de posición ${parseInt(found[0].position, 10)}?`,
          icon: '📤',
          variant: 'danger',
          onConfirm: async () => {
            setProcessing(true);
            setConfirmModal((p) => ({ ...p, open: false }));
            const r = await retirarDeUbicacion(articleCode, orderFab, found[0].position, effectiveOperarioId, displayName);
            setProcessing(false);
            if (r.success) finishAction('success', '✅ Retirado');
            else finishAction('error', r.error || 'Error al retirar');
          },
        });
      } else {
        setFoundLocationsForRetirar(found);
        setRetirarPosition(null);
        setConfirmModal({
          open: true,
          title: 'Selecciona de dónde retirar',
          message: `${formatArticleDisplay(articleCode, orderFab)} está en ${found.length} ubicaciones`,
          icon: '📤',
          variant: 'warning',
          onConfirm: async () => {
            if (!retirarPosition) return;
            setProcessing(true);
            setConfirmModal((p) => ({ ...p, open: false }));
            const r =
              retirarPosition === 'TODAS'
                ? await retirar(articleCode, orderFab, effectiveOperarioId, displayName)
                : await retirarDeUbicacion(articleCode, orderFab, retirarPosition, effectiveOperarioId, displayName);
            setProcessing(false);
            setFoundLocationsForRetirar([]);
            setRetirarPosition(null);
            if (r.success) finishAction('success', '✅ Retirado');
            else finishAction('error', r.error || 'Error al retirar');
          },
        });
      }
    }
  };

  const handleUbicarBatchConfirm = useCallback(async () => {
    if (selectedPositions.length === 0) return;
    setProcessing(true);
    setScannerActive(false);
    setConfirmModal((prev) => ({ ...prev, open: false }));

    let successCount = 0;
    for (const article of batchArticles) {
      let success: boolean;
      if (selectedPositions.length === 1) {
        success = await ubicar(article.articleCode, article.orderFab, selectedPositions[0], effectiveOperarioId, displayName);
      } else {
        success = await ubicarMulti(article.articleCode, article.orderFab, selectedPositions, effectiveOperarioId, displayName);
      }
      if (success) successCount += selectedPositions.length;
    }

    setProcessing(false);
    if (successCount === batchArticles.length * selectedPositions.length) {
      finishAction('success', `✅ ${batchArticles.length} artículos ubicados en ${selectedPositions.length} posición(es)`);
    } else {
      finishAction('error', `Parcial: ${successCount}/${batchArticles.length * selectedPositions.length} completadas`);
    }
  }, [batchArticles, selectedPositions, effectiveOperarioId, displayName, ubicar, ubicarMulti, finishAction]);

  const handleUbicarMultiPositionConfirm = useCallback(async (importe?: number, cantidad?: number) => {
    if (!scanData || selectedPositions.length === 0) return;
    setProcessing(true);
    setScannerActive(false);

    let success: boolean;
    if (selectedPositions.length === 1 && importe === undefined) {
      success = await ubicar(scanData.articleCode, scanData.orderFab, selectedPositions[0], effectiveOperarioId, displayName);
    } else {
      success = await ubicarMulti(scanData.articleCode, scanData.orderFab, selectedPositions, effectiveOperarioId, displayName, importe, cantidad);
    }

    setProcessing(false);
    if (success) {
      finishAction('success', `✅ ${scanData.articleCode} ubicado en ${selectedPositions.length} posición(es)`);
    } else {
      finishAction('error', `Error al ubicar ${scanData.articleCode}`);
    }
  }, [scanData, selectedPositions, effectiveOperarioId, displayName, ubicar, ubicarMulti, finishAction]);

  const handleRetirarBatchNext = useCallback(async () => {
    const processNext = async (index: number) => {
      if (index >= batchRetiraPending.length) {
        finishAction('success', '✅ Lote de retirada completado');
        return;
      }

      const item = batchRetiraPending[index];
      const r = await retirar(item.articleCode, item.orderFab, effectiveOperarioId, displayName);
      if (!r.success) {
        finishAction('error', r.error || 'Error al retirar artículo');
        return;
      }
      setCurrentBatchRetirarIndex(index + 1);
      setTimeout(() => processNext(index + 1), 500);
    };

    processNext(currentBatchRetirarIndex);
  }, [batchRetiraPending, currentBatchRetirarIndex, retirar, effectiveOperarioId, displayName, finishAction]);

  const handleReprocesosUbicacionConfirm = useCallback((importe?: number, cantidad?: number) => {
    setShowReprocesosUbicacionModal(false);
    setPendingReprocesosUbicacion({ importe, cantidad });
    handleUbicarMultiPositionConfirm(importe, cantidad);
  }, [handleUbicarMultiPositionConfirm]);

  const handleReprocesosUbicacionSkip = useCallback(() => {
    setShowReprocesosUbicacionModal(false);
    setPendingReprocesosUbicacion(null);
    handleUbicarMultiPositionConfirm();
  }, [handleUbicarMultiPositionConfirm]);

  const handleRetirarCellItemsConfirm = useCallback((selectedItems: LocationItem[]) => {
    setShowRetirarCellModal(false);
    const position = retirarCellPosition;
    if (selectedItems.length === 0) return;

    const updatedQueue = [...pendingRetirarQueue, { position, items: selectedItems }];
    setPendingRetirarQueue(updatedQueue);
    setConfirmModal({
      open: true,
      title: '¿Retirar algo más?',
      message: `${selectedItems.length} artículo(s) de posición ${parseInt(position, 10)} añadido(s) a la cola`,
      icon: '📤',
      variant: 'info',
      confirmText: 'NO, finalizar retirada',
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        setProcessing(true);
        (async () => {
          let successCount = 0;
          for (const queueItem of updatedQueue) {
            for (const item of queueItem.items) {
              const result = await retirarDeUbicacion(item.articleCode, item.orderFab, queueItem.position, effectiveOperarioId, displayName);
              if (result.success) successCount++;
            }
          }
          setProcessing(false);
          const totalItems = updatedQueue.reduce((sum, q) => sum + q.items.length, 0);
          if (successCount === totalItems) {
            finishAction('success', `✅ ${totalItems} artículo(s) retirado(s) correctamente`);
          } else {
            finishAction('error', `Parcial: ${successCount}/${totalItems} artículos retirados`);
          }
          setPendingRetirarQueue([]);
        })();
      },
      extraButton: {
        text: 'SÍ, retirar más',
        onClick: () => setConfirmModal((prev) => ({ ...prev, open: false })),
      },
    });
  }, [retirarCellPosition, pendingRetirarQueue, effectiveOperarioId, displayName, retirarDeUbicacion, finishAction]);

  const handleCellPress = useCallback((loc: ShelfLocationState) => {
    if (action === 'idle' && isReprocesosLocation(SHELF, parseInt(loc.position, 10))) {
      if (!canEditReprocesses) {
        showToast('error', 'Tu sesión no puede editar reprocesos');
        return;
      }
      setReprocesosCell(loc);
      return;
    }

    if (action === 'retirar') {
      if (!loc.isEmpty && loc.items.length > 0) {
        setRetirarCellPosition(loc.position);
        setRetirarCellItems(loc.items);
        setShowRetirarCellModal(true);
      }
      return;
    }

    if (action === 'ubicar' && batchMode && batchArticles.length > 0) {
      const position = loc.position;
      // Add position first so it's available when modals confirm
      setSelectedPositions((current) => {
        if (current.includes(position)) return current;
        return [...current, position];
      });
      if (isReprocesosLocation(SHELF, parseInt(position, 10))) {
        setShowReprocesosUbicacionModal(true);
      }
      return;
    }

    if (action === 'ubicar' && !batchMode && scanData) {
      const position = loc.position;
      // Check if it's a reprocesos position
      if (isReprocesosLocation(SHELF, parseInt(position, 10)) && scanData) {
        // Show reprocesos modal for single article
        setShowReprocesosUbicacionModal(true);
        // Clear selected positions and set this one
        setSelectedPositions([position]);
        return;
      }
      setSelectedPositions((current) => {
        if (current.includes(position)) return current.filter((value) => value !== position);
        return [...current, position];
      });
      return;
    }

    if (action === 'mover' && scanData) {
      const found = findArticle(scanData.articleCode, scanData.orderFab);
      const needed = found.length || 1;
      setSelectedPositions((prev) => {
        if (prev.includes(loc.position)) return prev.filter((p) => p !== loc.position);
        if (prev.length >= needed) return [...prev.slice(1), loc.position];
        return [...prev, loc.position];
      });
    }
  }, [action, batchMode, batchArticles, scanData, ubicar, findArticle, effectiveOperarioId, displayName, canEditReprocesses]);

  const handleMoverSelectArticle = useCallback((articleCode: string, orderFab: string) => {
    setShowMoverArticleList(false);
    setScanData({ articleCode, orderFab });
    setSelectedPositions([]);
  }, []);

  const handleMoverConfirm = async () => {
    if (!scanData || selectedPositions.length === 0) return;
    setProcessing(true);
    const ok = await mover(scanData.articleCode, scanData.orderFab, selectedPositions, effectiveOperarioId, displayName);
    setProcessing(false);
    if (ok) {
      setSelectedPositions([]);
      setConfirmModal({
        open: true,
        title: '✅ Movido correctamente',
        message: `${scanData.articleCode} movido. ¿Quieres mover algo más?`,
        icon: '🔄',
        variant: 'success',
        confirmText: 'SÍ, mover otro',
        onConfirm: () => {
          setConfirmModal((prev) => ({ ...prev, open: false }));
          setScanData(null);
          setShowMoverArticleList(true);
        },
        extraButton: {
          text: 'NO, finalizar',
          onClick: () => finishAction('success', `✅ ${scanData.articleCode} movido correctamente`),
        },
      });
    } else {
      finishAction('error', 'Error al mover');
    }
  };

  const handleQRScan = useCallback((qrCode: string) => {
    setShowCameraScanner(false);
    const result = parseScanInput(qrCode);
    handleScan(result);
  }, [handleScan]);

  const handleOCRResult = useCallback((text: string) => {
    setShowOCRScanner(false);
    const result = parseScanInputLenient(text);
    handleScan(result);
  }, [handleScan]);

  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
       {/* Header */}
       <header className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <span className="text-xl">🔍</span>
             <div>
               <h1 className="text-lg font-black text-slate-900 tracking-tight">Calidad — CAL</h1>
               <p className="text-xs text-slate-500">{displayName}</p>
             </div>
           </div>
           <div className="flex gap-2">
             <button
               onClick={logout}
               className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all duration-200"
             >
               Salir
             </button>
           </div>
         </div>
       </header>

      <CalidadReprocesosSection
        canViewReprocessCosts={canViewReprocessCosts}
        canEditReprocesses={canEditReprocesses}
        totalImporte={totalImporte}
        totalPiezas={totalPiezas}
        oldestDays={oldestDays}
      />

      {/* Search bar */}
      <KioskSearchBar locations={locations} onHighlight={setHighlightedPositions} />

      {/* Action status */}
      {action !== 'idle' && (
        <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {scannerActive && (
              <span className="text-xs text-sky-600 animate-pulse font-bold">📡 Esperando escáner...</span>
            )}
            {scanData && (
              <span className="text-xs text-slate-800 font-bold">{scanData.articleCode} ({scanData.orderFab})</span>
            )}
            {action === 'retirar' && !scanData && (
              <span className="text-xs text-red-600 font-bold">Toca una celda ocupada para retirar artículos</span>
            )}
            {action === 'ubicar' && !scanData && !batchMode && scannerActive && (
              <span className="text-xs text-slate-500">Escanea o escribe el código abajo</span>
            )}
            {action === 'ubicar' && scanData && (
              <span className="text-xs text-emerald-700 font-bold">
                Toca celdas vacías ({selectedPositions.length} seleccionada{selectedPositions.length !== 1 ? 's' : ''})
              </span>
            )}
            {action === 'ubicar' && scanData && selectedPositions.length > 0 && (
              <button
                onClick={() => handleUbicarMultiPositionConfirm()}
                disabled={processing}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
              >
                Confirmar ubicación
              </button>
            )}
            {action === 'mover' && scanData && (
              <span className="text-xs font-bold px-2 py-1 rounded-lg bg-blue-100 text-blue-700">
                {selectedPositions.length}/{moverNeeded} destinos
              </span>
            )}
            {action === 'mover' && scanData && selectedPositions.length === moverNeeded && (
              <button
                onClick={handleMoverConfirm}
                disabled={processing}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
              >
                Confirmar mover
              </button>
            )}
          </div>
          <button onClick={resetAction} className="text-xs text-slate-400 hover:text-white">
            Cancelar
          </button>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`mx-4 mt-2 p-3 rounded-xl text-center font-bold text-sm
          ${feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Grid — scroll vertical; cada bloque gestiona su scroll horizontal */}
      <div className="flex-1 min-h-0 min-w-0 w-full overflow-y-auto overscroll-contain p-2 sm:p-4 [scrollbar-width:thin] [scrollbar-color:rgba(30,41,59,0.8)_transparent]">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ShelfGrid
            locations={locations}
            shelfDef={shelfDef}
            onCellPress={handleCellPress}
            selectedPositions={selectedPositions}
            highlightedPositions={[
              ...highlightedPositions,
              ...(scanData ? findArticle(scanData.articleCode, scanData.orderFab).map((l) => l.position) : []),
            ]}
            compact={false}
            showReprocessCosts={canViewReprocessCosts}
          />
        )}
      </div>

      {/* Action buttons */}
      {action === 'idle' && (
        <div className="flex-shrink-0 bg-white border-t border-slate-200 p-3 w-full">
          <div className="grid grid-cols-4 gap-2 w-full max-w-4xl mx-auto">
            <button
              onClick={() => startAction('ubicar')}
              className="h-14 rounded-xl bg-emerald-600 text-white font-bold text-sm flex flex-col items-center justify-center active:scale-95 transition-all"
            >
              <span>📦</span> UBICAR
            </button>
            <button
              onClick={() => startAction('retirar')}
              className="h-14 rounded-xl bg-red-600 text-white font-bold text-sm flex flex-col items-center justify-center active:scale-95 transition-all"
            >
              <span>📤</span> RETIRAR
            </button>
            <button
              onClick={() => startAction('mover')}
              className="h-14 rounded-xl bg-blue-600 text-white font-bold text-sm flex flex-col items-center justify-center active:scale-95 transition-all"
            >
              <span>🔄</span> MOVER
            </button>
            <button
              onClick={() => startAction('avisar')}
              className="h-14 rounded-xl bg-amber-600 text-white font-bold text-sm flex flex-col items-center justify-center active:scale-95 transition-all"
            >
              <span>🚚</span> AVISAR
            </button>
          </div>
        </div>
      )}

      {/* Batch mode bar */}
      {batchMode && (action === 'ubicar' || action === 'retirar') && (
        <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">
                {action === 'ubicar' ? '📦 Batch' : '📤 Batch'} ({action === 'ubicar' ? batchArticles.length : batchRetiraPending.length} artículos)
              </h3>
            </div>
            {action === 'ubicar' && batchArticles.length > 0 && (
              <div className="text-xs text-slate-300 max-h-8 overflow-y-auto bg-slate-900/30 p-2 rounded">
                {batchArticles.slice(0, 3).map((a, i) => (
                  <div key={i}>{a.articleCode} ({a.orderFab})</div>
                ))}
                {batchArticles.length > 3 && <div className="text-slate-500">+{batchArticles.length - 3} más</div>}
              </div>
            )}
            {action === 'ubicar' && selectedPositions.length > 0 && (
              <div className="text-xs text-slate-300 bg-cyan-500/20 p-2 rounded border border-cyan-500/30">
                Posiciones: {selectedPositions.map(p => parseInt(p, 10)).join(', ')}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setScannerActive(true)}
                className="flex-1 rounded-lg bg-slate-700 text-white px-3 py-2 text-xs font-bold hover:bg-slate-600"
              >
                + Escanear más
              </button>
              <button
                onClick={() => {
                  setScannerActive(false);
                  if (action === 'ubicar') {
                    if (selectedPositions.length > 0) {
                      handleUbicarBatchConfirm();
                    } else {
                      showToast('error', 'Selecciona al menos una posición');
                    }
                  } else {
                    handleRetirarBatchNext();
                  }
                }}
                disabled={action === 'ubicar' && selectedPositions.length === 0}
                className="flex-1 rounded-lg bg-cyan-600 text-white px-3 py-2 text-xs font-black hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✓ Finalizar
              </button>
              <button
                onClick={resetAction}
                className="flex-1 rounded-lg bg-red-600/20 text-red-400 px-3 py-2 text-xs font-bold hover:bg-red-600/30"
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <ScanMethodPicker
        open={scanMethodPickerOpen}
        actionLabel={
          pendingAction === 'ubicar' ? 'Ubicar en Calidad' :
          pendingAction === 'retirar' ? 'Retirar de Calidad' :
          pendingAction === 'mover' ? 'Mover en Calidad' : 'Escanear'
        }
        onSelect={applyScanMethod}
        onBatch={pendingAction === 'ubicar' || pendingAction === 'retirar' ? beginBatchMode : undefined}
        onClose={() => { setScanMethodPickerOpen(false); setPendingAction(null); }}
      />

      <ScannerInput
        onScan={handleScan}
        active={scannerActive}
        disabled={processing}
        showCameraButtons={false}
        dualField={true}
      />

      {foundLocationsForRetirar.length > 1 && confirmModal.open && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm max-h-[70vh] overflow-hidden flex flex-col shadow-xl">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">Selecciona posición</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {foundLocationsForRetirar.map((loc) => (
                <button
                  key={loc.position}
                  type="button"
                  onClick={() => setRetirarPosition(loc.position)}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-bold border-2 text-left ${
                    retirarPosition === loc.position
                      ? 'border-sky-500 bg-sky-50 text-sky-900'
                      : 'border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  CAL {parseInt(loc.position, 10).toString().padStart(3, '0')}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRetirarPosition('TODAS')}
                className={`w-full rounded-xl px-4 py-3 text-sm font-bold border-2 ${
                  retirarPosition === 'TODAS'
                    ? 'border-red-500 bg-red-50 text-red-800'
                    : 'border-slate-200 text-slate-800'
                }`}
              >
                Retirar de todas ({foundLocationsForRetirar.length})
              </button>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal((p) => ({ ...p, open: false }))}
                className="flex-1 rounded-xl bg-slate-100 text-slate-700 py-3 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmModal.onConfirm()}
                disabled={!retirarPosition}
                className="flex-1 rounded-xl bg-sky-600 text-white py-3 text-sm font-black disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoverArticleList && (
        <MoverArticleList
          locations={locations}
          shelfCode={SHELF}
          onSelect={handleMoverSelectArticle}
          onClose={() => { setShowMoverArticleList(false); resetAction(); }}
        />
      )}

      <RetirarCellModal
        open={showRetirarCellModal}
        position={retirarCellPosition}
        items={retirarCellItems}
        onConfirm={handleRetirarCellItemsConfirm}
        onClose={() => setShowRetirarCellModal(false)}
        loading={processing}
      />

      <ReprocesosUbicacionModal
        open={showReprocesosUbicacionModal}
        articleCode={scanData?.articleCode || ''}
        orderFab={scanData?.orderFab || ''}
        position={selectedPositions[0] || ''}
        onConfirm={handleReprocesosUbicacionConfirm}
        onSkip={handleReprocesosUbicacionSkip}
        onClose={() => {
          setShowReprocesosUbicacionModal(false);
          resetAction();
        }}
      />

      <ConfirmationModal
        open={confirmModal.open && foundLocationsForRetirar.length <= 1}
        onClose={() => setConfirmModal((p) => ({ ...p, open: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        icon={confirmModal.icon}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        extraButton={confirmModal.extraButton}
        loading={processing}
      />

      {reprocesosCell && (
        <ReprocesosEditor
          position={reprocesosCell.position}
          items={reprocesosCell.items || []}
          onClose={() => setReprocesosCell(null)}
          onUpdated={() => {
            const updated = locations.find((location) => location.position === reprocesosCell.position);
            if (updated) setReprocesosCell(updated);
          }}
        />
      )}

      {showCameraScanner && (
        <CameraQRScanner
          onScan={handleQRScan}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

      {showTraerModal && (
        <TraerArticuloModal
          open={showTraerModal}
          currentShelfCode={SHELF}
          onClose={() => setShowTraerModal(false)}
          onConfirm={async (articleCode, orderFab, shelfCode, shelfName, positions) => {
            setProcessing(true);
            setShowTraerModal(false);
            const ok = await createDeliveryRequest(effectiveOperarioId, displayName, SHELF, shelfName, articleCode, orderFab, shelfName, positions);
            setProcessing(false);
            if (ok) finishAction('success', '✅ Traer solicitado');
            else finishAction('error', 'Error al enviar');
          }}
        />
      )}

      {showOCRScanner && (
        <CameraOCRScanner
          onResult={handleOCRResult}
          onClose={() => setShowOCRScanner(false)}
          language="spa"
        />
      )}
    </div>
  );
};

export default CalidadView;


