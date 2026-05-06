/**
 * AdminShelfBrowser — Visual operativa de estanterías para ADMIN/SUPERADMIN
 * Gestor de Estanterías WMS v3.0
 *
 * Permite ubicar, retirar y mover artículos manualmente mediante texto,
 * además de visualizar la saturación de todas las estanterías.
 */

import React, { useState, useCallback } from 'react';
import { useShelf } from '../../hooks/useShelf';
import { useAuth } from '../../hooks/useAuth';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskSearchBar from '../kiosk/KioskSearchBar';
import ConfirmationModal from '../common/ConfirmationModal';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';
import { formatArticleDisplay } from '../../lib/qrParser';
import type { ShelfLocationState } from '../../hooks/useShelf';

type AdminAction = 'idle' | 'ubicar' | 'retirar' | 'mover' | 'reubicar';

interface AdminShelfBrowserProps {
  onBack: () => void;
}

const AdminShelfBrowser: React.FC<AdminShelfBrowserProps> = ({ onBack }) => {
  const [selectedShelf, setSelectedShelf] = useState(SHELF_DEFINITIONS[0]?.code || 'MEC');
  const [highlightedPositions, setHighlightedPositions] = useState<string[]>([]);
  const [action, setAction] = useState<AdminAction>('idle');
  const [articleInput, setArticleInput] = useState('');
  const [ofInput, setOfInput] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; message: string; icon: string;
    variant: 'success' | 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    extraButton?: { text: string; onClick: () => void };
  }>({ open: false, title: '', message: '', icon: '', variant: 'info', onConfirm: () => {} });
  
  // Reubicar: arrastrar de una celda a otra (dentro de la misma estantería)
  const [reubicarSource, setReubicarSource] = useState<{ articleCode: string; orderFab: string; position: string } | null>(null);

  const { locations, loading, shelfDef, ubicar, retirar, mover, findArticle, totalOccupied, totalEmpty, totalArticles } = useShelf(selectedShelf);
  const { operarioId, displayName } = useAuth();

  const occupancyPct = totalOccupied + totalEmpty > 0
    ? Math.round((totalOccupied / (totalOccupied + totalEmpty)) * 100)
    : 0;

  const effectiveOperarioId = operarioId || '';

   const showFeedback = useCallback((type: 'success' | 'error' | 'info', msg: string) => {
     setFeedback({ type, msg });
     setTimeout(() => setFeedback(null), 3000);
   }, []);

  const resetAction = useCallback(() => {
    setAction('idle');
    setSelectedPositions([]);
    setReubicarSource(null);
  }, []);

  const startAction = useCallback((act: AdminAction) => {
    const article = articleInput.trim();
    const of = ofInput.trim();

    if (!article || !of) {
      showFeedback('error', 'Introduce código de artículo y OF antes de seleccionar la acción');
      return;
    }

    setAction(act);
    setSelectedPositions([]);
    setFeedback(null);

    if (act === 'retirar') {
      const found = findArticle(article, of);
      if (found.length === 0) {
        showFeedback('error', 'Artículo no encontrado en esta estantería');
        setAction('idle');
        return;
      }
      const posStr = found.map((l) => parseInt(l.position, 10)).join(', ');
      let msg = `${formatArticleDisplay(article, of)} en: ${posStr}`;
      if (found.length > 1) msg += `\n\n⚠️ Ocupa ${found.length} posiciones. Se retirará de todas.`;

      setConfirmModal({
        open: true,
        title: 'Confirmar Retirada',
        message: msg,
        icon: '📤',
        variant: 'danger',
        onConfirm: async () => {
          setProcessing(true);
          setConfirmModal((p) => ({ ...p, open: false }));
          const r = await retirar(article, of, effectiveOperarioId, displayName);
          setProcessing(false);
          if (r.success) showFeedback('success', '✅ Artículo retirado');
          else showFeedback('error', 'Error al retirar el artículo');
          resetAction();
        },
      });
    }
  }, [articleInput, ofInput, findArticle, retirar, effectiveOperarioId, displayName, showFeedback, resetAction]);

  // Función para reubicar: mover de origen a destino directamente
  const doReubicar = useCallback(async (source: { articleCode: string; orderFab: string; position: string }, newPosition: string) => {
    setProcessing(true);
    const ok = await mover(source.articleCode, source.orderFab, [newPosition], effectiveOperarioId, displayName);
    setProcessing(false);
    if (ok) {
      showFeedback('success', `✅ ${source.articleCode} movido de ${source.position} a ${newPosition}`);
      setReubicarSource(null);
      setAction('idle');
    } else {
      showFeedback('error', 'Error al reubicar el artículo');
    }
  }, [mover, effectiveOperarioId, displayName, showFeedback]);

  const handleCellPress = useCallback((loc: ShelfLocationState) => {
    const article = articleInput.trim();
    const of = ofInput.trim();

    if (action === 'ubicar') {
      if (loc.isEmpty) {
        // Immediate action without modal
        setProcessing(true);
        ubicar(article, of, loc.position, effectiveOperarioId, displayName).then(ok => {
          setProcessing(false);
          if (ok) showFeedback('success', '✅ Artículo ubicado');
          else showFeedback('error', 'Error al ubicar el artículo');
          resetAction();
        });
      } else {
        setConfirmModal({
          open: true,
          title: 'Celda Ocupada',
          message: `Esta celda ya tiene ${loc.items.length} artículo(s). ¿Añadir igualmente?`,
          icon: '⚠️',
          variant: 'warning',
          onConfirm: async () => {
            setProcessing(true);
            setConfirmModal((p) => ({ ...p, open: false }));
            const ok = await ubicar(article, of, loc.position, effectiveOperarioId, displayName);
            setProcessing(false);
            if (ok) showFeedback('success', '✅ Artículo ubicado');
            else showFeedback('error', 'Error al ubicar el artículo');
            resetAction();
          },
          extraButton: { text: 'Elegir otra celda', onClick: () => setConfirmModal((p) => ({ ...p, open: false })) },
        });
      }
    } else if (action === 'mover') {
      const found = findArticle(article, of);
      const needed = found.length || 1;
      setSelectedPositions((prev) => {
        if (prev.includes(loc.position)) return prev.filter((p) => p !== loc.position);
        if (prev.length >= needed) return [...prev.slice(1), loc.position];
        return [...prev, loc.position];
      });
    } else if (action === 'reubicar') {
      if (!reubicarSource) {
        if (loc.isEmpty) {
          showFeedback('error', 'Selecciona una celda con artículo');
          return;
        }
        const item = loc.items[0];
        setReubicarSource({
          articleCode: item.articleCode,
          orderFab: item.orderFab,
          position: loc.position,
        });
        showFeedback('info', `Origen: ${loc.position} (${item.articleCode}) - Elige destino`);
      } else {
        if (loc.position === reubicarSource.position) {
          showFeedback('info', 'Origen y destino iguales');
          return;
        }
        if (!loc.isEmpty) {
          setConfirmModal({
            open: true,
            title: 'Sobrescribir',
            message: `La celda ${loc.position} tiene ${loc.items.length} artículo(s). ¿Sobrescribir?`,
            icon: '⚠️',
            variant: 'warning',
            onConfirm: async () => {
              setConfirmModal((p) => ({ ...p, open: false }));
              await doReubicar(reubicarSource, loc.position);
            },
            extraButton: { text: 'Elegir otra', onClick: () => setConfirmModal((p) => ({ ...p, open: false })) },
          });
          return;
        }
        doReubicar(reubicarSource, loc.position);
      }
    }
  }, [action, articleInput, ofInput, ubicar, findArticle, effectiveOperarioId, displayName, showFeedback, resetAction, reubicarSource, doReubicar]);

  const handleMoverConfirm = useCallback(async () => {
    if (selectedPositions.length === 0) return;
    const article = articleInput.trim();
    const of = ofInput.trim();
    setProcessing(true);
    const ok = await mover(article, of, selectedPositions, effectiveOperarioId, displayName);
    setProcessing(false);
    if (ok) showFeedback('success', '✅ Artículo movido');
    else showFeedback('error', 'Error al mover el artículo');
    resetAction();
  }, [selectedPositions, articleInput, ofInput, mover, effectiveOperarioId, displayName, showFeedback, resetAction]);

  const foundPositions = (action !== 'idle' && articleInput.trim() && ofInput.trim())
    ? findArticle(articleInput.trim(), ofInput.trim()).map((l) => l.position)
    : [];

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700"
            >
              ←
            </button>
            <div>
              <h1 className="text-lg font-black text-white">🏭 Estanterías</h1>
              <p className="text-xs text-slate-400">
                {action === 'idle' ? 'Operativa manual' : `Acción activa: ${action.toUpperCase()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg font-bold">
              {totalOccupied} ocupadas
            </span>
            <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded-lg font-bold">
              {totalEmpty} vacías
            </span>
            <span className="bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded-lg font-bold">
              {totalArticles} artículos
            </span>
          </div>
        </div>
      </header>

       {/* Shelf tabs */}
       <div className="flex-shrink-0 overflow-x-auto bg-slate-950/80 border-b border-slate-700/50 backdrop-blur-sm px-2">
          <div className="flex gap-1">
            {SHELF_DEFINITIONS.map((shelf) => (
              <button
                key={shelf.code}
                onClick={() => {
                  setSelectedShelf(shelf.code);
                  setHighlightedPositions([]);
                  resetAction();
                }}
                className={`px-3 py-2 text-sm font-semibold transition-colors relative
                  ${selectedShelf === shelf.code
                    ? 'bg-cyan-500/80 text-slate-100'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}
                  ${selectedShelf === shelf.code ? ' absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500/80' : ''}
                `}>
                {shelf.name}
              </button>
            ))}
          </div>
        </div>

       {/* Manual operations panel */}
      <div className="px-4 pt-3 pb-2">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3 space-y-2.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Operativa manual — {displayName}
          </p>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={articleInput}
              onChange={(e) => setArticleInput(e.target.value)}
              placeholder="Código artículo"
              disabled={action !== 'idle'}
              className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={ofInput}
              onChange={(e) => setOfInput(e.target.value)}
              placeholder="OF"
              disabled={action !== 'idle'}
              className="w-28 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {action === 'idle' ? (
            <div className="flex gap-2">
              <button
                onClick={() => startAction('ubicar')}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm active:scale-95 transition-all"
              >
                📦 UBICAR
              </button>
              <button
                onClick={() => startAction('retirar')}
                className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm active:scale-95 transition-all"
              >
                📤 RETIRAR
              </button>
              <button
                onClick={() => startAction('reubicar')}
                className="flex-1 h-10 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm active:scale-95 transition-all"
              >
                🔁 REUBICAR
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg
                  ${action === 'ubicar' ? 'bg-emerald-500/20 text-emerald-300' :
                    action === 'retirar' ? 'bg-red-500/20 text-red-300' :
                    action === 'reubicar' ? 'bg-amber-500/20 text-amber-300' :
                    'bg-blue-500/20 text-blue-300'}`}>
                  {action.toUpperCase()} activo
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {articleInput} · {ofInput}
                </span>
                {action === 'ubicar' && (
                  <span className="text-xs text-slate-500">Pulsa una celda del grid para ubicar</span>
                )}
                {action === 'reubicar' && reubicarSource && (
                  <span className="text-xs text-amber-400">Origen: {reubicarSource.position} → Elige destino</span>
                )}
                {action === 'mover' && selectedPositions.length === 0 && (
                  <span className="text-xs text-slate-500">Pulsa la celda destino</span>
                )}
                {action === 'mover' && selectedPositions.length > 0 && (
                  <button
                    onClick={handleMoverConfirm}
                    disabled={processing}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                  >
                    Confirmar mover a {selectedPositions.map((p) => parseInt(p, 10)).join(', ')}
                  </button>
                )}
              </div>
              <button
                onClick={resetAction}
                className="text-xs text-slate-400 hover:text-white shrink-0"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feedback */}
       {feedback && (
         <div className={`mx-4 mb-1 p-3 rounded-xl text-center font-bold text-sm
           ${feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
             feedback.type === 'error' ? 'bg-red-500/20 text-red-400' :
             'bg-blue-500/20 text-blue-400'}`}>
           {feedback.msg}
         </div>
       )}

       {/* Search bar */}
       <KioskSearchBar 
         locations={locations} 
         onHighlight={setHighlightedPositions} 
         global={true}
         currentShelfCode={selectedShelf}
         canNavigateToShelf={true}
         onShelfNavigate={setSelectedShelf}
         onOutOfShelfResult={(result) => {
           // Mostrar aviso de que el resultado está en otra estantería
           showFeedback('info', `El artículo ${result.articleCode} ${result.orderFab} está en la estantería ${result.shelfCode} (posición(es): ${result.positions.join(', ')})`);
         }}
       />

      {/* Occupancy bar */}
      <div className="px-4 py-1">
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-500"
            style={{ width: `${occupancyPct}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5 text-right">{occupancyPct}% ocupado</p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4 pt-0">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ShelfGrid
            locations={locations}
            shelfDef={shelfDef}
            onCellPress={action !== 'idle' ? handleCellPress : undefined}
            selectedPositions={selectedPositions}
            highlightedPositions={[...highlightedPositions, ...foundPositions]}
            compact={false}
            fullscreenMode={true}
          />
        )}
      </div>

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
    </div>
  );
};

export default AdminShelfBrowser;
