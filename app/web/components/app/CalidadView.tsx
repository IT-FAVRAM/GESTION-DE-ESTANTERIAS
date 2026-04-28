import React, { useState, useCallback } from 'react';
import { useShelf } from '../../hooks/useShelf';
import { useAuth } from '../../hooks/useAuth';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskSearchBar from '../kiosk/KioskSearchBar';
import ScannerInput from '../kiosk/ScannerInput';
import ConfirmationModal from '../common/ConfirmationModal';
import ReprocesosEditor from '../kiosk/ReprocesosEditor';
import { isReprocesosLocation } from '../../lib/firestoreSchema';
import { calcReprocesosTotal, formatEuros } from '../../lib/reprocesosApi';
import { formatArticleDisplay, type ScanParseResult } from '../../lib/qrParser';
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

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; message: string; icon: string;
    variant: 'success' | 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    extraButton?: { text: string; onClick: () => void };
  }>({ open: false, title: '', message: '', icon: '', variant: 'info', onConfirm: () => {} });

  const { locations, loading, shelfDef, ubicar, retirar, mover, findArticle } = useShelf(SHELF);
  const { operarioId, displayName, logout, canViewReprocessCosts } = useAuth();
  const { createPickupRequest } = usePickupQueue();

  const reprocesosItems = locations
    .filter((l) => isReprocesosLocation(SHELF, parseInt(l.position, 10)))
    .flatMap((l) => l.items || []);
  const { totalImporte, totalPiezas } = calcReprocesosTotal(reprocesosItems);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => { setFeedback(null); resetAction(); }, 3000);
  };

  const resetAction = () => {
    setAction('idle');
    setScanData(null);
    setSelectedPositions([]);
    setScannerActive(false);
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
          const ok = await createPickupRequest(operarioId || '', displayName, SHELF);
          setProcessing(false);
          showFeedback(ok ? 'success' : 'error', ok ? '✅ Aviso enviado' : 'Error al enviar');
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
          const r = await retirar(articleCode, orderFab, operarioId || '', displayName);
          setProcessing(false);
          showFeedback(r.success ? 'success' : 'error', r.success ? '✅ Retirado' : 'Error');
        },
      });
    }
  };

  const handleCellPress = useCallback((loc: ShelfLocationState) => {
    if (action === 'idle' && isReprocesosLocation(SHELF, parseInt(loc.position, 10)) && !loc.isEmpty) {
      setReprocesosCell(loc);
      return;
    }

    if (action === 'ubicar' && scanData) {
      setConfirmModal({
        open: true,
        title: loc.isEmpty ? 'Confirmar Ubicación' : 'Celda Ocupada',
        message: loc.isEmpty
          ? `¿Ubicar ${scanData.articleCode} en posición ${parseInt(loc.position, 10)}?`
          : `Esta celda tiene ${loc.items.length} artículo(s). ¿Añadir igualmente?`,
        icon: loc.isEmpty ? '📦' : '⚠️',
        variant: loc.isEmpty ? 'success' : 'warning',
        onConfirm: async () => {
          setProcessing(true);
          setConfirmModal((p) => ({ ...p, open: false }));
          const ok = await ubicar(scanData.articleCode, scanData.orderFab, loc.position, operarioId || '', displayName);
          setProcessing(false);
          showFeedback(ok ? 'success' : 'error', ok ? '✅ Ubicado' : 'Error');
        },
        extraButton: !loc.isEmpty
          ? { text: 'Elegir otra', onClick: () => setConfirmModal((p) => ({ ...p, open: false })) }
          : undefined,
      });
    } else if (action === 'mover' && scanData) {
      const found = findArticle(scanData.articleCode, scanData.orderFab);
      const needed = found.length || 1;
      setSelectedPositions((prev) => {
        if (prev.includes(loc.position)) return prev.filter((p) => p !== loc.position);
        if (prev.length >= needed) return [...prev.slice(1), loc.position];
        return [...prev, loc.position];
      });
    }
  }, [action, scanData, ubicar, findArticle, operarioId, displayName]);

  const handleMoverConfirm = async () => {
    if (!scanData || selectedPositions.length === 0) return;
    setProcessing(true);
    const ok = await mover(scanData.articleCode, scanData.orderFab, selectedPositions, operarioId || '', displayName);
    setProcessing(false);
    showFeedback(ok ? 'success' : 'error', ok ? '✅ Movido' : 'Error');
  };

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔍</span>
            <div>
              <h1 className="text-lg font-black text-white">Calidad — CAL</h1>
              <p className="text-xs text-slate-400">{displayName}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 text-sm"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Reprocesos total banner — solo visible con CALIDAD email */}
      {canViewReprocessCosts && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-300/60 font-bold uppercase">Total Reprocesos</p>
            <p className="text-xs text-slate-400">{totalPiezas} piezas en CAL 001-022</p>
          </div>
          <p className="text-xl font-black text-amber-300">{formatEuros(totalImporte)}</p>
        </div>
      )}

      {/* Search bar */}
      <KioskSearchBar locations={locations} onHighlight={setHighlightedPositions} />

      {/* Action status */}
      {action !== 'idle' && (
        <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {scannerActive && (
              <span className="text-xs text-cyan-400 animate-pulse font-bold">📡 Esperando escáner...</span>
            )}
            {scanData && (
              <span className="text-xs text-white font-bold">{scanData.articleCode} ({scanData.orderFab})</span>
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

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
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
        <div className="flex-shrink-0 bg-slate-900 border-t border-slate-800 p-3">
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

      <ScannerInput onScan={handleScan} active={scannerActive} disabled={processing} />

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
        />
      )}
    </div>
  );
};

export default CalidadView;
