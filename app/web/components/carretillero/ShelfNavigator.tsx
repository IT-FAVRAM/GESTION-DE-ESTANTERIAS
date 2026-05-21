/**
 * ShelfNavigator — Navegador de estanterías para el carretillero
 * Gestor de Estanterías WMS v3.0
 * 
 * Lista horizontal scrollable de todas las estanterías.
 * Al seleccionar una, muestra su grid.
 */

import React, { useState, useCallback } from 'react';
import { useShelf } from '../../hooks/useShelf';
import { useAuth } from '../../hooks/useAuth';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskSearchBar from '../kiosk/KioskSearchBar';
import ScannerInput from '../kiosk/ScannerInput';
import ConfirmationModal from '../common/ConfirmationModal';
import { ALL_SHELVES, SHELF_DEFINITIONS } from '../../lib/firestoreSchema';
import { formatArticleDisplay, type ScanParseResult } from '../../lib/qrParser';
import type { ShelfLocationState } from '../../hooks/useShelf';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import ShelfNavigatorTabs from './ShelfNavigatorTabs';
import ShelfNavigatorStatus from './ShelfNavigatorStatus';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';

type NavAction = 'idle' | 'ubicar' | 'retirar' | 'mover' | 'avisar' | 'almacen';

const ShelfNavigator: React.FC = () => {
  const [selectedShelf, setSelectedShelf] = useState(SHELF_DEFINITIONS[0]?.code || 'MEC');
  const [highlightedSearch, setHighlightedSearch] = useState<string[]>([]);
  const { locations, loading, shelfDef, ubicar, retirar, mover, findArticle, totalOccupied, totalEmpty, totalArticles } = useShelf(selectedShelf);
  const { operarioId, displayName } = useAuth();
  const { createPickupRequest } = usePickupQueue();

  const [action, setAction] = useState<NavAction>('idle');
  const [scannerActive, setScannerActive] = useState(false);
  const [scanData, setScanData] = useState<{ articleCode: string; orderFab: string } | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
   const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; message: string; icon: string;
    variant: 'success' | 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    extraButton?: { text: string; onClick: () => void };
  }>({ open: false, title: '', message: '', icon: '', variant: 'info', onConfirm: () => {} });

   const showFeedback = (type: 'success' | 'error' | 'info', msg: string) => {
     setFeedback({ type, msg });
     setTimeout(() => { setFeedback(null); setAction('idle'); setScanData(null); setSelectedPositions([]); setScannerActive(false); }, 3000);
   };

  const startAction = (act: NavAction) => {
    setAction(act);
    setScanData(null);
    setSelectedPositions([]);
    setFeedback(null);
    if (act === 'avisar') {
      setConfirmModal({
        open: true, title: 'Avisar al Carretillero',
        message: `Se avisará que hay una pieza para recoger en ${shelfDef?.name || selectedShelf}`,
        icon: '🚚', variant: 'warning',
        onConfirm: async () => {
          setProcessing(true);
          setConfirmModal(prev => ({ ...prev, open: false }));
          const ok = await createPickupRequest(operarioId || '', displayName, selectedShelf);
          setProcessing(false);
          showFeedback(ok ? 'success' : 'error', ok ? '✅ Aviso enviado' : 'Error al enviar');
        },
      });
    } else {
      setScannerActive(true);
    }
  };

  const handleScan = (result: ScanParseResult) => {
    if (!result.success) { showFeedback('error', 'error' in result ? result.error : 'Error de escaneo'); return; }
    const { articleCode, orderFab } = result.data;
    setScanData({ articleCode, orderFab });
    setScannerActive(false);

    if (action === 'retirar') {
      const found = findArticle(articleCode, orderFab);
      if (found.length === 0) { showFeedback('error', 'Artículo no encontrado'); return; }

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
          const r = await retirar(articleCode, orderFab, operarioId || '', displayName);
          setProcessing(false);
          showFeedback(r.success ? 'success' : 'error', r.success ? '✅ Retirado' : 'Error');
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
              session: { operarioId: operarioId || '', operarioName: displayName },
            });
            const data = result.data as any;
            showFeedback('success', `✅ Enviado a almacén. Retirado de ${data.removedFrom || 0} ubicaciones.`);
          } catch (err: any) {
            showFeedback('error', err?.message || 'Error al enviar a almacén');
          }
          setProcessing(false);
        },
      });
    }
  };

  const handleCellPress = (loc: ShelfLocationState) => {
    if (action === 'ubicar' && scanData) {
      setConfirmModal({
        open: true, title: loc.isEmpty ? 'Confirmar Ubicación' : 'Celda Ocupada',
        message: loc.isEmpty 
          ? `¿Ubicar ${scanData.articleCode} en posición ${parseInt(loc.position, 10)}?`
          : `Esta celda tiene ${loc.items.length} artículo(s). ¿Añadir igualmente?`,
        icon: loc.isEmpty ? '📦' : '⚠️', variant: loc.isEmpty ? 'success' : 'warning',
        onConfirm: async () => {
          setProcessing(true); setConfirmModal(p => ({ ...p, open: false }));
          const ok = await ubicar(scanData.articleCode, scanData.orderFab, loc.position, operarioId || '', displayName);
          setProcessing(false);
          showFeedback(ok ? 'success' : 'error', ok ? '✅ Ubicado' : 'Error');
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

  const handleMoverConfirm = async () => {
    if (!scanData || selectedPositions.length === 0) return;
    setProcessing(true);
    const ok = await mover(scanData.articleCode, scanData.orderFab, selectedPositions, operarioId || '', displayName);
    setProcessing(false);
    showFeedback(ok ? 'success' : 'error', ok ? '✅ Movido' : 'Error');
  };

  return (
    <div className="flex flex-col h-full">
      <ShelfNavigatorTabs selectedShelf={selectedShelf} onSelectShelf={(shelfCode) => { setSelectedShelf(shelfCode); setAction('idle'); setScanData(null); setHighlightedSearch([]); }} />
      <ShelfNavigatorStatus totalEmpty={totalEmpty} totalOccupied={totalOccupied} totalArticles={totalArticles} actionActive={action !== 'idle'} canConfirmMove={action === 'mover' && !!scanData && selectedPositions.length > 0} scannerActive={scannerActive} scanArticle={scanData && action === 'ubicar' ? scanData.articleCode : undefined} onConfirmMove={handleMoverConfirm} onCancel={() => { setAction('idle'); setScanData(null); setSelectedPositions([]); setScannerActive(false); }} />

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
           showFeedback('info', `El artículo ${result.articleCode} ${result.orderFab} está en la estantería ${result.shelfCode} (posición(es): ${result.positions.join(', ')})`);
         }}
       />

      {/* Feedback */}
      {feedback && (
        <div className={`mx-4 mt-2 p-3 rounded-xl text-center font-bold text-sm
          ${feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Grid — permite scroll en ambas direcciones en móvil */}
      <div className="flex-1 overflow-auto p-4 [scrollbar-width:thin] [scrollbar-color:rgba(30,41,59,0.8)_transparent]">
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
        <div className="flex-shrink-0 bg-slate-900 border-t border-slate-800 p-3">
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

      <ScannerInput onScan={handleScan} active={scannerActive} disabled={processing} />
      <ConfirmationModal
        open={confirmModal.open}
        onClose={() => setConfirmModal(p => ({ ...p, open: false }))}
        title={confirmModal.title} message={confirmModal.message}
        icon={confirmModal.icon} variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm} extraButton={confirmModal.extraButton}
        loading={processing}
      />
    </div>
  );
};

export default ShelfNavigator;
