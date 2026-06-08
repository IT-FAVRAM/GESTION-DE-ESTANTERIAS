/**
 * OperativeShelfArea — Cuerpo presentacional del motor operativo único.
 *
 * Renderiza, debajo del header de cada rol: barra de estado de acción, barra de
 * lote, buscador, grid y TODOS los modales del flujo. Consume el `engine`
 * (useOperativeShelf) que le pasa la vista del rol.
 *
 * Todo el comportamiento vive en el hook; aquí solo hay JSX. Así KIOSKO,
 * CARRETILLERO, JEFE_SECCIÓN, CALIDAD y ADMIN comparten exactamente la misma UI
 * de flujo y es imposible que diverjan.
 */

import React, { useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS } from '../../lib/schema/collections';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskSearchBar from '../kiosk/KioskSearchBar';
import ScannerInput from '../kiosk/ScannerInput';
import ScanMethodPicker from '../common/ScanMethodPicker';
import ConfirmationModal from '../common/ConfirmationModal';
import CameraQRScanner from '../common/CameraQRScanner';
import CameraOCRScanner from '../common/CameraOCRScanner';
import RetirarArticleList from '../kiosk/RetirarArticleList';
import RetirarCellModal from '../kiosk/RetirarCellModal';
import MoverArticleList from '../kiosk/MoverArticleList';
import ReprocesosUbicacionModal from '../kiosk/ReprocesosUbicacionModal';
import ReprocesosEditor from '../kiosk/ReprocesosEditor';
import RecogidaModal from '../kiosk/RecogidaModal';
import TraerArticuloModal from '../kiosk/TraerArticuloModal';
import AddShelfPositionModal from './AddShelfPositionModal';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';
import { parseScanInput, parseScanInputLenient } from '../../lib/qrParser';
import { validateContiguity } from '../../lib/contiguityValidator';
import type { RoleOperativeConfig } from '../../lib/operative/operativeConfig';
import type { UseOperativeShelfReturn } from '../../hooks/useOperativeShelf';

interface OperativeShelfAreaProps {
  engine: UseOperativeShelfReturn;
  config: RoleOperativeConfig;
  /** El chrome puede cambiar de sección (scope='all'). */
  setShelfCode?: (code: string) => void;
  /** Grid a pantalla completa (kiosko / carretillero). */
  fullscreenGrid?: boolean;
  /** Kiosk mode: always show one block at a time with navigation. */
  forceSingleBlock?: boolean;
}

const padPos = (p: string) => parseInt(p, 10);

const OperativeShelfArea: React.FC<OperativeShelfAreaProps> = ({ engine, config, setShelfCode, fullscreenGrid = true, forceSingleBlock = false }) => {
  const {
    action, scanData, selectedPositions, scannerActive, processing, feedback,
    shelfCode, shelfDef, locations, loading,
    selectedCell, setSelectedCell,
    confirmModal, setConfirmModal,
    scanMethodPickerOpen, pendingAction,
    showCameraQR, setShowCameraQR, showCameraOCR, setShowCameraOCR,
    batchMode, batchArticles, batchProcessedCount,
    additionalShelfPositions, showAddShelfModal, setShowAddShelfModal,
    showRetirarArticleList, showRetirarCellModal, retirarCellPosition, retirarCellItems,
    showMoverArticleList,
    showReprocesosUbicacionModal, reprocesosCell, setReprocesosCell,
    showOFQuestion, handleOFAnswer, handleOFCancel,
    sectionPicker, reubicarCtx, reubicarNeeded,
    showRecogidaModal, setShowRecogidaModal, showTraerModal, setShowTraerModal,
    moverNeeded, highlightedPositions,
    setScannerActive, setHighlightedSearch,
    cancelAction, applyScanMethod, beginBatchMode, showToast,
    prepareChangeMethod, scanMore, handleScanMethodPickerClose,
    handleStopBatch,
    handleScan, handleCellPress,
    handleUbicarConfirm, handleUbicarBatchConfirm, handleUbicarBatchStart,
    handleReprocesosUbicacionConfirm, handleReprocesosUbicacionSkip,
    handleRetirarArticleListConfirm, handleRetirarCellItemsConfirm,
    handleMoverSelectArticle, handleMoverConfirm, handleReubicarConfirm,
    handleSectionPicked, handleRecogidaConfirm, handleTraerConfirm,
    addAdditionalShelf,
    setShowRetirarArticleList, setShowMoverArticleList, setSectionPicker, setScanMethodPickerOpen,
  } = engine;

  const reprocesosCosts = !!config.reprocesos?.showCosts;
  const canMultiSection = config.ubicar.allowMultiSection;

  const handleSaveNota = useCallback(async (nota: string, locationId: string) => {
    const ref = doc(db, COLLECTIONS.SHELVES, shelfCode, COLLECTIONS.LOCATIONS, locationId);
    await updateDoc(ref, { nota });
  }, [shelfCode]);

  const actionLabel =
    pendingAction === 'ubicar' ? 'Ubicar artículo' :
    pendingAction === 'retirar' ? 'Retirar artículo' :
    pendingAction === 'mover' ? 'Mover artículo' :
    pendingAction === 'almacen' ? 'Enviar a almacén' :
    pendingAction === 'reubicar' ? 'Reubicar artículo' : 'Escanear';

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      {/* ── Barra de estado de acción ── */}
      {action !== 'idle' && !batchMode && (
        <div className="flex-shrink-0 px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {scannerActive && !scanData && (
              <span className="text-xs text-sky-600 animate-pulse font-bold">📡 Esperando escáner…</span>
            )}
            {scanData && (
              <span className="text-xs text-slate-800 font-bold truncate">{scanData.articleCode} · {scanData.orderFab}</span>
            )}
            {action === 'retirar' && (
              <span className="text-xs text-red-600 font-bold">👇 Toca una celda ocupada para retirar</span>
            )}
            {action === 'ubicar' && scanData && (
              <span className="text-xs text-emerald-700 font-bold">
                {selectedPositions.length === 0
                  ? '👇 Toca las celdas donde ubicar'
                  : (() => {
                      const validation = validateContiguity(selectedPositions, shelfDef);
                      return validation.isContiguous 
                        ? `${shelfCode}: pos. ${selectedPositions.map(padPos).join(', ')}`
                        : `❌ ${validation.message}`;
                    })()
                }
                {additionalShelfPositions.map((e) => (
                  <span key={e.shelfCode} className="ml-1 text-blue-600">· {e.shelfName}: pos. {e.positions.map(padPos).join(', ')}</span>
                ))}
              </span>
            )}
            {action === 'ubicar' && scanData && selectedPositions.length > 0 && canMultiSection && (
              <button
                onClick={() => setShowAddShelfModal(true)}
                disabled={processing}
                className="px-3 py-2 bg-blue-100 hover:bg-blue-200 active:scale-95 text-blue-700 text-xs font-bold rounded-xl disabled:opacity-50 transition-all touch-manipulation"
              >
                ➕ Otra sección
              </button>
            )}
            {action === 'ubicar' && scanData && selectedPositions.length > 0 && (
              <button
                onClick={() => handleUbicarConfirm()}
                disabled={processing}
                className="px-4 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-all touch-manipulation"
              >
                {processing ? '⏳' : '✓'} Ubicar
              </button>
            )}
            {action === 'mover' && scanData && (
              <span className="text-xs font-bold px-3 py-2 rounded-xl bg-blue-100 text-blue-700 border border-blue-200">
                {selectedPositions.length}/{moverNeeded} destinos
              </span>
            )}
            {action === 'mover' && scanData && selectedPositions.length === moverNeeded && (
              <button
                onClick={handleMoverConfirm}
                disabled={processing}
                className="px-4 py-2 min-h-[40px] bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-all touch-manipulation"
              >
                {processing ? '⏳' : '🔄'} Confirmar mover
              </button>
            )}
            {action === 'reubicar' && scanData && reubicarCtx && (
              <span className="text-xs font-bold px-3 py-2 rounded-xl bg-indigo-100 text-indigo-700 border border-indigo-200">
                {scanData.articleCode} → {shelfDef?.name || shelfCode}: {selectedPositions.length}/{reubicarNeeded} destinos
              </span>
            )}
            {action === 'reubicar' && scanData && reubicarCtx && selectedPositions.length === reubicarNeeded && (
              <button
                onClick={handleReubicarConfirm}
                disabled={processing}
                className="px-4 py-2 min-h-[40px] bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-all touch-manipulation"
              >
                {processing ? '⏳' : '🔀'} Confirmar reubicar
              </button>
            )}
          </div>
          <button onClick={cancelAction} className="text-xs text-slate-400 hover:text-red-500 font-bold flex-shrink-0">Cancelar</button>
        </div>
      )}

      {/* ── Barra de lote (ubicar varios artículos) ── */}
      {batchMode && action === 'ubicar' && (
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-900">📦 Lote</span>
              <span className="bg-cyan-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">{batchArticles.length} art.</span>
              {selectedPositions.length > 0 && (() => {
                const validation = validateContiguity(selectedPositions, shelfDef);
                return (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                    validation.isContiguous 
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                      : 'bg-red-100 text-red-700 border-red-200'
                  }`}>
                    {selectedPositions.length} pos. {validation.isContiguous ? '✓' : '✗'}
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={prepareChangeMethod}
                className="text-xs text-sky-600 hover:text-sky-800 font-bold transition-colors"
              >
                🔄 Cambiar método
              </button>
              <button onClick={handleStopBatch} className="text-xs text-slate-400 hover:text-red-500 transition-colors">✕ Cancelar</button>
            </div>
          </div>
          {batchArticles.length > 0 && (
            <div className="max-h-20 overflow-y-auto bg-slate-50 rounded-lg p-2 mb-2">
              {batchArticles.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-slate-700 font-mono truncate">
                    <span className="text-cyan-600 font-bold">{i + 1}.</span> {a.articleCode}
                  </span>
                  <span className="text-slate-500 font-mono text-[10px]">{a.orderFab}</span>
                </div>
              ))}
            </div>
          )}
          {selectedPositions.length === 0 && batchArticles.length > 0 && (
            <p className="text-xs text-slate-500 mb-2">👇 Toca celda(s) en el grid para seleccionar ubicación</p>
          )}
          {batchProcessedCount > 1 && (
            <button
              onClick={handleStopBatch}
              className="w-full min-h-[40px] mb-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold active:scale-95 transition-all touch-manipulation"
            >
              ⏹ Detener análisis (ubicar {batchProcessedCount} ya procesados)
            </button>
          )}
          <div className="flex gap-2">
            <button
              onClick={scanMore}
              className="flex-1 min-h-[40px] rounded-xl bg-slate-100 text-slate-700 text-xs font-bold active:scale-95 transition-all touch-manipulation"
            >
              + Escanear más
            </button>
            <button
              onClick={handleUbicarBatchStart}
              disabled={selectedPositions.length === 0 || batchArticles.length === 0 || processing}
              className="flex-[2] min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-40 active:scale-95 transition-all touch-manipulation"
            >
              {processing ? '⏳' : '✓'} Ubicar {batchArticles.length} artículo{batchArticles.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* ── Feedback ── */}
      {feedback && (
        <div className={`flex-shrink-0 mx-4 mt-2 p-3 rounded-xl text-center font-bold text-sm
          ${feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-700' :
            feedback.type === 'info' ? 'bg-blue-500/20 text-blue-700' :
            'bg-red-500/20 text-red-700'}`}>
          {feedback.message}
        </div>
      )}

      {/* ── Buscador (idle) ── */}
      {action === 'idle' && (
        <div className="flex-shrink-0">
          <KioskSearchBar
            locations={locations}
            onHighlight={setHighlightedSearch}
            global
            currentShelfCode={shelfCode}
            canNavigateToShelf={config.shelfScope === 'all' && !!setShelfCode}
            onShelfNavigate={setShelfCode}
            onOutOfShelfResult={(result) => {
              if (config.shelfScope !== 'all') {
                showToast('info', `Está en ${result.shelfCode} (pos. ${result.positions.map((p) => padPos(p)).join(', ')})`);
              }
            }}
          />
        </div>
      )}

      {/* ── Grid ── */}
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
            highlightedPositions={highlightedPositions}
            showReprocessCosts={reprocesosCosts}
            fullscreenMode={fullscreenGrid}
            forceSingleBlock={forceSingleBlock}
          />
        )}
      </div>

      {/* ── Escáner (pistola/teclado) ── */}
      <ScannerInput
        onScan={handleScan}
        active={scannerActive}
        disabled={processing}
        showCameraButtons={batchMode}
        dualField
      />

      {/* ── Modales ── */}
      <ScanMethodPicker
        open={scanMethodPickerOpen}
        actionLabel={batchMode ? 'Ubicar en lote' : actionLabel}
        onSelect={applyScanMethod}
        onBatch={pendingAction === 'ubicar' && !batchMode ? beginBatchMode : undefined}
        onClose={handleScanMethodPickerClose}
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
        onClose={() => engine.setShowRetirarCellModal(false)}
        loading={processing}
      />

      {showMoverArticleList && (
        <MoverArticleList
          locations={locations}
          shelfCode={shelfCode}
          onSelect={handleMoverSelectArticle}
          onClose={() => { setShowMoverArticleList(false); cancelAction(); }}
        />
      )}

      {/* Selector de sección (retirar por sección / reubicar) */}
      {sectionPicker.open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {sectionPicker.purpose === 'reubicar-origen' ? 'Reubicar — origen' :
                 sectionPicker.purpose === 'reubicar-destino' ? 'Reubicar — destino' : 'Retirar'}
              </p>
              <h3 className="text-lg font-black text-slate-900">
                {sectionPicker.purpose === 'reubicar-origen' ? '¿De qué sección retiras el artículo?' :
                 sectionPicker.purpose === 'reubicar-destino' ? '¿A qué sección lo llevas?' :
                 '¿De qué sección?'}
              </h3>
            </div>
            <div className="p-3 max-h-[60vh] overflow-y-auto space-y-1.5">
              {sectionPicker.purpose !== 'reubicar-destino' && (
                <button
                  onClick={() => handleSectionPicked(shelfCode)}
                  className="w-full text-left rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900"
                >
                  📍 Sección actual — {shelfDef?.name || shelfCode}
                </button>
              )}
              {SHELF_DEFINITIONS.filter((s) => s.code !== (sectionPicker.purpose === 'reubicar-destino' ? reubicarCtx?.fromShelf : shelfCode) && s.code !== 'COM').map((s) => (
                <button
                  key={s.code}
                  onClick={() => handleSectionPicked(s.code)}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
                >
                  {s.name} <span className="text-xs text-slate-400 font-mono">({s.code})</span>
                </button>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-100">
              <button
                onClick={() => { setSectionPicker((p) => ({ ...p, open: false })); cancelAction(); }}
                className="w-full rounded-xl bg-slate-100 text-slate-700 py-3 text-sm font-bold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-sección (ubicar artículo grande) */}
      <AddShelfPositionModal
        open={showAddShelfModal}
        currentShelfCode={shelfCode}
        onAdd={addAdditionalShelf}
        onClose={() => setShowAddShelfModal(false)}
      />

      {/* Calidad cellFirst: pregunta si el artículo tiene OF antes de escanear */}
      <ConfirmationModal
        open={showOFQuestion}
        onClose={handleOFCancel}
        title="¿Tiene OF?"
        message="¿Este artículo tiene hoja de ruta / orden de fabricación?"
        icon="📋"
        variant="info"
        confirmText="SÍ, tiene OF"
        onConfirm={() => handleOFAnswer(true)}
        extraButton={{ text: 'NO, sin OF', onClick: () => handleOFAnswer(false) }}
        loading={false}
      />

      {/* Reprocesos: importe/cantidad al ubicar (calidad) */}
      <ReprocesosUbicacionModal
        open={showReprocesosUbicacionModal}
        articleCode={scanData?.articleCode || ''}
        orderFab={scanData?.orderFab || ''}
        position={selectedPositions[0] || ''}
        onConfirm={handleReprocesosUbicacionConfirm}
        onSkip={handleReprocesosUbicacionSkip}
        onClose={() => { engine.setShowReprocesosUbicacionModal(false); cancelAction(); }}
      />

      {/* Reprocesos: editor en celda idle (calidad) */}
      {reprocesosCell && (
        <ReprocesosEditor
          position={reprocesosCell.position}
          items={(reprocesosCell.items || []) as never}
          onClose={() => setReprocesosCell(null)}
          onUpdated={() => {
            const updated = locations.find((l) => l.position === reprocesosCell.position);
            if (updated) setReprocesosCell(updated);
          }}
        />
      )}

      {/* Avisar: recogida */}
      <RecogidaModal
        open={showRecogidaModal}
        currentShelfCode={shelfCode}
        processing={processing}
        onConfirm={handleRecogidaConfirm}
        onClose={() => { setShowRecogidaModal(false); cancelAction(); }}
      />

      {/* Avisar: traer */}
      {showTraerModal && (
        <TraerArticuloModal
          open={showTraerModal}
          currentShelfCode={shelfCode}
          onClose={() => { setShowTraerModal(false); cancelAction(); }}
          onConfirm={handleTraerConfirm}
          loading={processing}
        />
      )}

      {/* Confirmaciones (incluye ghost, bucles, almacén, avisar) */}
      <ConfirmationModal
        open={confirmModal.open}
        onClose={confirmModal.onClose ?? (() => setConfirmModal((p) => ({ ...p, open: false })))}
        title={confirmModal.title}
        message={confirmModal.message}
        icon={confirmModal.icon}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        extraButton={confirmModal.extraButton}
        loading={processing}
      />

      {/* Inspección de celda: pulsar una ubicación ocupada la amplía para ver su
          contenido; pulsar fuera (backdrop) vuelve al tamaño normal. */}
      {selectedCell && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedCell(null)}
        >
          <div
            className="w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ubicación</p>
                <h3 className="text-lg font-black text-white font-mono truncate">
                  {shelfCode} {padPos(selectedCell.position) || selectedCell.position}
                </h3>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] font-bold font-mono px-2.5 py-1 rounded-full bg-slate-700 text-slate-200">
                  {selectedCell.items.length} art.
                </span>
                <button
                  onClick={() => setSelectedCell(null)}
                  className="text-slate-400 hover:text-white text-2xl leading-none"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-3 max-h-[60vh] overflow-y-auto space-y-2">
              {selectedCell.items.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">Ubicación vacía</p>
              ) : (
                selectedCell.items.map((item, idx) => (
                  <div key={`${item.articleCode}-${item.orderFab}-${idx}`} className="rounded-xl px-3 py-2.5 bg-slate-800 border border-slate-700">
                    <p className="text-[15px] font-black font-mono text-white leading-tight break-all">{item.articleCode}</p>
                    <p className="text-[12px] font-bold font-mono text-cyan-300 leading-tight break-all">{item.orderFab}</p>
                    {reprocesosCosts && item.quantity != null && item.unitCost != null && item.unitCost > 0 && (
                      <p className="text-[11px] text-amber-300 font-mono mt-0.5">{item.quantity} ud · {item.unitCost.toFixed(2)} €/ud</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1 break-words">
                      {item.locatedByName}{item.locatedAt ? ` · ${new Date(item.locatedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                    </p>
                  </div>
                ))
              )}
              <div className="pt-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Nota</p>
                <textarea
                  key={selectedCell.locationId}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-cyan-500 transition-colors"
                  placeholder="Añadir nota..."
                  rows={2}
                  defaultValue={selectedCell.nota ?? ''}
                  onBlur={(e) => handleSaveNota(e.target.value, selectedCell.locationId)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperativeShelfArea;
