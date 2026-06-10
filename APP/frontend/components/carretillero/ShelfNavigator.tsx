/**
 * ShelfNavigator — Navegador de estanterías para el carretillero
 * Gestor de Estanterías WMS v3.0
 * 
 * Lista horizontal scrollable de todas las estanterías.
 * Al seleccionar una, muestra su grid.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useShelf } from '../../hooks/useShelf';
import { useAuth } from '../../hooks/useAuth';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskSearchBar from '../kiosk/KioskSearchBar';
import ScannerInput from '../kiosk/ScannerInput';
import CameraQRScanner from '../common/CameraQRScanner';
const CameraOCRScanner = React.lazy(() => import('../common/CameraOCRScanner'));
import ScanMethodPicker from '../common/ScanMethodPicker';
import type { ScanMethod } from '../../lib/types/scan';
import { parseCallableError } from '../../lib/callableError';
import ConfirmationModal from '../common/ConfirmationModal';
import { ALL_SHELVES, SHELF_DEFINITIONS } from '../../lib/firestoreSchema';
import { formatArticleDisplay, type ScanParseResult, parseScanInput, parseScanInputLenient } from '../../lib/qrParser';
import { findArticleGlobal } from '../../lib/findArticleGlobal';
import type { ShelfLocationState } from '../../hooks/useShelf';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import ShelfNavigatorTabs from './ShelfNavigatorTabs';
import ShelfNavigatorStatus from './ShelfNavigatorStatus';
import RetirarCellModal from '../kiosk/RetirarCellModal';
import RetirarArticleList, { type RetirarItem } from '../kiosk/RetirarArticleList';
import MoverArticleList from '../kiosk/MoverArticleList';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import type { LocationItem } from '../../lib/schema/locations';

export type NavAction = 'idle' | 'ubicar' | 'retirar' | 'mover' | 'avisar' | 'almacen';

interface ShelfNavigatorProps {
  /** Si se pasa, bloquea el navegador a ese shelf/carro y oculta el selector de pestañas */
  shelfCode?: string;
  onActionChange?: (action: NavAction) => void;
  externalActionTrigger?: NavAction | null;
  onExternalActionConsumed?: () => void;
  externalShelfTrigger?: string | null;
  onExternalShelfConsumed?: () => void;
}

const ShelfNavigator: React.FC<ShelfNavigatorProps> = ({ shelfCode: lockedShelf, onActionChange, externalActionTrigger, onExternalActionConsumed, externalShelfTrigger, onExternalShelfConsumed }) => {
  const [selectedShelf, setSelectedShelf] = useState(lockedShelf ?? SHELF_DEFINITIONS[0]?.code ?? 'PRE');
  const [highlightedSearch, setHighlightedSearch] = useState<string[]>([]);
  const { locations, loading, shelfDef, ubicar, ubicarMulti, retirar, retirarDeUbicacion, mover, findArticle, totalOccupied, totalEmpty, totalArticles } = useShelf(selectedShelf);
  const { operarioId, firebaseUser, displayName } = useAuth();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';
  const { createPickupRequest } = usePickupQueue();

  const [action, setAction] = useState<NavAction>('idle');
  const [scannerActive, setScannerActive] = useState(false);
  const [showCameraQR, setShowCameraQR] = useState(false);
  const [showCameraOCR, setShowCameraOCR] = useState(false);
  const [scanMethodPickerOpen, setScanMethodPickerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<NavAction | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scanData, setScanData] = useState<{ articleCode: string; orderFab: string } | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
   const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; message: string; icon: string;
    variant: 'success' | 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    extraButton?: { text: string; onClick: () => void };
    confirmText?: string;
  }>({ open: false, title: '', message: '', icon: '', variant: 'info', onConfirm: () => {} });
  const [retirarCellPosition, setRetirarCellPosition] = useState('');
  const [retirarCellItems, setRetirarCellItems] = useState<LocationItem[]>([]);
  const [showRetirarCellModal, setShowRetirarCellModal] = useState(false);
  const [pendingRetirarQueue, setPendingRetirarQueue] = useState<Array<{ position: string; items: LocationItem[] }>>([]);
  const [showMoverArticleList, setShowMoverArticleList] = useState(false);
  const [showRetirarArticleList, setShowRetirarArticleList] = useState(false);
  // Batch mode — múltiples artículos en la misma ubicación
  const [batchMode, setBatchMode] = useState(false);
  const [batchArticles, setBatchArticles] = useState<Array<{ articleCode: string; orderFab: string }>>([]);
  // Multi-estantería — mismo artículo en varias secciones
  const [additionalShelfPositions, setAdditionalShelfPositions] = useState<Array<{ shelfCode: string; shelfName: string; positions: string[] }>>([]);
  const [showAddShelfModal, setShowAddShelfModal] = useState(false);
  const [addShelfCode, setAddShelfCode] = useState('');
  const [addShelfPositionText, setAddShelfPositionText] = useState('');

  // Notificar cambios de acción al padre
  useEffect(() => {
    onActionChange?.(action);
  }, [action, onActionChange]);

  // Consumir el trigger externo del padre
  useEffect(() => {
    if (externalActionTrigger && externalActionTrigger !== 'idle') {
      startAction(externalActionTrigger);
      onExternalActionConsumed?.();
    }
  }, [externalActionTrigger, onExternalActionConsumed]);

  // Consumir cambio externo de estantería desde sidebar
  useEffect(() => {
    if (externalShelfTrigger) {
      setSelectedShelf(externalShelfTrigger);
      resetOperative();
      onExternalShelfConsumed?.();
    }
  }, [externalShelfTrigger, onExternalShelfConsumed]);

  const resetOperative = () => {
    setAction('idle');
    setScanData(null);
    setSelectedPositions([]);
    setScannerActive(false);
    setPendingRetirarQueue([]);
    setShowMoverArticleList(false);
    setShowRetirarArticleList(false);
    setBatchMode(false);
    setBatchArticles([]);
    setAdditionalShelfPositions([]);
    setShowAddShelfModal(false);
  };

  const showToast = (type: 'success' | 'error' | 'info', msg: string, ms = 2500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setFeedback({ type, msg });
    toastTimerRef.current = setTimeout(() => {
      setFeedback(null);
      toastTimerRef.current = null;
    }, ms);
  };

  const finishAction = (type: 'success' | 'error' | 'info', msg: string) => {
    showToast(type, msg, 2800);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    finishTimerRef.current = setTimeout(() => resetOperative(), 2800);
  };

  const applyScanMethod = (method: ScanMethod) => {
    setScanMethodPickerOpen(false);
    if (!pendingAction) return;
    setAction(pendingAction);
    setPendingAction(null);
    if (method === 'manual') setScannerActive(true);
    else if (method === 'barcode') setShowCameraQR(true);
    else setShowCameraOCR(true);
  };

  const beginBatchMode = () => {
    setScanMethodPickerOpen(false);
    if (!pendingAction) return;
    setAction(pendingAction);
    setBatchMode(true);
    setBatchArticles([]);
    setSelectedPositions([]);
    setPendingAction(null);
    setScannerActive(true);
  };

  const startAction = (act: NavAction) => {
    setScanData(null);
    setSelectedPositions([]);
    setFeedback(null);
    if (act === 'avisar') {
      setAction('avisar');
      setConfirmModal({
        open: true, title: 'Avisar al Carretillero',
        message: `Se avisará que hay una pieza para recoger en ${shelfDef?.name || selectedShelf}`,
        icon: '🚚', variant: 'warning',
        confirmText: 'LLEVAR — que me se lleven un artículo',
        onConfirm: async () => {
          setProcessing(true);
          setConfirmModal(prev => ({ ...prev, open: false }));
          const ok = await createPickupRequest(effectiveOperarioId, displayName, selectedShelf);
          setProcessing(false);
          if (ok) finishAction('success', '✅ Aviso enviado');
          else finishAction('error', 'Error al enviar');
        },
      });
      return;
    }
    if (act === 'retirar') {
      setAction('retirar');
      setShowRetirarArticleList(true);
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

  const handleRetirarArticleListConfirm = useCallback(async (selectedItems: RetirarItem[]) => {
    setShowRetirarArticleList(false);
    setProcessing(true);
    let successCount = 0;
    for (const item of selectedItems) {
      const result = await retirarDeUbicacion(item.articleCode, item.orderFab, item.position, effectiveOperarioId, displayName);
      if (result.success) successCount++;
    }
    setProcessing(false);
    if (successCount === selectedItems.length)
      finishAction('success', `✅ ${selectedItems.length} artículo${selectedItems.length !== 1 ? 's' : ''} retirado${selectedItems.length !== 1 ? 's' : ''}`);
    else
      finishAction('error', `Parcial: ${successCount}/${selectedItems.length} retirados`);
  }, [retirarDeUbicacion, effectiveOperarioId, displayName, finishAction]);

  const handleUbicarBatchConfirm = async () => {
    if (selectedPositions.length === 0 || batchArticles.length === 0) return;
    setProcessing(true);
    let successCount = 0;
    for (const article of batchArticles) {
      const ok = selectedPositions.length === 1
        ? await ubicar(article.articleCode, article.orderFab, selectedPositions[0], effectiveOperarioId, displayName)
        : await ubicarMulti(article.articleCode, article.orderFab, selectedPositions, effectiveOperarioId, displayName);
      if (ok) successCount++;
    }
    setProcessing(false);
    if (successCount === batchArticles.length) {
      finishAction('success', `✅ ${batchArticles.length} artículo${batchArticles.length > 1 ? 's' : ''} ubicado${batchArticles.length > 1 ? 's' : ''} en ${selectedPositions.length} posición${selectedPositions.length > 1 ? 'es' : ''}`);
    } else {
      finishAction('error', `Parcial: ${successCount}/${batchArticles.length} artículos ubicados`);
    }
  };

  const handleScan = async (result: ScanParseResult) => {
    if (!result.success) {
      showToast('error', 'error' in result ? result.error : 'Error de escaneo');
      setScannerActive(true);
      return;
    }
    const { articleCode, orderFab } = result.data;

    // Batch mode: add article to list
    if (action === 'ubicar' && batchMode) {
      const duplicate = batchArticles.some(a => a.articleCode === articleCode && a.orderFab === orderFab);
      if (duplicate) {
        showToast('error', `${articleCode} ya está en el lote`);
        setScannerActive(true);
        return;
      }
      setBatchArticles(prev => [...prev, { articleCode, orderFab }]);
      showToast('success', `✅ ${articleCode} añadido al lote`);
      setScannerActive(true);
      return;
    }

    setScanData({ articleCode, orderFab });
    setScannerActive(false);

    // Ghost article check before ubicar
    if (action === 'ubicar') {
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
          message: `${formatArticleDisplay(articleCode, orderFab)} ya figura en el sistema:\n\n${locationText}\n\n¿Confirmas que ya NO se encuentra ahí?`,
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
        return;
      }
    }

    if (action === 'retirar') {
      const found = findArticle(articleCode, orderFab);
      if (found.length === 0) { showToast('error', 'Artículo no encontrado'); setScannerActive(true); return; }

      let msg = `${formatArticleDisplay(articleCode, orderFab)} en: ${found.map(l => parseInt(l.position, 10)).join(', ')}`;
      if (found.length > 1) {
        msg += `\n\n⚠️ Este artículo ocupa ${found.length} posiciones. Si lo retiras, se retirará de TODAS.`;
      }
      const otherItemsCount = found.reduce((acc, loc) => {
        const others = (loc.items || []).filter(
          i => i.articleCode !== articleCode || i.orderFab !== orderFab
        ).length;
        return acc + others;
      }, 0);
      if (otherItemsCount > 0) {
        msg += `\n\nHay ${otherItemsCount} artículo(s) más en esas ubicaciones que se mantendrán.`;
      }

      setConfirmModal({
        open: true, title: 'Confirmar Retirada',
        message: msg,
        icon: '📤', variant: 'danger',
        onConfirm: async () => {
          setProcessing(true); setConfirmModal(p => ({ ...p, open: false }));
          const r = await retirar(articleCode, orderFab, effectiveOperarioId, displayName);
          setProcessing(false);
          if (r.success) finishAction('success', '✅ Retirado');
          else finishAction('error', r.error || 'Error al retirar');
        },
      });
    } else if (action === 'almacen') {
      // Enviar a almacén — confirmar y llamar al backend
      setConfirmModal({
        open: true, title: 'Enviar a Almacén',
        message: `¿Enviar ${formatArticleDisplay(articleCode, orderFab)} a almacén?\nSe retirará de TODAS las estanterías donde esté ubicado.`,
        icon: '🏭', variant: 'warning',
        onConfirm: async () => {
          setProcessing(true); setConfirmModal(p => ({ ...p, open: false }));
          try {
            const fn = httpsCallable(functions, 'shelfOperate');
            const result = await fn({
              op: 'enviarAlmacen',
              payload: { articleCode, orderFab, shelfCode: selectedShelf },
              session: { operarioId: effectiveOperarioId, operarioName: displayName },
            });
            const data = result.data as any;
            finishAction('success', `✅ Enviado a almacén (${data.removedFrom || 0} ubicaciones)`);
          } catch (err: unknown) {
            finishAction('error', parseCallableError(err));
          }
          setProcessing(false);
        },
      });
    }
  };

  const handleUbicarMultiConfirm = async () => {
    if (!scanData || selectedPositions.length === 0) return;
    setProcessing(true);
    setShowAddShelfModal(false);
    const { articleCode, orderFab } = scanData;

    // Ubicar en la estantería actual
    const ok = selectedPositions.length === 1
      ? await ubicar(articleCode, orderFab, selectedPositions[0], effectiveOperarioId, displayName)
      : await ubicarMulti(articleCode, orderFab, selectedPositions, effectiveOperarioId, displayName);

    // Ubicar en estanterías adicionales (artículo grande multi-sección)
    if (ok && additionalShelfPositions.length > 0) {
      const fn = httpsCallable(functions, 'shelfOperate');
      for (const extra of additionalShelfPositions) {
        try {
          await fn({
            op: extra.positions.length === 1 ? 'ubicar' : 'ubicarMulti',
            payload: {
              articleCode, orderFab,
              shelfCode: extra.shelfCode,
              position: extra.positions[0],
              positions: extra.positions,
            },
            session: { operarioId: effectiveOperarioId, operarioName: displayName },
          });
        } catch { /* error individual por sección — continúa */ }
      }
    }

    setProcessing(false);
    if (ok) {
      const allShelves = [
        `${selectedShelf}: pos. ${selectedPositions.map(p => parseInt(p, 10)).join(', ')}`,
        ...additionalShelfPositions.map(e => `${e.shelfName}: pos. ${e.positions.map(p => parseInt(p, 10)).join(', ')}`),
      ].join(' · ');
      setAdditionalShelfPositions([]);
      setConfirmModal({
        open: true,
        title: '✅ Artículo ubicado',
        message: `${articleCode} ubicado en ${allShelves}.\n¿Ubicar otro artículo en las mismas posiciones?`,
        icon: '📦',
        variant: 'success',
        confirmText: 'SÍ, ubicar otro',
        onConfirm: () => {
          setConfirmModal(p => ({ ...p, open: false }));
          setScanData(null);
          setScannerActive(false);
          setShowCameraQR(false);
          setShowCameraOCR(false);
          setScanMethodPickerOpen(true);
        },
        extraButton: {
          text: 'NO, finalizar',
          onClick: () => finishAction('success', `✅ ${articleCode} ubicado correctamente`),
        },
      });
    } else {
      finishAction('error', 'Error al ubicar');
    }
  };

  const handleCellPress = (loc: ShelfLocationState) => {
    if (action === 'retirar') {
      if (!loc.isEmpty && loc.items.length > 0) {
        setRetirarCellPosition(loc.position);
        setRetirarCellItems(loc.items);
        setShowRetirarCellModal(true);
      }
      return;
    }
    // Batch mode: accumulate positions
    if (action === 'ubicar' && batchMode && batchArticles.length > 0) {
      if (!loc.isEmpty && loc.items.length > 0 && !selectedPositions.includes(loc.position)) {
        showToast('info', `⚠️ Pos. ${parseInt(loc.position, 10)} ocupada — se añadirá igualmente`);
      }
      setSelectedPositions(prev => {
        if (prev.includes(loc.position)) return prev.filter(p => p !== loc.position);
        return [...prev, loc.position];
      });
      return;
    }
    if (action === 'ubicar' && scanData) {
      // Warn if occupied but allow selection
      if (!loc.isEmpty && loc.items.length > 0 && !selectedPositions.includes(loc.position)) {
        showToast('info', `⚠️ Pos. ${parseInt(loc.position, 10)} ya tiene ${loc.items.length} artículo(s) — se añadirá igualmente`);
      }
      // Accumulate positions (tap again to deselect)
      setSelectedPositions(prev => {
        if (prev.includes(loc.position)) return prev.filter(p => p !== loc.position);
        return [...prev, loc.position];
      });
    } else if (action === 'mover' && scanData) {
      const found = findArticle(scanData.articleCode, scanData.orderFab);
      const needed = found.length || 1;
      setSelectedPositions(prev => {
        if (prev.includes(loc.position)) return prev.filter(p => p !== loc.position);
        if (prev.length >= needed) return [...prev.slice(1), loc.position];
        return [...prev, loc.position];
      });
    }
  };

  const handleMoverSelectArticle = useCallback((articleCode: string, orderFab: string) => {
    setShowMoverArticleList(false);
    setScanData({ articleCode, orderFab });
    setSelectedPositions([]);
  }, []);

  const moverNeeded = useMemo(() => {
    if (action !== 'mover' || !scanData) return 1;
    return findArticle(scanData.articleCode, scanData.orderFab).length || 1;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, scanData, locations]);

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

  const handleRetirarCellItemsConfirm = (selectedItems: LocationItem[]) => {
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
        setConfirmModal((prev) => ({ ...prev, open: false }));
        setProcessing(true);
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
      },
      extraButton: {
        text: 'SÍ, retirar más',
        onClick: () => setConfirmModal((prev) => ({ ...prev, open: false })),
      },
    });
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      {/* Selector de estanterías — oculto cuando estamos en modo carro */}
      {!lockedShelf && (
        <div className="flex-shrink-0 hidden sm:block">
          <ShelfNavigatorTabs selectedShelf={selectedShelf} onSelectShelf={(shelfCode) => { setSelectedShelf(shelfCode); resetOperative(); setHighlightedSearch([]); }} />
        </div>
      )}
      <div className="flex-shrink-0 hidden sm:block">
        <ShelfNavigatorStatus
          totalEmpty={totalEmpty}
          totalOccupied={totalOccupied}
          totalArticles={totalArticles}
          actionActive={action !== 'idle'}
          canConfirmMove={action === 'mover' && !!scanData && selectedPositions.length === moverNeeded}
          moverNeeded={action === 'mover' && !!scanData ? moverNeeded : undefined}
          moverSelected={action === 'mover' ? selectedPositions.length : undefined}
          scannerActive={scannerActive}
          scanArticle={scanData && action === 'ubicar' && selectedPositions.length === 0 ? scanData.articleCode : undefined}
          onConfirmMove={handleMoverConfirm}
          onCancel={resetOperative}
        />
        {/* Confirm ubicar when positions selected */}
        {action === 'ubicar' && scanData && selectedPositions.length > 0 && (
          <div className="mx-3 mt-2 mb-1 px-4 py-3 rounded-2xl bg-emerald-50 border-2 border-emerald-500 shadow-md shadow-emerald-100">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-emerald-700 truncate">📦 {scanData.articleCode}</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {selectedShelf}: pos. {selectedPositions.map(p => parseInt(p, 10)).join(', ')}
                  {additionalShelfPositions.map(e => (
                    <span key={e.shelfCode} className="ml-1 text-blue-600">· {e.shelfName}: pos. {e.positions.map(p => parseInt(p, 10)).join(', ')}</span>
                  ))}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setAddShelfCode(''); setAddShelfPositionText(''); setShowAddShelfModal(true); }}
                  disabled={processing}
                  className="px-3 py-2 bg-blue-100 hover:bg-blue-200 active:scale-95 text-blue-700 text-xs font-bold rounded-xl disabled:opacity-50 transition-all touch-manipulation"
                >
                  ➕ Otra sección
                </button>
                <button
                  onClick={handleUbicarMultiConfirm}
                  disabled={processing}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-all touch-manipulation"
                >
                  {processing ? '⏳' : '✓'} Ubicar
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Barra de búsqueda */}
      {action === 'idle' && (
        <div className="flex-shrink-0">
          <KioskSearchBar locations={locations} onHighlight={setHighlightedSearch} />
        </div>
      )}

        {/* Modal: añadir posición en otra estantería */}
        {showAddShelfModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowAddShelfModal(false); setAddShelfCode(''); setAddShelfPositionText(''); }}>
            <div className="w-full max-w-md bg-white rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-black text-slate-900">➕ Añadir posición en otra sección</h3>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sección</label>
                <select
                  value={addShelfCode}
                  onChange={e => setAddShelfCode(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium bg-white"
                >
                  <option value="">— Selecciona sección —</option>
                  {ALL_SHELVES.filter(s => s.code !== selectedShelf).map(s => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Posiciones (ej: 5 o 3,4,5)</label>
                <input
                  type="text"
                  value={addShelfPositionText}
                  onChange={e => setAddShelfPositionText(e.target.value)}
                  placeholder="3 ó 3,4,5"
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono bg-white"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAddShelfModal(false)} className="flex-1 py-3 rounded-2xl bg-rose-100 text-rose-700 font-bold text-sm">Cancelar</button>
                <button
                  onClick={() => {
                    if (!addShelfCode || !addShelfPositionText.trim()) return;
                    const parsedPositions = addShelfPositionText.split(',')
                      .map(p => parseInt(p.trim(), 10))
                      .filter(n => !isNaN(n) && n > 0)
                      .map(n => String(n).padStart(3, '0'));
                    if (parsedPositions.length === 0) return;
                    const shelfName = ALL_SHELVES.find(s => s.code === addShelfCode)?.name ?? addShelfCode;
                    setAdditionalShelfPositions(prev => {
                      const existing = prev.findIndex(e => e.shelfCode === addShelfCode);
                      if (existing >= 0) {
                        const next = [...prev];
                        next[existing] = { shelfCode: addShelfCode, shelfName, positions: parsedPositions };
                        return next;
                      }
                      return [...prev, { shelfCode: addShelfCode, shelfName, positions: parsedPositions }];
                    });
                    setShowAddShelfModal(false);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm active:scale-95"
                >
                  ✓ Añadir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Batch UI — múltiples artículos en una/varias ubicaciones */}
      {batchMode && action === 'ubicar' && (
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-900">📦 Batch</span>
              <span className="bg-cyan-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">{batchArticles.length} art.</span>
              {selectedPositions.length > 0 && (
                <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-bold">
                  pos. {selectedPositions.map(p => parseInt(p, 10)).join(', ')}
                </span>
              )}
            </div>
            <button onClick={resetOperative} className="text-xs text-rose-400 hover:text-rose-500 transition-colors">✕ Cancelar</button>
          </div>
          {batchArticles.length > 0 && (
            <div className="max-h-14 overflow-y-auto bg-slate-50 rounded-lg p-2 mb-2">
              {batchArticles.map((a, i) => (
                <div key={i} className="text-xs text-slate-600 font-mono truncate">
                  {i + 1}. {a.articleCode} · {a.orderFab}
                </div>
              ))}
            </div>
          )}
          {selectedPositions.length === 0 && batchArticles.length > 0 && (
            <p className="text-xs text-slate-500 mb-2">👇 Toca celda(s) en el grid para seleccionar ubicación</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setScannerActive(true)}
              className="flex-1 min-h-[40px] rounded-xl bg-slate-100 text-slate-700 text-xs font-bold active:scale-95 transition-all touch-manipulation"
            >
              + Escanear más
            </button>
            <button
              onClick={handleUbicarBatchConfirm}
              disabled={selectedPositions.length === 0 || batchArticles.length === 0 || processing}
              className="flex-[2] min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-40 active:scale-95 transition-all touch-manipulation"
            >
              {processing ? '⏳' : '✓'} Ubicar {batchArticles.length} artículo{batchArticles.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Feedback */}
      <div className="flex-shrink-0">
        {feedback && (
          <div className={`mx-4 mt-2 p-3 rounded-xl text-center font-bold text-sm
            ${feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
              feedback.type === 'info' ? 'bg-blue-500/20 text-blue-400' :
              'bg-red-500/20 text-red-400'}`}>
            {feedback.msg}
          </div>
        )}
      </div>

      {/* Grid — scroll vertical aquí; cada bloque de estantería gestiona su propio scroll horizontal */}
      <div className="smooth-scroll flex-1 min-h-0 min-w-0 w-full overflow-y-auto overscroll-contain p-2 sm:p-4 [scrollbar-width:thin] [scrollbar-color:rgba(30,41,59,0.8)_transparent]">
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
              ...highlightedSearch,
              ...(scanData ? findArticle(scanData.articleCode, scanData.orderFab).map(l => l.position) : []),
            ]}
            compact={false}
            fullscreenMode={true}
          />
        )}
      </div>

      <ScanMethodPicker
        open={scanMethodPickerOpen}
        actionLabel={
          pendingAction === 'ubicar' ? 'Ubicar artículo' :
          pendingAction === 'retirar' ? 'Retirar artículo' :
          pendingAction === 'mover' ? 'Mover artículo' :
          pendingAction === 'almacen' ? 'Enviar a almacén' : 'Seleccionar'
        }
        onSelect={applyScanMethod}
        onBatch={pendingAction === 'ubicar' ? beginBatchMode : undefined}
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
          onScan={(text) => { setShowCameraQR(false); handleScan(parseScanInput(text)); }}
          onClose={() => { setShowCameraQR(false); setScannerActive(true); }}
        />
      )}
      {showCameraOCR && (
        <React.Suspense fallback={<div className="p-4 text-center">Cargando escáner OCR...</div>}>
          <CameraOCRScanner
            onResult={(text) => { setShowCameraOCR(false); handleScan(parseScanInputLenient(text)); }}
            onClose={() => { setShowCameraOCR(false); setScannerActive(true); }}
          />
        </React.Suspense>
      )}

      {showMoverArticleList && (
        <MoverArticleList
          locations={locations}
          shelfCode={selectedShelf}
          onSelect={handleMoverSelectArticle}
          onClose={() => { setShowMoverArticleList(false); resetOperative(); }}
        />
      )}

      {showRetirarArticleList && (
        <RetirarArticleList
          locations={locations}
          shelfCode={selectedShelf}
          onConfirm={handleRetirarArticleListConfirm}
          onClose={() => { setShowRetirarArticleList(false); resetOperative(); }}
        />
      )}

      <ConfirmationModal
        open={confirmModal.open}
        onClose={() => setConfirmModal(p => ({ ...p, open: false }))}
        title={confirmModal.title} message={confirmModal.message}
        icon={confirmModal.icon} variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm} extraButton={confirmModal.extraButton}
        loading={processing}
      />

      <RetirarCellModal
        open={showRetirarCellModal}
        position={retirarCellPosition}
        items={retirarCellItems}
        onConfirm={handleRetirarCellItemsConfirm}
        onClose={() => setShowRetirarCellModal(false)}
        loading={processing}
      />
    </div>
  );
};

export default ShelfNavigator;


