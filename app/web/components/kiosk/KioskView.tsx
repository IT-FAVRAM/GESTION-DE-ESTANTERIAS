import React, { useCallback, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useShelf, type ShelfLocationState } from '../../hooks/useShelf';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import ShelfGrid from './ShelfGrid';
import ScannerInput from './ScannerInput';
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
  const { assignedShelf, operarioId, displayName, logout } = useAuth();
  const shelfCode = assignedShelf || '';
  const { locations, loading, shelfDef, ubicar, retirar, mover, findArticle, totalArticles, totalOccupied, totalEmpty } = useShelf(shelfCode);
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
  const [confirmModal, setConfirmModal] = useState<KioskConfirmModalState>({ open: false, title: '', message: '', icon: '', variant: 'info', onConfirm: () => {} });

  const cancelAction = useCallback(() => {
    setAction('idle');
    setScanData(null);
    setSelectedCell(null);
    setSelectedPositions([]);
    setScannerActive(false);
    setConfirmModal((prev) => ({ ...prev, open: false }));
    setShowShelf(false);
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

  const handleRetirarConfirm = useCallback(async (articleCode: string, orderFab: string) => {
    if (!operarioId) return;
    setProcessing(true);
    setConfirmModal((prev) => ({ ...prev, open: false }));
    const result = await retirar(articleCode, orderFab, operarioId, displayName);
    setProcessing(false);
    if (result.success) showFeedback('success', `✅ ${articleCode} retirado de ${result.positions.length} ubicacion(es)`);
    else showFeedback('error', 'Error al retirar el articulo');
  }, [displayName, operarioId, retirar, showFeedback]);

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
    setScannerActive(true);
  }, [handleAvisarConfirm, shelfCode, shelfDef]);

  const handleScan = useCallback((result: ScanParseResult) => {
    if (!result.success) {
      showFeedback('error', 'error' in result ? result.error : 'Error de escaneo');
      return;
    }

    const { articleCode, orderFab } = result.data;
    setScanData({ articleCode, orderFab });
    setScannerActive(false);

    if (action === 'retirar') {
      const foundLocations = findArticle(articleCode, orderFab);
      if (foundLocations.length === 0) {
        showFeedback('error', `Articulo ${articleCode} no encontrado en esta estanteria`);
        return;
      }

      const positionsText = foundLocations.map((location) => location.position).join(', ');
      setConfirmModal({
        open: true,
        title: 'Confirmar Retirada',
        message: `El articulo ${formatArticleDisplay(articleCode, orderFab)} esta en: ${positionsText}.\n\nSe retirara de ${foundLocations.length > 1 ? 'TODAS las ubicaciones' : 'esta ubicacion'}.`,
        icon: '📤',
        variant: 'danger',
        onConfirm: () => handleRetirarConfirm(articleCode, orderFab),
      });
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
  }, [action, findArticle, handleRetirarConfirm, showFeedback]);

  const handleCellPress = useCallback((location: ShelfLocationState) => {
    if (action === 'ubicar' && scanData) {
      setConfirmModal({
        open: true,
        title: location.isEmpty ? 'Confirmar Ubicación' : 'Celda Ocupada',
        message: location.isEmpty 
          ? `¿Desea ubicar el artículo ${scanData.articleCode} en la posición ${location.position}?`
          : `Esta celda tiene ${location.items.length} articulo(s). ¿Desea añadir el articulo igualmente?`,
        icon: location.isEmpty ? '📦' : '⚠️',
        variant: location.isEmpty ? 'info' : 'warning',
        onConfirm: () => handleUbicarConfirm(location.position),
        extraButton: !location.isEmpty ? { text: 'Elegir otra ubicacion', onClick: () => setConfirmModal((prev) => ({ ...prev, open: false })) } : undefined,
      });
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
  }, [action, findArticle, handleUbicarConfirm, scanData]);

  if (!assignedShelf) return <KioskEmptyState />;

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-slate-950">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-400 font-medium">Cargando estanteria...</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.14),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] flex flex-col relative">
      <KioskHeader shelfName={shelfDef?.name || ''} shelfCode={shelfCode} totalOccupied={totalOccupied} totalEmpty={totalEmpty} totalArticles={totalArticles} displayName={displayName} operarioId={operarioId} onLogout={logout} />
      <KioskActionBar action={action} scanData={scanData} scannerActive={scannerActive} selectedPositions={selectedPositions} onConfirmMove={handleMoverConfirm} onCancel={cancelAction} />
      <KioskFeedbackToast feedback={feedback} />

      {(!showShelf && action === 'idle') ? (
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="grid grid-cols-2 gap-4 max-w-3xl w-full">
            <button onClick={() => startAction('ubicar')} className="h-32 rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 active:scale-95 text-white font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-emerald-950/40 transition-all"><span className="text-4xl">📦</span>UBICAR</button>
            <button onClick={() => startAction('retirar')} className="h-32 rounded-3xl border border-red-400/20 bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 active:scale-95 text-white font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-red-950/40 transition-all"><span className="text-4xl">📤</span>RETIRAR</button>
            <button onClick={() => startAction('mover')} className="h-32 rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 active:scale-95 text-white font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-blue-950/40 transition-all"><span className="text-4xl">🔄</span>MOVER</button>
            <button onClick={() => startAction('avisar')} className="h-32 rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 active:scale-95 text-white font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-amber-950/40 transition-all"><span className="text-4xl">🚚</span>CARRETILLERO</button>
          </div>
          <button onClick={() => setShowShelf(true)} className="mt-8 px-6 py-3 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold hover:bg-slate-700 transition-colors">
            Mostrar estantería
          </button>
        </main>
      ) : (
         <>
           <main className="flex-1 min-h-0 overflow-hidden p-2 md:p-3">
             {action === 'idle' && (
                <div className="flex justify-end mb-2">
                  <button onClick={() => setShowShelf(false)} className="px-3 py-1.5 rounded-full bg-slate-800 text-slate-400 font-bold hover:bg-slate-700 text-xs transition-colors">
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
      <ConfirmationModal open={confirmModal.open} onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))} title={confirmModal.title} message={confirmModal.message} icon={confirmModal.icon} variant={confirmModal.variant} onConfirm={confirmModal.onConfirm} extraButton={confirmModal.extraButton} loading={processing} />
    </div>
  );
};

export default KioskView;
