import React, { useCallback, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useKiosk } from '../../hooks/useKiosk';
import { useShelf, type ShelfLocationState } from '../../hooks/useShelf';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import ShelfGrid from './ShelfGrid';
import ScannerInput from './ScannerInput';
import ShelfSelector from './ShelfSelector';
import DeviceInfoModal from '../common/DeviceInfoModal';
import ConfirmationModal from '../common/ConfirmationModal';
import { formatArticleDisplay, type ScanParseResult } from '../../lib/qrParser';
import KioskActionBar from './KioskActionBar';
import KioskActionButtons from './KioskActionButtons';
import KioskCellDetailDrawer from './KioskCellDetailDrawer';
import KioskEmptyState from './KioskEmptyState';
import KioskFeedbackToast from './KioskFeedbackToast';
import KioskHeader from './KioskHeader';
import KioskSearchBar from './KioskSearchBar';
import type { KioskAction, KioskConfirmModalState, KioskFeedback, ScanData } from './kioskShared';

const KioskView: React.FC = () => {
  const { assignedShelf, operarioId, displayName, logout, kioskId, deviceId } = useAuth();
  const { kiosk, shelves, currentShelf, setCurrentShelf } = useKiosk(kioskId);
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);

  // Determinar la estantería a mostrar: usar kiosko si está disponible, sino assignedShelf
  const shelfCode = currentShelf || assignedShelf || '';
  const { locations, loading, shelfDef, ubicar, retirar, retirarDeUbicacion, mover, findArticle, totalArticles, totalOccupied, totalEmpty } = useShelf(shelfCode);
  const { createPickupRequest } = usePickupQueue();

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
  const [batchRetiraPending, setBatchRetiraPending] = useState<Array<{ articleCode: string; orderFab: string; locations: ShelfLocationState[] }>>([]);
  const [currentBatchRetirarIndex, setCurrentBatchRetirarIndex] = useState(0);

  const cancelAction = useCallback(() => {
    setAction('idle');
    setScanData(null);
    setSelectedCell(null);
    setSelectedPositions([]);
    setScannerActive(false);
    setRetirarPosition(null);
    setFoundLocationsForRetirar([]);
    setConfirmModal((prev) => ({ ...prev, open: false }));
    setShowShelf(false);
    setBatchMode(false);
    setBatchArticles([]);
    setBatchRetiraPending([]);
    setCurrentBatchRetirarIndex(0);
  }, []);

   const showFeedback = useCallback((type: 'success' | 'error' | 'info', message: string) => {
     setFeedback({ type, message });
     setTimeout(() => {
       setFeedback(null);
       cancelAction();
     }, 3000);
   }, [cancelAction]);

  const handleUbicarConfirm = useCallback(async (position: string) => {
    if (!scanData || !operarioId) return;
    setProcessing(true);
    setConfirmModal((prev) => ({ ...prev, open: false }));
    const success = await ubicar(scanData.articleCode, scanData.orderFab, position, operarioId, displayName);
    setProcessing(false);
    if (success) showFeedback('success', `✅ ${scanData.articleCode} ubicado en posicion ${parseInt(position, 10)}`);
    else showFeedback('error', 'Error al ubicar el articulo');
  }, [displayName, operarioId, scanData, showFeedback, ubicar]);

  const handleRetirarConfirm = useCallback(async (articleCode: string, orderFab: string, specificPosition?: string) => {
    if (!operarioId) return;
    setProcessing(true);
    setConfirmModal((prev) => ({ ...prev, open: false }));

    if (specificPosition) {
      const result = await retirarDeUbicacion(articleCode, orderFab, specificPosition, operarioId, displayName);
      setProcessing(false);
      if (result.success) showFeedback('success', `✅ ${articleCode} retirado de posición ${parseInt(specificPosition, 10)}`);
      else showFeedback('error', 'Error al retirar el articulo');
    } else {
      const result = await retirar(articleCode, orderFab, operarioId, displayName);
      setProcessing(false);
      if (result.success) showFeedback('success', `✅ ${articleCode} retirado de ${result.positions.length} ubicacion(es)`);
      else showFeedback('error', 'Error al retirar el articulo');
    }
  }, [displayName, operarioId, retirar, retirarDeUbicacion, showFeedback]);

  const handleMoverConfirm = useCallback(async () => {
    if (!scanData || !operarioId || selectedPositions.length === 0) return;
    setProcessing(true);
    const success = await mover(scanData.articleCode, scanData.orderFab, selectedPositions, operarioId, displayName);
    setProcessing(false);
    if (success) showFeedback('success', `✅ ${scanData.articleCode} movido a nueva(s) ubicacion(es)`);
    else showFeedback('error', 'Error al mover el articulo');
  }, [displayName, mover, operarioId, scanData, selectedPositions, showFeedback]);

  const handleAvisarConfirm = useCallback(async () => {
    if (!operarioId) return;
    setProcessing(true);
    setConfirmModal((prev) => ({ ...prev, open: false }));
    const success = await createPickupRequest(operarioId, displayName, shelfCode);
    setProcessing(false);
    if (success) showFeedback('success', '✅ Aviso enviado al carretillero');
    else showFeedback('error', 'Error al enviar aviso');
  }, [createPickupRequest, displayName, operarioId, shelfCode, showFeedback]);

  const handleUbicarBatchConfirm = useCallback(async () => {
    if (!operarioId || selectedPositions.length === 0) return;
    setProcessing(true);
    setScannerActive(false);
    setConfirmModal((prev) => ({ ...prev, open: false }));

    let successCount = 0;
    for (const article of batchArticles) {
      for (const position of selectedPositions) {
        const success = await ubicar(article.articleCode, article.orderFab, position, operarioId, displayName);
        if (success) successCount++;
      }
    }

    setProcessing(false);
    if (successCount === batchArticles.length * selectedPositions.length) {
      showFeedback('success', `✅ ${batchArticles.length} artículos ubicados en ${selectedPositions.length} posición(es)`);
    } else {
      showFeedback('error', `Parcial: ${successCount}/${batchArticles.length * selectedPositions.length} ubicaciones completadas`);
    }
  }, [batchArticles, selectedPositions, operarioId, displayName, ubicar, showFeedback]);

  const handleUbicarMultiPositionConfirm = useCallback(async () => {
    if (!scanData || !operarioId || selectedPositions.length === 0) return;
    setProcessing(true);
    setScannerActive(false);

    let successCount = 0;
    for (const position of selectedPositions) {
      const success = await ubicar(scanData.articleCode, scanData.orderFab, position, operarioId, displayName);
      if (success) successCount++;
    }

    setProcessing(false);
    if (successCount === selectedPositions.length) {
      showFeedback('success', `✅ ${scanData.articleCode} ubicado en ${selectedPositions.length} posición(es)`);
    } else {
      showFeedback('error', `Parcial: ${successCount}/${selectedPositions.length} ubicaciones completadas`);
    }
  }, [displayName, operarioId, scanData, selectedPositions, ubicar, showFeedback]);

  const handleRetirarBatchNext = useCallback(async () => {
    if (currentBatchRetirarIndex >= batchRetiraPending.length) {
      showFeedback('success', '✅ Batch de retirada completado');
      return;
    }

    const item = batchRetiraPending[currentBatchRetirarIndex];
    if (item.locations.length === 1) {
      await handleRetirarConfirm(item.articleCode, item.orderFab, item.locations[0].position);
      setCurrentBatchRetirarIndex((prev) => prev + 1);
      setTimeout(() => handleRetirarBatchNext(), 500);
    } else {
      setFoundLocationsForRetirar(item.locations);
      setRetirarPosition(null);
      setConfirmModal({
        open: true,
        title: 'Selecciona de dónde retirar',
        message: `${formatArticleDisplay(item.articleCode, item.orderFab)} está en ${item.locations.length} ubicaciones`,
        icon: '📤',
        variant: 'warning',
        onConfirm: () => {
          if (retirarPosition === 'TODAS') {
            handleRetirarConfirm(item.articleCode, item.orderFab).then(() => {
              setCurrentBatchRetirarIndex((prev) => prev + 1);
              setRetirarPosition(null);
              setFoundLocationsForRetirar([]);
              setTimeout(() => handleRetirarBatchNext(), 500);
            });
          } else if (retirarPosition) {
            handleRetirarConfirm(item.articleCode, item.orderFab, retirarPosition).then(() => {
              setCurrentBatchRetirarIndex((prev) => prev + 1);
              setRetirarPosition(null);
              setFoundLocationsForRetirar([]);
              setTimeout(() => handleRetirarBatchNext(), 500);
            });
          }
        },
      });
    }
  }, [batchRetiraPending, currentBatchRetirarIndex, handleRetirarConfirm, showFeedback, retirarPosition, formatArticleDisplay]);

  const startAction = useCallback((nextAction: KioskAction) => {
    setAction(nextAction);
    setScanData(null);
    setSelectedCell(null);
    setSelectedPositions([]);
    setFeedback(null);
    if (nextAction === 'avisar') {
      setConfirmModal({
        open: true,
        title: 'Avisar al Carretillero',
        message: `Se avisara que hay una pieza para recoger en la seccion de ${shelfDef?.name || shelfCode}`,
        icon: '🚚',
        variant: 'warning',
        onConfirm: handleAvisarConfirm,
      });
      return;
    }
    if (nextAction === 'ubicar' || nextAction === 'retirar') {
      setConfirmModal({
        open: true,
        title: `¿${nextAction === 'ubicar' ? 'UBICAR' : 'RETIRAR'} varios artículos?`,
        message: `¿Vas a ${nextAction === 'ubicar' ? 'ubicar' : 'retirar'} varios artículos a la vez?`,
        icon: nextAction === 'ubicar' ? '📦' : '📤',
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
      return;
    }
    setScannerActive(true);
  }, [handleAvisarConfirm, shelfCode, shelfDef]);

  const handleScan = useCallback((result: ScanParseResult) => {
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
      showFeedback('success', `✅ ${articleCode} ${orderFab} añadido al batch`);
      setScannerActive(true);
      return;
    }

    if (action === 'retirar' && batchMode) {
      const foundLocations = findArticle(articleCode, orderFab);
      if (foundLocations.length === 0) {
        showFeedback('error', `Articulo ${articleCode} no encontrado en esta estanteria`);
        setScannerActive(true);
        return;
      }
      const duplicate = batchRetiraPending.some((a) => a.articleCode === articleCode && a.orderFab === orderFab);
      if (duplicate) {
        showFeedback('error', `Este artículo se ha escaneado dos veces. Solo se puede retirar una vez.`);
        setScannerActive(true);
        return;
      }
      setBatchRetiraPending((prev) => [...prev, { articleCode, orderFab, locations: foundLocations }]);
      showFeedback('success', `✅ ${articleCode} ${orderFab} añadido al batch`);
      setScannerActive(true);
      return;
    }

    setScanData({ articleCode, orderFab });
    setScannerActive(false);

    if (action === 'retirar') {
      const foundLocations = findArticle(articleCode, orderFab);
      if (foundLocations.length === 0) {
        showFeedback('error', `Articulo ${articleCode} no encontrado en esta estanteria`);
        return;
      }

      if (foundLocations.length === 1) {
        setConfirmModal({
          open: true,
          title: 'Confirmar Retirada',
          message: `¿Retirar ${formatArticleDisplay(articleCode, orderFab)} de posición ${parseInt(foundLocations[0].position, 10)}?`,
          icon: '📤',
          variant: 'danger',
          onConfirm: () => handleRetirarConfirm(articleCode, orderFab, foundLocations[0].position),
        });
      } else {
        setFoundLocationsForRetirar(foundLocations);
        setConfirmModal({
          open: true,
          title: 'Selecciona de dónde retirar',
          message: `${formatArticleDisplay(articleCode, orderFab)} está en ${foundLocations.length} ubicaciones`,
          icon: '📤',
          variant: 'warning',
          onConfirm: () => {
            if (retirarPosition === 'TODAS') {
              handleRetirarConfirm(articleCode, orderFab);
            } else if (retirarPosition) {
              handleRetirarConfirm(articleCode, orderFab, retirarPosition);
            }
            setRetirarPosition(null);
            setFoundLocationsForRetirar([]);
          },
        });
      }
      return;
    }

    if (action === 'mover') {
      const foundLocations = findArticle(articleCode, orderFab);
      if (foundLocations.length === 0) {
        showFeedback('error', `Articulo ${articleCode} no encontrado`);
        return;
      }
      setSelectedPositions([]);
    }
  }, [action, batchMode, batchArticles, batchRetiraPending, findArticle, handleRetirarConfirm, showFeedback]);

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
      setSelectedPositions((current) => {
        if (current.includes(position)) return current.filter((value) => value !== position);
        return [...current, position];
      });
      return;
    }

    if (action === 'ubicar' && !scanData && !batchMode) {
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

  if (!assignedShelf) return <KioskEmptyState />;

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-sky-50">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-400 font-medium">Cargando estanteria...</p>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-sky-50 flex flex-col relative overflow-hidden">
      <KioskHeader shelfName={shelfDef?.name || ''} shelfCode={shelfCode} totalOccupied={totalOccupied} totalEmpty={totalEmpty} totalArticles={totalArticles} displayName={displayName} operarioId={operarioId} deviceId={deviceId} onLogout={logout} onInfo={() => setShowDeviceInfo(true)} />
      {kiosk && shelves.length > 1 && (
        <div className="bg-sky-50 border-b border-slate-200 px-4 py-2 flex justify-center">
          <ShelfSelector shelves={shelves} currentShelf={currentShelf} onSelectShelf={setCurrentShelf} />
        </div>
      )}
      {!batchMode && <KioskActionBar action={action} scanData={scanData} scannerActive={scannerActive} selectedPositions={selectedPositions} onConfirmMove={handleMoverConfirm} onConfirmUbicar={handleUbicarMultiPositionConfirm} onCancel={cancelAction} />}

      {batchMode && (action === 'ubicar' || action === 'retirar') && (
        <div className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white text-sm">
                {action === 'ubicar' ? '📦 Batch de Ubicación' : '📤 Batch de Retirada'}
              </h3>
              <span className="bg-cyan-600 text-white px-2 py-1 rounded text-xs font-bold">
                {action === 'ubicar' ? batchArticles.length : batchRetiraPending.length} artículos
              </span>
            </div>
            {action === 'ubicar' && batchArticles.length > 0 && (
              <div className="text-xs text-slate-300 mb-2 max-h-12 overflow-y-auto bg-slate-900/30 p-2 rounded">
                {batchArticles.map((a, i) => (
                  <div key={i} className="text-slate-300">{a.articleCode} ({a.orderFab})</div>
                ))}
              </div>
            )}
            {action === 'retirar' && batchRetiraPending.length > 0 && (
              <div className="text-xs text-slate-300 mb-2 max-h-12 overflow-y-auto bg-slate-900/30 p-2 rounded">
                {batchRetiraPending.map((a, i) => (
                  <div key={i} className="text-slate-300">{a.articleCode} ({a.orderFab}) - {a.locations.length} ubicación(es)</div>
                ))}
              </div>
            )}
            {action === 'ubicar' && selectedPositions.length > 0 && (
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
                  if (action === 'ubicar') {
                    if (selectedPositions.length > 0) {
                      handleUbicarBatchConfirm();
                    } else {
                      showFeedback('error', 'Debes seleccionar al menos una posición');
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
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="grid grid-cols-2 gap-4 max-w-3xl w-full">
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
           <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(30,41,59,0.8)_transparent] p-2 md:p-3">
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
                 showFeedback('info', `El artículo ${result.articleCode} ${result.orderFab} está en la estantería ${result.shelfCode} (posición(es): ${result.positions.join(', ')})`);
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
          <KioskActionButtons action={action} onStartAction={startAction} />
        </>
      )}

      <ScannerInput onScan={handleScan} active={scannerActive} disabled={processing} />

      {foundLocationsForRetirar.length > 1 && confirmModal.open && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm max-h-[70vh] overflow-hidden flex flex-col shadow-xl">
            <div className="bg-sky-50 px-5 py-4 border-b border-slate-200">
              <h3 className="text-lg font-black text-white">Selecciona posición</h3>
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
                  📍 PLE {parseInt(loc.position, 10).toString().padStart(3, '0')}
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

      <ConfirmationModal open={confirmModal.open && foundLocationsForRetirar.length <= 1} onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))} title={confirmModal.title} message={confirmModal.message} icon={confirmModal.icon} variant={confirmModal.variant} onConfirm={confirmModal.onConfirm} extraButton={confirmModal.extraButton} loading={processing} />

      {showDeviceInfo && (
        <DeviceInfoModal
          deviceId={deviceId}
          onClose={() => setShowDeviceInfo(false)}
        />
      )}
    </div>
  );
};

export default KioskView;
