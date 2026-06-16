import React, { useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useChapero } from '../../hooks/useChapero';
import type { ChaperoPositionDoc } from '../../lib/schema/chapero';
import { CHAPERO_MATERIALS, CHAPERO_ESPESORES } from '../../lib/schema/chapero';
import ChaperoGrid from './ChaperoGrid';
import ChaperoRetirarModal from './ChaperoRetirarModal';

type ChaperoMode = 'idle' | 'ubicar' | 'retirar' | 'mover';

interface ChaperoViewProps {
  onClose?: () => void;
}

const ACTION_BUTTONS: { mode: ChaperoMode; label: string; icon: string; activeClass: string; idleClass: string }[] = [
  {
    mode: 'ubicar',
    label: 'UBICAR',
    icon: '📥',
    activeClass: 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30 ring-2 ring-emerald-400',
    idleClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
  },
  {
    mode: 'retirar',
    label: 'RETIRAR',
    icon: '📤',
    activeClass: 'bg-red-600 text-white shadow-lg shadow-red-900/30 ring-2 ring-red-400',
    idleClass: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
  },
  {
    mode: 'mover',
    label: 'MOVER',
    icon: '🔄',
    activeClass: 'bg-blue-600 text-white shadow-lg shadow-blue-900/30 ring-2 ring-blue-400',
    idleClass: 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100',
  },
];

const ChaperoView: React.FC<ChaperoViewProps> = ({ onClose }) => {
  const { displayName, operarioId } = useAuth();
  const { positions, loading, error, ubicar, retirar, mover, searchByMaterial } = useChapero();

  const [mode, setMode] = useState<ChaperoMode>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPos, setSelectedPos] = useState<ChaperoPositionDoc | null>(null);
  const [moverOrigin, setMoverOrigin] = useState<ChaperoPositionDoc | null>(null);
  const [opLoading, setOpLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Ubicar inline selector state
  const [pendingMaterial, setPendingMaterial] = useState<string>('ACERO');
  const [customMaterial, setCustomMaterial] = useState('');
  const [pendingEspesor, setPendingEspesor] = useState<string>('1.0');
  const [customEspesor, setCustomEspesor] = useState('');
  const [pendingSpec, setPendingSpec] = useState('');

  const effectiveMaterial = pendingMaterial === 'OTRO' ? customMaterial.trim().toUpperCase() : pendingMaterial;
  const effectiveEspesor = pendingEspesor === 'custom' ? customEspesor.trim() : pendingEspesor;
  const ubicarReady = !!(effectiveMaterial && effectiveEspesor);

  const showFeedback = (type: 'ok' | 'err', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  const resetMode = () => {
    setMode('idle');
    setSelectedPos(null);
    setMoverOrigin(null);
  };

  const toggleMode = (m: ChaperoMode) => {
    if (mode === m) { resetMode(); return; }
    setMode(m);
    setSelectedPos(null);
    setMoverOrigin(null);
  };

  const highlightedIds = searchQuery.trim()
    ? new Set(searchByMaterial(searchQuery).map((p) => p.positionId))
    : undefined;

  const handleCellClick = useCallback(
    async (pos: ChaperoPositionDoc) => {
      if (mode === 'idle') return;

      if (mode === 'ubicar') {
        if (!ubicarReady) { showFeedback('err', 'Selecciona material y espesor primero'); return; }
        setOpLoading(true);
        const locatedByName = displayName || operarioId || 'Desconocido';
        const ok = await ubicar(pos.positionId, effectiveMaterial, effectiveEspesor, locatedByName, pendingSpec.trim() || undefined);
        setOpLoading(false);
        if (ok) showFeedback('ok', `✅ ${effectiveMaterial} ${effectiveEspesor}mm → ${pos.positionId}`);
        else showFeedback('err', 'Error al colocar la chapa');
        return;
      }

      if (mode === 'retirar') {
        if (pos.isEmpty || pos.items.length === 0) return;
        setSelectedPos(pos);
        return;
      }

      if (mode === 'mover') {
        if (!moverOrigin) {
          if (pos.isEmpty || pos.items.length === 0) return;
          setMoverOrigin(pos);
          return;
        }
        if (pos.positionId === moverOrigin.positionId) { setMoverOrigin(null); return; }
        setSelectedPos(pos);
      }
    },
    [mode, moverOrigin, ubicarReady, effectiveMaterial, effectiveEspesor, pendingSpec, displayName, operarioId, ubicar],
  );

  const handleRetirarConfirm = async (itemIds: string[]) => {
    if (!selectedPos) return;
    setOpLoading(true);
    const ok = await retirar(selectedPos.positionId, itemIds);
    setOpLoading(false);
    setSelectedPos(null);
    if (ok) showFeedback('ok', `✅ Retirado de ${selectedPos.positionId}`);
    else showFeedback('err', 'Error al retirar');
  };

  const handleMoverConfirm = async () => {
    if (!moverOrigin || !selectedPos) return;
    setOpLoading(true);
    const ok = await mover(moverOrigin.positionId, selectedPos.positionId);
    setOpLoading(false);
    const from = moverOrigin.positionId;
    const to = selectedPos.positionId;
    setMoverOrigin(null);
    setSelectedPos(null);
    if (ok) showFeedback('ok', `✅ Movido ${from} → ${to}`);
    else showFeedback('err', 'Error al mover');
  };

  const occupiedCount = positions.filter((p) => !p.isEmpty).length;
  const moverConfirm = mode === 'mover' && !!moverOrigin && !!selectedPos;
  const modeHint = mode === 'mover' && moverOrigin
    ? `2️⃣ Toca el DESTINO — origen: ${moverOrigin.positionId}`
    : mode === 'mover' ? '1️⃣ Toca la celda ORIGEN (de dónde mueves)'
    : mode === 'retirar' ? '👇 Toca una celda ocupada para retirar'
    : '';

  return (
    <div className="h-dvh w-screen max-w-full bg-slate-50 flex flex-col overflow-hidden">

      {/* ── Header — Responsive ── */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm">
        {/* Línea 1: Título + Volver */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 mb-1">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <span className="text-xl sm:text-2xl flex-shrink-0">🔩</span>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">Chapero</h1>
              <p className="text-[8px] sm:text-[10px] text-slate-500 leading-none mt-0.5">
                {occupiedCount} ocupadas · {positions.length - occupiedCount} libres
              </p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[11px] font-bold bg-slate-100 text-slate-700 rounded-lg sm:rounded-xl flex-shrink-0 whitespace-nowrap">
              ‹ Volver
            </button>
          )}
        </div>

        {/* Línea 2: Botones de acción — compactos en móvil */}
        <div className="flex gap-1 sm:gap-1.5 mb-1">
          {ACTION_BUTTONS.map(({ mode: m, label, icon, activeClass, idleClass }) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMode(m)}
              className={`flex-1 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold transition-all active:scale-[0.97] flex flex-col items-center gap-0 ${mode === m ? activeClass : idleClass}`}
            >
              <span className="text-lg sm:text-xl leading-none">{icon}</span>
              <span className="text-[8px] sm:text-[9px] tracking-wider mt-0.5">{label}</span>
            </button>
          ))}
        </div>

        {/* Línea 3: Búsqueda + Hint — responsive */}
        {mode !== 'ubicar' && (
          <div className="flex items-center gap-1 mb-0.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Buscar…"
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 sm:py-1.5 text-[9px] sm:text-[10px] focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 font-bold px-1 text-sm shrink-0">✕</button>
            )}
          </div>
        )}

        {/* Hint para retirar/mover */}
        {(mode === 'retirar' || mode === 'mover') && (
          <div className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-bold text-center w-full ${
            mode === 'retirar' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
          }`}>
            {modeHint}
          </div>
        )}
      </header>

      {/* ── Panel de UBICAR (selector inline, responsive) ── */}
      {mode === 'ubicar' && (
        <div className="flex-shrink-0 bg-emerald-50 border-b-2 border-emerald-200 px-2 sm:px-3 pt-1 pb-1.5 space-y-1">

          {/* Hint + resumen en la misma línea cuando ya hay selección */}
          {ubicarReady ? (
            <div className="flex items-center gap-1.5 sm:gap-2 bg-emerald-600 rounded-lg px-2 sm:px-2.5 py-1">
              <span className="text-white text-[9px] sm:text-[10px] font-bold flex-1">👇 Toca celda</span>
              <span className="text-emerald-100 text-[8px] sm:text-[10px] font-black shrink-0">
                {effectiveMaterial}{pendingSpec.trim() ? ` ${pendingSpec.trim().toUpperCase()}` : ''} · {effectiveEspesor}mm
              </span>
            </div>
          ) : (
            <div className="bg-emerald-600 text-white text-[9px] sm:text-[10px] font-bold text-center py-1 rounded-lg">
              👇 Selecciona material + espesor
            </div>
          )}

          {/* Material + Espesor — responsive (vertical en móvil, horizontal en tablet+) */}
          <div className="flex flex-col sm:flex-row gap-1 sm:gap-1.5">
            {/* Material */}
            <div className="flex-1 min-w-0">
              <p className="text-[7px] font-black uppercase tracking-widest text-emerald-700 mb-0.5">Material</p>
              <div className="grid grid-cols-3 gap-0.5 w-full">
                {CHAPERO_MATERIALS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPendingMaterial(m)}
                    className={`py-1 rounded text-[8px] sm:text-[9px] font-bold transition-all active:scale-95 ${
                      pendingMaterial === m
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {m === 'GALVANIZADO' ? 'G' : m === 'ACERO' ? 'A' : m.slice(0, 3)}
                  </button>
                ))}
              </div>
              {pendingMaterial === 'OTRO' && (
                <input
                  type="text"
                  value={customMaterial}
                  onChange={(e) => setCustomMaterial(e.target.value)}
                  placeholder="Material…"
                  autoFocus
                  className="mt-1 w-full rounded-lg border border-emerald-300 bg-white px-2 py-1 text-[9px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>

            {/* Espesor */}
            <div className="flex-1 min-w-0">
              <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-emerald-700 mb-0.5">Espesor (mm)</p>
              <div className="grid grid-cols-4 gap-0.5 sm:gap-1 w-full">
                {CHAPERO_ESPESORES.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setPendingEspesor(e)}
                    className={`py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-[10px] font-black transition-all active:scale-95 ${
                      pendingEspesor === e
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {e}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPendingEspesor('custom')}
                  className={`py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-[10px] font-black transition-all active:scale-95 ${
                    pendingEspesor === 'custom'
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  Otro
                </button>
              </div>
              {pendingEspesor === 'custom' && (
                <input
                  type="text"
                  inputMode="decimal"
                  value={customEspesor}
                  onChange={(e) => setCustomEspesor(e.target.value)}
                  placeholder="Ej: 7.0"
                  autoFocus
                  className="mt-1 w-full rounded-lg border border-emerald-300 bg-white px-2 py-1 text-[9px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>
          </div>

          {/* Especificación — fila completa, discreta */}
          <input
            type="text"
            value={pendingSpec}
            onChange={(e) => setPendingSpec(e.target.value)}
            placeholder="Spec. opcional…"
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[8px] sm:text-[9px] text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>
      )}

      {/* ── Feedback toast ── */}
      {feedback && (
        <div className={`fixed top-4 left-4 right-4 z-50 p-3 rounded-2xl text-center font-bold text-sm shadow-2xl ${
          feedback.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="mx-3 mt-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex-shrink-0">
          {error}
        </div>
      )}

      {/* ── Resultado búsqueda ── */}
      {searchQuery && highlightedIds && (
        <div className="flex-shrink-0 px-3 py-1.5 text-xs font-bold bg-amber-50 border-b border-amber-200 text-amber-700">
          {highlightedIds.size > 0
            ? `${highlightedIds.size} posición(es) con "${searchQuery}"`
            : `Sin resultados para "${searchQuery}"`}
        </div>
      )}

      {/* ── Grid ── */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Cargando chapero…</div>
        ) : (
          <ChaperoGrid
            positions={positions}
            highlightedIds={highlightedIds}
            originId={moverOrigin?.positionId ?? null}
            onCellClick={handleCellClick}
            mode={mode}
          />
        )}
      </main>

      {/* ── Barra confirmación MOVER paso 2 ── */}
      {moverConfirm && (
        <div className="flex-shrink-0 bg-blue-600 px-4 py-3 flex items-center gap-3">
          <div className="flex-1 text-white text-xs font-bold">
            <span className="opacity-70">Mover </span>
            <span className="font-black">{moverOrigin?.positionId}</span>
            <span className="opacity-70"> → </span>
            <span className="font-black">{selectedPos?.positionId}</span>
          </div>
          <button onClick={() => setSelectedPos(null)} className="px-3 py-2 rounded-xl bg-white/20 text-white text-xs font-bold">
            Cambiar
          </button>
          <button
            onClick={handleMoverConfirm}
            disabled={opLoading}
            className="px-4 py-2 rounded-xl bg-white text-blue-700 text-xs font-black active:scale-95"
          >
            {opLoading ? 'Moviendo…' : '✔ Confirmar'}
          </button>
        </div>
      )}

      {/* ── Modal RETIRAR ── */}
      {selectedPos && mode === 'retirar' && selectedPos.items.length > 0 && (
        <ChaperoRetirarModal
          positionId={selectedPos.positionId}
          items={selectedPos.items}
          onConfirm={handleRetirarConfirm}
          onClose={() => setSelectedPos(null)}
          loading={opLoading}
        />
      )}
    </div>
  );
};

export default ChaperoView;
