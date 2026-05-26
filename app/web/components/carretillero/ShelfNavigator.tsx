/**
 * ShelfNavigator — Navegador de estanterías para el carretillero
 * Gestor de Estanterías WMS v3.0
 * 
 * Lista horizontal scrollable de todas las estanterías.
 * Al seleccionar una, muestra su grid.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useShelf } from '../../hooks/useShelf';
import { useAuth } from '../../hooks/useAuth';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskSearchBar from '../kiosk/KioskSearchBar';
import ScannerInput from '../kiosk/ScannerInput';
import CameraQRScanner from '../common/CameraQRScanner';
import CameraOCRScanner from '../common/CameraOCRScanner';
import ScanMethodPicker, { type ScanMethod } from '../common/ScanMethodPicker';
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
import MoverArticleList from '../kiosk/MoverArticleList';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import type { LocationItem } from '../../lib/schema/locations';

type NavAction = 'idle' | 'ubicar' | 'retirar' | 'mover' | 'avisar' | 'almacen';

const ShelfNavigator: React.FC = () => {
  const [selectedShelf, setSelectedShelf] = useState(SHELF_DEFINITIONS[0]?.code || 'MEC');
  const [highlightedSearch, setHighlightedSearch] = useState<string[]>([]);
  const { locations, loading, shelfDef, ubicar, retirar, mover, findArticle, totalOccupied, totalEmpty, totalArticles } = useShelf(selectedShelf);
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

  const resetOperative = () => {
    setAction('idle');
    setScanData(null);
    setSelectedPositions([]);
    setScannerActive(false);
    setPendingRetirarQueue([]);
    setShowMoverArticleList(false);
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
    setTimeout(() => resetOperative(), 2800);
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

  const handleScan = async (result: ScanParseResult) => {
    if (!result.success) {
      showToast('error', 'error' in result ? result.error : 'Error de escaneo');
      setScannerActive(true);
      return;
    }
    const { articleCode, orderFab } = result.data;
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

  const handleCellPress = (loc: ShelfLocationState) => {
    if (action === 'retirar') {
      if (!loc.isEmpty && loc.items.length > 0) {
        setRetirarCellPosition(loc.position);
        setRetirarCellItems(loc.items);
        setShowRetirarCellModal(true);
      }
      return;
    }
    if (action === 'ubicar' && scanData) {
      setConfirmModal({
        open: true, title: loc.isEmpty ? 'Confirmar Ubicación' : 'Celda Ocupada',
        message: loc.isEmpty
          ? `¿Ubicar ${scanData.articleCode} en posición ${parseInt(loc.position, 10)}?`
          : `Esta celda tiene ${loc.items.length} artículo(s). ¿Añadir igualmente?`,
        icon: loc.isEmpty ? '📦' : '⚠️', variant: loc.isEmpty ? 'success' : 'warning',
        onConfirm: async () => {
          setProcessing(true); setConfirmModal(p => ({ ...p, open: false }));
          const ok = await ubicar(scanData.articleCode, scanData.orderFab, loc.position, effectiveOperarioId, displayName);
          setProcessing(false);
          if (ok) finishAction('success', '✅ Ubicado');
          else finishAction('error', 'Error al ubicar');
        },
        extraButton: !loc.isEmpty ? { text: 'Elegir otra', onClick: () => setConfirmModal(p => ({ ...p, open: false })) } : undefined,
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

    setPendingRetirarQueue((prev) => [...prev, { position, items: selectedItems }]);
    setConfirmModal({
      open: true,
      title: '¿Retirar algo más?',
      message: `${selectedItems.length} artículo(s) de posición ${parseInt(position, 10)} añadido(s) a la cola`,
      icon: '📤',
      variant: 'info',
      confirmText: 'NO, finalizar retirada',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        await handleFinalizarRetiradaCarretillero();
      },
      extraButton: {
        text: 'SÍ, retirar más',
        onClick: () => setConfirmModal((prev) => ({ ...prev, open: false })),
      },
    });
  };

  const handleFinalizarRetiradaCarretillero = async () => {
    let successCount = 0;
    setProcessing(true);

    for (const queueItem of pendingRetirarQueue) {
      for (const item of queueItem.items) {
        const result = await retirar(item.articleCode, item.orderFab, effectiveOperarioId, displayName);
        if (result.success) successCount++;
      }
    }

    setProcessing(false);
    const totalItems = pendingRetirarQueue.reduce((sum, q) => sum + q.items.length, 0);
    if (successCount === totalItems) {
      finishAction('success', `✅ ${totalItems} artículo(s) retirado(s) correctamente`);
    } else {
      finishAction('error', `Parcial: ${successCount}/${totalItems} artículos retirados`);
    }
    setPendingRetirarQueue([]);
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      <ShelfNavigatorTabs selectedShelf={selectedShelf} onSelectShelf={(shelfCode) => { setSelectedShelf(shelfCode); setAction('idle'); setScanData(null); setHighlightedSearch([]); }} />
      <ShelfNavigatorStatus
        totalEmpty={totalEmpty}
        totalOccupied={totalOccupied}
        totalArticles={totalArticles}
        actionActive={action !== 'idle'}
        canConfirmMove={action === 'mover' && !!scanData && selectedPositions.length === moverNeeded}
        moverNeeded={action === 'mover' && !!scanData ? moverNeeded : undefined}
        moverSelected={action === 'mover' ? selectedPositions.length : undefined}
        scannerActive={scannerActive}
        scanArticle={scanData && action === 'ubicar' ? scanData.articleCode : undefined}
        onConfirmMove={handleMoverConfirm}
        onCancel={() => { setAction('idle'); setScanData(null); setSelectedPositions([]); setScannerActive(false); }}
      />

       {/* Search */}
       <KioskSearchBar 
         locations={locations} 
         onHighlight={setHighlightedSearch} 
         global={true}
         currentShelfCode={selectedShelf}
         canNavigateToShelf={true}
         onShelfNavigate={setSelectedShelf}
         onOutOfShelfResult={(result) => {
           // Mostrar aviso de que el resultado está en otra estantería
           showToast('info', `En ${result.shelfCode} (pos. ${result.positions.join(', ')})`);
         }}
       />

      {/* Feedback */}
      {feedback && (
        <div className={`mx-4 mt-2 p-3 rounded-xl text-center font-bold text-sm
          ${feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Grid — scroll vertical aquí; cada bloque de estantería gestiona su propio scroll horizontal */}
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
            highlightedPositions={[...highlightedSearch, ...(scanData ? findArticle(scanData.articleCode, scanData.orderFab).map(l => l.position) : [])]}
            compact={false}
            fullscreenMode={true}
          />
        )}
      </div>

      {/* Action buttons */}
      {action === 'idle' && (
        <div className="flex-shrink-0 bg-white border-t border-slate-200 p-3">
          <div className="grid grid-cols-4 gap-2 max-w-2xl mx-auto">
            <button onClick={() => startAction('ubicar')}
              className="h-14 rounded-xl bg-emerald-600 text-white font-bold text-sm flex flex-col items-center justify-center active:scale-95 transition-all">
              <span>📦</span> UBICAR
            </button>
            <button onClick={() => startAction('retirar')}
              className="h-14 rounded-xl bg-red-600 text-white font-bold text-sm flex flex-col items-center justify-center active:scale-95 transition-all">
              <span>📤</span> RETIRAR
            </button>
            <button onClick={() => startAction('mover')}
              className="h-14 rounded-xl bg-blue-600 text-white font-bold text-sm flex flex-col items-center justify-center active:scale-95 transition-all">
              <span>🔄</span> MOVER
            </button>
            <button onClick={() => startAction('almacen')}
              className="h-14 rounded-xl bg-purple-600 text-white font-bold text-xs flex flex-col items-center justify-center active:scale-95 transition-all">
              <span>🏭</span> ALMACÉN
            </button>
          </div>
        </div>
      )}

      <ScanMethodPicker
        open={scanMethodPickerOpen}
        actionLabel={
          pendingAction === 'ubicar' ? 'Ubicar artículo' :
          pendingAction === 'retirar' ? 'Retirar artículo' :
          pendingAction === 'mover' ? 'Mover artículo' :
          pendingAction === 'almacen' ? 'Enviar a almacén' : 'Escanear'
        }
        onSelect={applyScanMethod}
        onClose={() => { setScanMethodPickerOpen(false); setPendingAction(null); }}
      />

      <ScannerInput
        onScan={handleScan}
        active={scannerActive}
        disabled={processing}
        showCameraButtons={false}
      />

      {showCameraQR && (
        <CameraQRScanner
          onScan={(text) => { setShowCameraQR(false); handleScan(parseScanInput(text)); }}
          onClose={() => { setShowCameraQR(false); setScannerActive(true); }}
        />
      )}
      {showCameraOCR && (
        <CameraOCRScanner
          onResult={(text) => { setShowCameraOCR(false); handleScan(parseScanInputLenient(text)); }}
          onClose={() => { setShowCameraOCR(false); setScannerActive(true); }}
        />
      )}

      {showMoverArticleList && (
        <MoverArticleList
          locations={locations}
          shelfCode={selectedShelf}
          onSelect={handleMoverSelectArticle}
          onClose={() => { setShowMoverArticleList(false); resetOperative(); }}
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
