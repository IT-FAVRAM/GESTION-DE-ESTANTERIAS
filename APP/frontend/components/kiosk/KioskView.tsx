import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useKiosk } from '../../hooks/useKiosk';
import { useShelf, type ShelfLocationState } from '../../hooks/useShelf';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import ShelfGrid from './ShelfGrid';
import ScannerInput from './ScannerInput';
import ShelfSelector from './ShelfSelector';
import DeviceInfoModal from '../common/DeviceInfoModal';
import ConfirmationModal from '../common/ConfirmationModal';
import RecogidaModal from './RecogidaModal';
import { formatArticleDisplay, type ScanParseResult, parseScanInput, parseScanInputLenient } from '../../lib/qrParser';
import { findArticleGlobal } from '../../lib/findArticleGlobal';
import CameraQRScanner from '../common/CameraQRScanner';
import CameraOCRScanner from '../common/CameraOCRScanner';
import ScanMethodPicker, { type ScanMethod } from '../common/ScanMethodPicker';
import KioskActionBar from './KioskActionBar';
import KioskActionButtons from './KioskActionButtons';
import KioskCellDetailDrawer from './KioskCellDetailDrawer';
import KioskEmptyState from './KioskEmptyState';
import KioskFeedbackToast from './KioskFeedbackToast';
import KioskHeader from './KioskHeader';
import KioskSearchBar from './KioskSearchBar';
import TraerArticuloModal from './TraerArticuloModal';
import MoverArticleList from './MoverArticleList';
import RetirarCellModal from './RetirarCellModal';
import RetirarArticleList, { type RetirarItem } from './RetirarArticleList';
import type { LocationItem } from '../../lib/schema/locations';
import type { KioskAction, KioskConfirmModalState, KioskFeedback, ScanData } from './kioskShared';

const KioskView: React.FC = () => {
  const { assignedShelf, operarioId, firebaseUser, displayName, logout, kioskId, deviceId } = useAuth();
  // Email-auth users (e.g. JEFE_SECCION in operative mode) have no numeric operarioId;
  // fall back to their Firebase UID so audit logs are still attributed correctly.
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? null;
  const { kiosk, shelves, currentShelf, setCurrentShelf } = useKiosk(kioskId);
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);

  // Determinar la estantería a mostrar: usar kiosko si está disponible, sino assignedShelf
  const shelfCode = currentShelf || assignedShelf || '';

  const { locations, loading, shelfDef, ubicar, ubicarMulti, retirar, retirarDeUbicacion, mover, findArticle, totalArticles, totalOccupied, totalEmpty } = useShelf(shelfCode);
  const { createPickupRequest, createDeliveryRequest } = usePickupQueue();

  const [action, setAction] = useState<KioskAction>('idle');
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [selectedCell, setSelectedCell] = useState<ShelfLocationState | null>(null);
  const [showShelf, setShowShelf] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [highlightedSearch, setHighlightedSearch] = useState<string[]>([]);
  const [scannerActive, setScannerActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<KioskFeedback | null>(null);
  const [retirarPosition, setRetirarPosition] = useState<string | null>(null);
  const [foundLocationsForRetirar, setFoundLocationsForRetirar] = useState<ShelfLocationState[]>([]);
  const [confirmModal, setConfirmModal] = useState<KioskConfirmModalState>({ open: false, title: '', message: '', icon: '', variant: 'info', onConfirm: () => {} });
  const [batchMode, setBatchMode] = useState(false);
  const [batchArticles, setBatchArticles] = useState<ScanData[]>([]);

  const [showCameraQR, setShowCameraQR] = useState(false);
  const [showCameraOCR, setShowCameraOCR] = useState(false);
  const [scanMethodPickerOpen, setScanMethodPickerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<KioskAction | null>(null);
  const [showTraerModal, setShowTraerModal] = useState(false);
  const [traerProcessing, setTraerProcessing] = useState(false);
  const [showMoverArticleList, setShowMoverArticleList] = useState(false);
  const [showRecogidaModal, setShowRecogidaModal] = useState(false);
  const [recogidaProcessing, setRecogidaProcessing] = useState(false);
  const [showRetirarCellModal, setShowRetirarCellModal] = useState(false);
  const [retirarCellPosition, setRetirarCellPosition] = useState('');
  const [retirarCellItems, setRetirarCellItems] = useState<LocationItem[]>([]);
  const [showRetirarArticleList, setShowRetirarArticleList] = useState(false);
  const [pendingRetirarQueue, setPendingRetirarQueue] = useState<Array<{ position: string; items: LocationItem[] }>>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelAction = useCallback(() => {
    setAction('idle');
    setScanData(null);
    setSelectedCell(null);
    setSelectedPositions([]);
    setScannerActive(false);
    setRetirarPosition(null);
    setFoundLocationsForRetirar([]);
    setConfirmModal((prev) => ({ ...prev, open: false }));
    // NOTA: showShelf NO se toca — el usuario controla la visibilidad
    setBatchMode(false);
    setBatchArticles([]);
    setPendingRetirarQueue([]);
    setShowMoverArticleList(false);
    setShowRetirarArticleList(false);
  }, []);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string, ms = 2500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setFeedback({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setFeedback(null);
      toastTimerRef.current = null;
    }, ms);
  }, []);

  const finishAction = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    showToast(type, message, 2800);
    // Reset estado de acción SIN ocultar la estantería — el usuario la ve en tiempo real
    setAction('idle');
    setScanData(null);
    setSelectedCell(null);
    setSelectedPositions([]);
    setScannerActive(false);
    setRetirarPosition(null);
    setFoundLocationsForRetirar([]);
    setConfirmModal((prev) => ({ ...prev, open: false }));
    setBatchMode(false);
    setBatchArticles([]);
    setPendingRetirarQueue([]);
    setShowMoverArticleList(false);
    setShowRetirarArticleList(false);
  }, [showToast]);

  const handleRetirarArticleListConfirm = useCallback(async (selectedItems: RetirarItem[]) => {
    if (!effectiveOperarioId) return;
    setShowRetirarArticleList(false);
    let successCount = 0;
    setProcessing(true);
    for (const item of selectedItems) {
      const result = await retirarDeUbicacion(item.articleCode, item.orderFab, item.position, effectiveOperarioId, displayName);
      if (result.success) successCount++;
    }
    setProcessing(false);
    if (successCount === selectedItems.length) {
      finishAction('success', `✅ ${selectedItems.length} artículo${selectedItems.length !== 1 ? 's' : ''} retirado${selectedItems.length !== 1 ? 's' : ''} correctamente`);
    } else {
      finishAction('error', `Parcial: ${successCount}/${selectedItems.length} artículos retirados`);
    }
  }, [effectiveOperarioId, displayName, retirarDeUbicacion, finishAction]);

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
      onConfirm: async () => {
        if (!effectiveOperarioId) return;
        setConfirmModal((prev) => ({ ...prev, open: false }));
        let successCount = 0;
        setProcessing(true);

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
      },
      extraButton: {
        text: 'SÍ, retirar más',
        onClick: () => setConfirmModal((prev) => ({ ...prev, open: false })),
      },
    });
  }, [retirarCellPosition, effectiveOperarioId, pendingRetirarQueue, displayName, retirarDeUbicacion, finishAction]);

  const handleUbicarConfirm = useCallback(async (position: string) => {
    if (!scanData || !effectiveOperarioId) return;
    setProcessing(true);
    setConfirmModal((prev) => ({ ...prev, open: false }));
    const success = await ubicar(scanData.articleCode, scanData.orderFab, position, effectiveOperarioId, displayName);
    setProcessing(false);
    if (success) finishAction('success', `✅ ${scanData.articleCode} ubicado en posición ${parseInt(position, 10)}`);
    else finishAction('error', 'Error al ubicar el artículo');
  }, [displayName, scanData, finishAction, ubicar, effectiveOperarioId]);

  const handleRetirarConfirm = useCallback(async (articleCode: string, orderFab: string, specificPosition?: string) => {
    if (!effectiveOperarioId) return;
    setProcessing(true);
    setConfirmModal((prev) => ({ ...prev, open: false }));

    if (specificPosition) {
      const result = await retirarDeUbicacion(articleCode, orderFab, specificPosition, effectiveOperarioId, displayName);
      setProcessing(false);
      if (result.success) finishAction('success', `✅ ${articleCode} retirado de posición ${parseInt(specificPosition, 10)}`);
      else finishAction('error', result.error || 'Error al retirar el artículo');
    } else {
      const result = await retirar(articleCode, orderFab, effectiveOperarioId, displayName);
      setProcessing(false);
      if (result.success) finishAction('success', `✅ ${articleCode} retirado de ${result.positions.length} ubicación(es)`);
      else finishAction('error', result.error || 'Error al retirar el artículo');
    }
  }, [displayName, effectiveOperarioId, retirar, retirarDeUbicacion, finishAction]);

  const handleMoverConfirm = useCallback(async () => {
    if (!scanData || !effectiveOperarioId || selectedPositions.length === 0) return;
    setProcessing(true);
    const success = await mover(scanData.articleCode, scanData.orderFab, selectedPositions, effectiveOperarioId, displayName);
    setProcessing(false);
    if (success) {
      finishAction('success', `✅ ${scanData.articleCode} movido correctamente`);
    } else {
      finishAction('error', 'Error al mover el artículo');
    }
  }, [displayName, mover, effectiveOperarioId, scanData, selectedPositions, finishAction]);

  const handleMoverSelectArticle = useCallback((articleCode: string, orderFab: string) => {
    setShowMoverArticleList(false);
    setScanData({ articleCode, orderFab });
    setSelectedPositions([]);
  }, []);

  const handleAvisarConfirm = useCallback(() => {
    setConfirmModal((prev) => ({ ...prev, open: false }));
    setAction('idle');
    setShowRecogidaModal(true);
  }, []);

  const handleRecogidaConfirm = useCallback(async (
    articleCode: string,
    articleOrderFab: string,
    destShelfCode: string,
    destShelfName: string,
  ) => {
    if (!effectiveOperarioId) return;
    setRecogidaProcessing(true);
    const success = await createPickupRequest(
      effectiveOperarioId, displayName, shelfCode,
      articleCode, articleOrderFab, destShelfCode, destShelfName,
    );
    setRecogidaProcessing(false);
    if (success) {
      setShowRecogidaModal(false);
      showToast('success', `✅ Recogida solicitada: ${articleCode} → ${destShelfName}`);
    } else {
      showToast('error', 'Error al enviar la solicitud');
    }
  }, [createPickupRequest, displayName, effectiveOperarioId, shelfCode, showToast]);

  const handleTraerConfirm = useCallback(async (
    articleCode: string,
    articleOrderFab: string,
    articleShelfCode: string,
    articleShelfName: string,
    articlePositions: string[],
  ) => {
    if (!effectiveOperarioId) return;
    setTraerProcessing(true);
    const success = await createDeliveryRequest(
      effectiveOperarioId,
      displayName,
      shelfCode,
      shelfDef?.name || shelfCode,
      articleCode,
      articleOrderFab,
      articleShelfName,
      articlePositions,
    );
    setTraerProcessing(false);
    if (success) {
      setShowTraerModal(false);
      showToast('success', `✅ Aviso enviado: el carretillero traerá ${articleCode}`);
    } else {
      showToast('error', 'Error al enviar la solicitud');
    }
  }, [createDeliveryRequest, displayName, effectiveOperarioId, shelfCode, shelfDef, showToast]);

  const handleUbicarBatchConfirm = useCallback(async () => {
    if (!effectiveOperarioId || selectedPositions.length === 0) return;
    setScannerActive(false);
    setConfirmModal((prev) => ({ ...prev, open: false }));
    setProcessing(true);
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
    if (successCount === batchArticles.length) {
      finishAction('success', `✅ ${batchArticles.length} artículos ubicados en ${selectedPositions.length} posición(es)`);
    } else {
      finishAction('error', `Parcial: ${successCount}/${batchArticles.length} artículos completados`);
    }
  }, [batchArticles, selectedPositions, effectiveOperarioId, displayName, ubicar, ubicarMulti, finishAction]);

  const handleUbicarMultiPositionConfirm = useCallback(async () => {
    if (!scanData || !effectiveOperarioId || selectedPositions.length === 0) return;
    setScannerActive(false);
    setProcessing(true);
    let success: boolean;
    if (selectedPositions.length === 1) {
      success = await ubicar(scanData.articleCode, scanData.orderFab, selectedPositions[0], effectiveOperarioId, displayName);
    } else {
      success = await ubicarMulti(scanData.articleCode, scanData.orderFab, selectedPositions, effectiveOperarioId, displayName);
    }
    setProcessing(false);
    if (success) {
      finishAction('success', `✅ ${scanData.articleCode} ubicado en ${selectedPositions.length} posición(es)`);
    } else {
      finishAction('error', `Error al ubicar ${scanData.articleCode}`);
    }
  }, [displayName, effectiveOperarioId, scanData, selectedPositions, ubicar, ubicarMulti, finishAction]);

  const applyScanMethod = useCallback((method: ScanMethod) => {
    setScanMethodPickerOpen(false);
    if (!pendingAction) return;
    setAction(pendingAction);
    setPendingAction(null);
    if (method === 'manual') {
      setScannerActive(true);
    } else if (method === 'barcode') {
      setShowCameraQR(true);
    } else {
      setShowCameraOCR(true);
    }
  }, [pendingAction]);

  const beginBatchMode = useCallback(() => {
    setScanMethodPickerOpen(false);
    if (!pendingAction) return;
    setAction(pendingAction);
    setBatchMode(true);
    setPendingAction(null);
    setScannerActive(true);
  }, [pendingAction]);

  const startAction = useCallback((nextAction: KioskAction) => {
    setScanData(null);
    setSelectedCell(null);
    setSelectedPositions([]);
    setBatchMode(false);
    setFeedback(null);
    if (nextAction === 'avisar') {
      setAction('avisar');
      setConfirmModal({
        open: true,
        title: '¿Qué necesitas?',
        message: `Selecciona el tipo de solicitud al carretillero`,
        icon: '🚚',
        variant: 'warning',
        confirmText: '📤 RECOGIDA — Que venga a recoger',
        onConfirm: handleAvisarConfirm,
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
    if (nextAction === 'retirar') {
      setAction('retirar');
      setShowRetirarArticleList(true);
      return;
    }
    if (nextAction === 'mover') {
      setAction('mover');
      setShowMoverArticleList(true);
      return;
    }
    setPendingAction(nextAction);
    setScanMethodPickerOpen(true);
  }, [handleAvisarConfirm, shelfCode, shelfDef]);

  const handleScan = useCallback(async (result: ScanParseResult) => {
    if (!result.success) {
      showToast('error', 'error' in result ? result.error : 'Error de escaneo');
      setScannerActive(true);
      return;
    }

    const { articleCode, orderFab } = result.data;

    if (action === 'ubicar' && batchMode) {
      const duplicate = batchArticles.some((a) => a.articleCode === articleCode && a.orderFab === orderFab);
      if (duplicate) {
        showToast('error', `${articleCode} ${orderFab} ya está en el lote`);
        setScannerActive(true);
        return;
      }
      setBatchArticles((prev) => [...prev, { articleCode, orderFab }]);
      showToast('success', `✅ ${articleCode} añadido (${batchArticles.length + 1} en lote)`);
      setScannerActive(true);
      return;
    }



    setScanData({ articleCode, orderFab });
    setScannerActive(false);

    if (action === 'mover') {
      const foundLocations = findArticle(articleCode, orderFab);
      if (foundLocations.length === 0) {
        showToast('error', `${articleCode} no encontrado`);
        setScannerActive(true);
        return;
      }
      setSelectedPositions([]);
    }

    // Ghost article check: warn if article is already located somewhere in the system
    if (action === 'ubicar' && !batchMode) {
      setProcessing(true);
      const globalLocs = await findArticleGlobal(articleCode, orderFab);
      setProcessing(false);
      if (globalLocs.length > 0) {
        const locationText = globalLocs
          .map((l) => `• ${l.shelfName} — pos. ${parseInt(l.position, 10)}`)
          .join('\n');
        setConfirmModal({
          open: true,
          title: '⚠️ Artículo ya ubicado',
          message: `${formatArticleDisplay(articleCode, orderFab)} ya figura en el sistema:\n\n${locationText}\n\n¿Confirmas que ya NO se encuentra ahí y quieres ubicarlo en un nuevo sitio?`,
          icon: '⚠️',
          variant: 'warning',
          onConfirm: () => setConfirmModal((prev) => ({ ...prev, open: false })),
          extraButton: {
            text: 'Cancelar',
            onClick: () => {
              setScanData(null);
              setScannerActive(true);
              setConfirmModal((prev) => ({ ...prev, open: false }));
            },
          },
        });
      }
    }
  }, [action, batchMode, batchArticles, findArticle, handleRetirarConfirm, showToast]);

  const handleCameraQRScan = useCallback((qrCode: string) => {
    setShowCameraQR(false);
    handleScan(parseScanInput(qrCode));
  }, [handleScan]);

  const handleCameraOCRResult = useCallback((text: string) => {
    setShowCameraOCR(false);
    handleScan(parseScanInputLenient(text));
  }, [handleScan]);

  const handleCellPress = useCallback((location: ShelfLocationState) => {
    if (action === 'ubicar' && batchMode && batchArticles.length > 0) {
      const position = location.position;
      setSelectedPositions((current) => {
        if (current.includes(position)) return current.filter((value) => value !== position);
        return [...current, position];
      });
      return;
    }

    if (action === 'ubicar' && scanData && !batchMode) {
      const position = location.position;
      if (!location.isEmpty && location.items.length > 0 && !selectedPositions.includes(position)) {
        showToast('info', `⚠️ Pos. ${parseInt(position, 10)} ya tiene ${location.items.length} artículo(s) — se añadirá igualmente`);
      }
      setSelectedPositions((current) => {
        if (current.includes(position)) return current.filter((value) => value !== position);
        return [...current, position];
      });
      return;
    }

    if (action === 'ubicar' && !scanData && !batchMode) {
      return;
    }

    if (action === 'retirar') {
      // Retirar: mostrar artículos de la celda para seleccionar
      if (!location.isEmpty && location.items.length > 0) {
        setRetirarCellPosition(location.position);
        setRetirarCellItems(location.items);
        setShowRetirarCellModal(true);
      }
      return;
    }

    if (action === 'mover' && scanData) {
      const foundLocations = findArticle(scanData.articleCode, scanData.orderFab);
      const neededPositions = foundLocations.length || 1;
      const position = location.position;
      setSelectedPositions((current) => {
        if (current.includes(position)) return current.filter((value) => value !== position);
        if (current.length >= neededPositions) return [...current.slice(1), position];
        return [...current, position];
      });
      return;
    }

    if (action === 'idle' && !location.isEmpty) {
      setSelectedCell(location);
    }
  }, [action, batchMode, batchArticles, findArticle, handleUbicarConfirm, scanData]);

  // Number of positions the article currently occupies — mover needs exactly this many destinations
  const moverNeeded = useMemo(() => {
    if (action !== 'mover' || !scanData) return 1;
    return findArticle(scanData.articleCode, scanData.orderFab).length || 1;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, scanData, locations]); // locations triggers recompute when shelf data refreshes

  if (!shelfCode) return <KioskEmptyState />;

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-sky-50">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-400 font-medium">Cargando estanteria...</p>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full bg-sky-50 flex flex-col relative overflow-hidden">
      <KioskHeader shelfName={shelfDef?.name || ''} shelfCode={shelfCode} totalOccupied={totalOccupied} totalEmpty={totalEmpty} totalArticles={totalArticles} displayName={displayName} operarioId={operarioId} deviceId={deviceId} onLogout={logout} onInfo={() => setShowDeviceInfo(true)} />
      {kiosk && shelves.length > 1 && (
        <div className="bg-sky-50 border-b border-slate-200 px-4 py-2 flex justify-center">
          <ShelfSelector shelves={shelves} currentShelf={currentShelf} onSelectShelf={(s) => { if (action !== 'idle') cancelAction(); setCurrentShelf(s); }} />
        </div>
      )}
      {!batchMode && <KioskActionBar action={action} scanData={scanData} scannerActive={scannerActive} selectedPositions={selectedPositions} neededPositions={moverNeeded} onConfirmMove={handleMoverConfirm} onConfirmUbicar={handleUbicarMultiPositionConfirm} onCancel={cancelAction} />}

      {batchMode && action === 'ubicar' && (
        <div className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-900 text-sm">📦 Batch de Ubicación</h3>
              <span className="bg-cyan-600 text-white px-2 py-1 rounded text-xs font-bold">{batchArticles.length} artículos</span>
            </div>
            {batchArticles.length > 0 && (
              <div className="text-xs text-slate-300 mb-2 max-h-12 overflow-y-auto bg-slate-900/30 p-2 rounded">
                {batchArticles.map((a, i) => (
                  <div key={i} className="text-slate-300">{a.articleCode} ({a.orderFab})</div>
                ))}
              </div>
            )}
            {selectedPositions.length > 0 && (
              <div className="text-xs text-slate-300 mb-2 bg-cyan-500/20 p-2 rounded border border-cyan-500/30">
                Posiciones seleccionadas: {selectedPositions.map(p => `${shelfCode} ${parseInt(p, 10).toString().padStart(3, '0')}`).join(', ')}
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
                  if (selectedPositions.length > 0) {
                    handleUbicarBatchConfirm();
                  } else {
                    showToast('error', 'Selecciona al menos una posición en la estantería');
                  }
                }}
                disabled={selectedPositions.length === 0}
                className="flex-1 rounded-lg bg-cyan-600 text-white px-3 py-2 text-xs font-black hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✓ Finalizar
              </button>
              <button
                onClick={cancelAction}
                className="flex-1 rounded-lg bg-red-600/20 text-red-400 px-3 py-2 text-xs font-bold hover:bg-red-600/30"
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      <KioskFeedbackToast feedback={feedback} />

      {(!showShelf && action === 'idle') ? (
        <main className="flex-1 flex flex-col items-center justify-center p-4 w-full">
          <div className="grid grid-cols-2 gap-4 w-full max-w-6xl">
            <button onClick={() => startAction('ubicar')} className="h-32 rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 active:scale-95 text-white font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-emerald-950/40 transition-all"><span className="text-4xl">📦</span>UBICAR</button>
            <button onClick={() => startAction('retirar')} className="h-32 rounded-3xl border border-red-400/20 bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 active:scale-95 text-white font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-red-950/40 transition-all"><span className="text-4xl">📤</span>RETIRAR</button>
            <button onClick={() => startAction('mover')} className="h-32 rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 active:scale-95 text-white font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-blue-950/40 transition-all"><span className="text-4xl">🔄</span>MOVER</button>
            <button onClick={() => startAction('avisar')} className="h-32 rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 active:scale-95 text-white font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-amber-950/40 transition-all"><span className="text-4xl">🚚</span>CARRETILLERO</button>
          </div>
          <button onClick={() => setShowShelf(true)} className="mt-8 px-6 py-3 rounded-full bg-white border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition-colors shadow-sm">
            Mostrar estantería
          </button>
        </main>
      ) : (
         <>
           <main className="flex-1 min-h-0 min-w-0 w-full overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(30,41,59,0.8)_transparent] p-2 md:p-3">
             {action === 'idle' && (
                <div className="flex justify-end mb-2">
                  <button onClick={() => setShowShelf(false)} className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 text-xs transition-colors shadow-sm">
                    Ocultar estantería
                  </button>
                </div>
             )}
             <KioskSearchBar 
               locations={locations} 
               onHighlight={setHighlightedSearch} 
               global={true}
               currentShelfCode={shelfCode}
               canNavigateToShelf={false}
               onOutOfShelfResult={(result) => {
                 // Mostrar aviso de que el resultado está en otra estantería
                 showToast('info', `Está en ${result.shelfCode} (pos. ${result.positions.join(', ')})`);
               }}
             />
             <ShelfGrid
               locations={locations}
               shelfDef={shelfDef}
               onCellPress={handleCellPress}
               selectedPositions={selectedPositions}
               highlightedPositions={[
                 ...highlightedSearch,
                 ...(scanData ? findArticle(scanData.articleCode, scanData.orderFab).map((location) => location.position) : []),
               ]}
               fullscreenMode={showShelf}
             />
           </main>

          <KioskCellDetailDrawer selectedCell={selectedCell} onClose={() => setSelectedCell(null)} />
          <KioskActionButtons action={action} onStartAction={startAction} showShelf={showShelf} />
        </>
      )}

      <ScanMethodPicker
        open={scanMethodPickerOpen}
        actionLabel={
          pendingAction === 'ubicar' ? 'Ubicar artículo' :
          pendingAction === 'retirar' ? 'Retirar artículo' :
          pendingAction === 'mover' ? 'Mover artículo' : 'Escanear'
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

      {showCameraQR && (
        <CameraQRScanner
          onScan={handleCameraQRScan}
          onClose={() => { setShowCameraQR(false); setScannerActive(true); }}
        />
      )}
      {showCameraOCR && (
        <CameraOCRScanner
          onResult={handleCameraOCRResult}
          onClose={() => { setShowCameraOCR(false); setScannerActive(true); }}
        />
      )}

      {foundLocationsForRetirar.length > 1 && confirmModal.open && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm max-h-[70vh] overflow-hidden flex flex-col shadow-xl">
            <div className="bg-sky-50 px-5 py-4 border-b border-slate-200">
              <h3 className="text-lg font-black text-slate-900">Selecciona posición</h3>
              <p className="text-xs text-slate-400 mt-1">¿De cuál ubicación quieres retirar?</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {foundLocationsForRetirar.map((loc) => (
                <button
                  key={loc.position}
                  onClick={() => setRetirarPosition(loc.position)}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-bold border-2 transition-all ${
                    retirarPosition === loc.position
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                      : 'border-slate-700 bg-slate-800 text-white hover:border-slate-600'
                  }`}
                >
                  📍 {shelfCode} {parseInt(loc.position, 10).toString().padStart(3, '0')}
                  {loc.items.length > 0 && (
                    <span className="block text-xs text-slate-400 mt-0.5">
                      {loc.items.length} artículo{loc.items.length !== 1 ? 's' : ''} en la celda
                    </span>
                  )}
                </button>
              ))}
              <div className="pt-2 border-t border-slate-700 mt-3">
                <button
                  onClick={() => setRetirarPosition('TODAS')}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-bold border-2 transition-all ${
                    retirarPosition === 'TODAS'
                      ? 'border-red-400 bg-red-500/20 text-red-300'
                      : 'border-slate-700 bg-slate-800 text-white hover:border-slate-600'
                  }`}
                >
                  ⚠️ Retirar de TODAS ({foundLocationsForRetirar.length} posiciones)
                </button>
              </div>
            </div>
            <div className="bg-sky-50 border-t border-slate-200 px-5 py-3 flex gap-2">
              <button
                onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
                className="flex-1 rounded-xl bg-slate-700 text-white px-4 py-3 text-sm font-bold hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmModal.onConfirm()}
                disabled={!retirarPosition}
                className="flex-1 rounded-xl bg-cyan-600 text-white px-4 py-3 text-sm font-black hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal open={confirmModal.open && foundLocationsForRetirar.length <= 1} onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))} title={confirmModal.title} message={confirmModal.message} icon={confirmModal.icon} variant={confirmModal.variant} confirmText={confirmModal.confirmText} onConfirm={confirmModal.onConfirm} extraButton={confirmModal.extraButton} loading={processing} />

      {showDeviceInfo && (
        <DeviceInfoModal
          deviceId={deviceId}
          onClose={() => setShowDeviceInfo(false)}
        />
      )}

      <TraerArticuloModal
        open={showTraerModal}
        onClose={() => setShowTraerModal(false)}
        onConfirm={handleTraerConfirm}
        currentShelfCode={shelfCode}
        loading={traerProcessing}
      />

      {showMoverArticleList && (
        <MoverArticleList
          locations={locations}
          shelfCode={shelfCode}
          onSelect={handleMoverSelectArticle}
          onClose={() => { setShowMoverArticleList(false); cancelAction(); }}
        />
      )}

      {showRetirarArticleList && (
        <RetirarArticleList
          locations={locations}
          shelfCode={shelfCode}
          onConfirm={handleRetirarArticleListConfirm}
          onClose={() => { setShowRetirarArticleList(false); cancelAction(); }}
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

      <RecogidaModal
        open={showRecogidaModal}
        currentShelfCode={shelfCode}
        processing={recogidaProcessing}
        onConfirm={handleRecogidaConfirm}
        onClose={() => setShowRecogidaModal(false)}
      />
    </div>
  );
};

export default KioskView;


