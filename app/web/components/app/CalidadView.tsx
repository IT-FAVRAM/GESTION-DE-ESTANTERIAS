import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useShelf } from '../../hooks/useShelf';
import { useAuth } from '../../hooks/useAuth';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskSearchBar from '../kiosk/KioskSearchBar';
import ScannerInput from '../kiosk/ScannerInput';
import CameraQRScanner from '../common/CameraQRScanner';
import CameraOCRScanner from '../common/CameraOCRScanner';
import ConfirmationModal from '../common/ConfirmationModal';
import ReprocesosEditor from '../kiosk/ReprocesosEditor';
import { isReprocesosLocation } from '../../lib/firestoreSchema';
import { calcReprocesosTotal } from '../../lib/api/reprocesosApi';
import CalidadReprocesosSection from './CalidadReprocesosSection';
import { formatArticleDisplay, type ScanParseResult, parseScanInput, parseScanInputLenient } from '../../lib/qrParser';
import type { ShelfLocationState } from '../../hooks/useShelf';
import { usePickupQueue } from '../../hooks/usePickupQueue';

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

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; message: string; icon: string;
    variant: 'success' | 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    extraButton?: { text: string; onClick: () => void };
  }>({ open: false, title: '', message: '', icon: '', variant: 'info', onConfirm: () => {} });

  // Batch support
  const [batchMode, setBatchMode] = useState(false);
  const [batchArticles, setBatchArticles] = useState<Array<{ articleCode: string; orderFab: string }>>([]);
  const [batchRetiraPending, setBatchRetiraPending] = useState<Array<{ articleCode: string; orderFab: string; locations: ShelfLocationState[] }>>([]);
  const [currentBatchRetirarIndex, setCurrentBatchRetirarIndex] = useState(0);

  const { locations, loading, shelfDef, ubicar, retirar, mover, findArticle } = useShelf(SHELF);
  const { operarioId, firebaseUser, displayName, logout, canEditReprocesses, canViewReprocessCosts } = useAuth();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';
  const { createPickupRequest } = usePickupQueue();

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

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => { setFeedback(null); resetAction(); }, 3000);
  };

  const resetAction = () => {
    setAction('idle');
    setScanData(null);
    setSelectedPositions([]);
    setScannerActive(false);
    setBatchMode(false);
    setBatchArticles([]);
    setBatchRetiraPending([]);
    setCurrentBatchRetirarIndex(0);
  };

  const startAction = (act: CalidadAction) => {
    setAction(act);
    setScanData(null);
    setSelectedPositions([]);
    setFeedback(null);
    if (act === 'avisar') {
      setConfirmModal({
        open: true,
        title: 'Solicitar Recogida',
        message: `Se avisará al carretillero para recoger material de ${shelfDef?.name || SHELF}`,
        icon: '🚚',
        variant: 'warning',
        onConfirm: async () => {
          setProcessing(true);
          setConfirmModal((prev) => ({ ...prev, open: false }));
          const ok = await createPickupRequest(effectiveOperarioId, displayName, SHELF);
          setProcessing(false);
          showFeedback(ok ? 'success' : 'error', ok ? '✅ Aviso enviado' : 'Error al enviar');
        },
      });
    } else if (act === 'ubicar' || act === 'retirar') {
      setConfirmModal({
        open: true,
        title: `¿${act === 'ubicar' ? 'UBICAR' : 'RETIRAR'} varios artículos?`,
        message: `¿Vas a ${act === 'ubicar' ? 'ubicar' : 'retirar'} varios artículos a la vez?`,
        icon: act === 'ubicar' ? '📦' : '📤',
        variant: 'info',
        onConfirm: () => {
          setBatchMode(true);
          setScannerActive(true);
          setConfirmModal((prev) => ({ ...prev, open: false }));
        },
        extraButton: {
          text: 'No, solo uno',
          onClick: () => {
            setBatchMode(false);
            setScannerActive(true);
            setConfirmModal((prev) => ({ ...prev, open: false }));
          },
        },
      });
    } else {
      setScannerActive(true);
    }
  };

  const handleScan = (result: ScanParseResult) => {
    if (!result.success) {
      showFeedback('error', 'error' in result ? result.error : 'Error de escaneo');
      return;
    }
    const { articleCode, orderFab } = result.data;

    if (action === 'ubicar' && batchMode) {
      const duplicate = batchArticles.some((a) => a.articleCode === articleCode && a.orderFab === orderFab);
      if (duplicate) {
        showFeedback('error', `${articleCode} ${orderFab} ya está en el batch`);
        setScannerActive(true);
        return;
      }
      setBatchArticles((prev) => [...prev, { articleCode, orderFab }]);
      showFeedback('success', `✅ ${articleCode} ${orderFab} añadido`);
      setScannerActive(true);
      return;
    }

    if (action === 'retirar' && batchMode) {
      const found = findArticle(articleCode, orderFab);
      if (found.length === 0) {
        showFeedback('error', `${articleCode} no encontrado`);
        setScannerActive(true);
        return;
      }
      const duplicate = batchRetiraPending.some((a) => a.articleCode === articleCode && a.orderFab === orderFab);
      if (duplicate) {
        showFeedback('error', `Este artículo se ha escaneado dos veces. Solo se puede retirar una vez.`);
        setScannerActive(true);
        return;
      }
      setBatchRetiraPending((prev) => [...prev, { articleCode, orderFab, locations: found }]);
      showFeedback('success', `✅ ${articleCode} ${orderFab} añadido`);
      setScannerActive(true);
      return;
    }

    setScanData({ articleCode, orderFab });
    setScannerActive(false);

    if (action === 'retirar') {
      const found = findArticle(articleCode, orderFab);
      if (found.length === 0) { showFeedback('error', 'Artículo no encontrado'); return; }

      const otherItemsCount = found.reduce((acc, loc) => {
        return acc + (loc.items || []).filter(
          (i) => i.articleCode !== articleCode || i.orderFab !== orderFab,
        ).length;
      }, 0);

      let msg = `${formatArticleDisplay(articleCode, orderFab)} en: ${found.map((l) => parseInt(l.position, 10)).join(', ')}`;
      if (found.length > 1) msg += `\n\n⚠️ Este artículo ocupa ${found.length} posiciones. Si lo retiras, se retirará de TODAS.`;
      if (otherItemsCount > 0) msg += `\n\nHay ${otherItemsCount} artículo(s) más en esas ubicaciones que se mantendrán.`;

      setConfirmModal({
        open: true,
        title: 'Confirmar Retirada',
        message: msg,
        icon: '📤',
        variant: 'danger',
        onConfirm: async () => {
          setProcessing(true);
          setConfirmModal((p) => ({ ...p, open: false }));
          const r = await retirar(articleCode, orderFab, effectiveOperarioId, displayName);
          setProcessing(false);
          showFeedback(r.success ? 'success' : 'error', r.success ? '✅ Retirado' : 'Error');
        },
      });
    }
  };

  const handleUbicarBatchConfirm = useCallback(async () => {
    if (selectedPositions.length === 0) return;
    setProcessing(true);
    setScannerActive(false);
    setConfirmModal((prev) => ({ ...prev, open: false }));

    let successCount = 0;
    for (const article of batchArticles) {
      for (const position of selectedPositions) {
        const success = await ubicar(article.articleCode, article.orderFab, position, effectiveOperarioId, displayName);
        if (success) successCount++;
      }
    }

    setProcessing(false);
    if (successCount === batchArticles.length * selectedPositions.length) {
      showFeedback('success', `✅ ${batchArticles.length} artículos ubicados`);
    } else {
      showFeedback('error', `Parcial: ${successCount}/${batchArticles.length * selectedPositions.length} completadas`);
    }
  }, [batchArticles, selectedPositions, effectiveOperarioId, displayName, ubicar, showFeedback]);

  const handleUbicarMultiPositionConfirm = useCallback(async () => {
    if (!scanData || selectedPositions.length === 0) return;
    setProcessing(true);
    setScannerActive(false);

    let successCount = 0;
    for (const position of selectedPositions) {
      const success = await ubicar(scanData.articleCode, scanData.orderFab, position, effectiveOperarioId, displayName);
      if (success) successCount++;
    }

    setProcessing(false);
    if (successCount === selectedPositions.length) {
      showFeedback('success', `✅ ${scanData.articleCode} ubicado en ${selectedPositions.length} posición(es)`);
    } else {
      showFeedback('error', `Parcial: ${successCount}/${selectedPositions.length} ubicaciones completadas`);
    }
  }, [scanData, selectedPositions, effectiveOperarioId, displayName, ubicar, showFeedback]);

  const handleRetirarBatchNext = useCallback(async () => {
    const processNext = async (index: number) => {
      if (index >= batchRetiraPending.length) {
        showFeedback('success', '✅ Batch de retirada completado');
        resetAction();
        return;
      }

      const item = batchRetiraPending[index];
      const r = await retirar(item.articleCode, item.orderFab, effectiveOperarioId, displayName);
      if (!r.success) {
        showFeedback('error', 'Error al retirar artículo');
        resetAction();
        return;
      }
      setCurrentBatchRetirarIndex(index + 1);
      setTimeout(() => processNext(index + 1), 500);
    };

    processNext(currentBatchRetirarIndex);
  }, [batchRetiraPending, currentBatchRetirarIndex, retirar, effectiveOperarioId, displayName, showFeedback, resetAction]);

  const handleCellPress = useCallback((loc: ShelfLocationState) => {
    if (action === 'idle' && isReprocesosLocation(SHELF, parseInt(loc.position, 10))) {
      if (!canEditReprocesses) {
        showFeedback('error', 'Tu sesión actual no puede editar reprocesos');
        return;
      }
      setReprocesosCell(loc);
      return;
    }

    if (action === 'ubicar' && batchMode && batchArticles.length > 0) {
      const position = loc.position;
      setSelectedPositions((current) => {
        if (current.includes(position)) return current.filter((value) => value !== position);
        return [...current, position];
      });
      return;
    }

    if (action === 'ubicar' && !batchMode && scanData) {
      const position = loc.position;
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

  const handleMoverConfirm = async () => {
    if (!scanData || selectedPositions.length === 0) return;
    setProcessing(true);
    const ok = await mover(scanData.articleCode, scanData.orderFab, selectedPositions, effectiveOperarioId, displayName);
    setProcessing(false);
    showFeedback(ok ? 'success' : 'error', ok ? '✅ Movido' : 'Error');
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
               onClick={() => setShowCameraScanner(true)}
               className="px-3 py-2 text-xs font-bold bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-all duration-200 flex items-center gap-2"
               title="Escanear QR con cámara"
             >
               📷 Cámara
             </button>
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
            {action === 'ubicar' && scanData && selectedPositions.length > 0 && (
              <button
                onClick={handleUbicarMultiPositionConfirm}
                disabled={processing}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
              >
                Confirmar ubicación
              </button>
            )}
            {action === 'mover' && scanData && selectedPositions.length > 0 && (
              <button
                onClick={handleMoverConfirm}
                className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg"
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
        <div className="flex-shrink-0 bg-white border-t border-slate-200 p-3">
          <div className="grid grid-cols-4 gap-2 max-w-2xl mx-auto">
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
                      showFeedback('error', 'Selecciona al menos una posición');
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

      <ScannerInput
        onScan={handleScan}
        active={scannerActive}
        disabled={processing}
        onOpenQRCamera={() => setShowCameraScanner(true)}
        onOpenOCRCamera={() => setShowOCRScanner(true)}
      />

      <ConfirmationModal
        open={confirmModal.open}
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
