import React, { useState, useCallback, useMemo } from 'react';
import { Layers, PackagePlus, PackageMinus, ArrowLeftRight, Search, ChevronLeft, Check, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useChapero } from '../../hooks/useChapero';
import type { ChaperoPositionDoc } from '../../lib/schema/chapero';
import { CHAPERO_MATERIALS, CHAPERO_ESPESORES, getMaterialStyle } from '../../lib/schema/chapero';
import ChaperoGrid from './ChaperoGrid';
import ChaperoRetirarModal from './ChaperoRetirarModal';

type ChaperoMode = 'idle' | 'ubicar' | 'retirar' | 'mover';

interface ChaperoViewProps {
  onClose?: () => void;
}

const ACTION_BUTTONS: { mode: ChaperoMode; label: string; Icon: React.ComponentType<{ className?: string }>; activeClass: string; idleClass: string }[] = [
  {
    mode: 'ubicar',
    label: 'UBICAR',
    Icon: PackagePlus,
    activeClass: 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30 ring-2 ring-emerald-400',
    idleClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
  },
  {
    mode: 'retirar',
    label: 'RETIRAR',
    Icon: PackageMinus,
    activeClass: 'bg-red-600 text-white shadow-lg shadow-red-900/30 ring-2 ring-red-400',
    idleClass: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
  },
  {
    mode: 'mover',
    label: 'MOVER',
    Icon: ArrowLeftRight,
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
  const [pendingAlbaran, setPendingAlbaran] = useState('');

  const effectiveMaterial = pendingMaterial === 'OTRO' ? customMaterial.trim().toUpperCase() : pendingMaterial;
  const effectiveEspesor = pendingEspesor === 'custom' ? customEspesor.trim() : pendingEspesor;
  const ubicarReady = !!(effectiveMaterial && effectiveEspesor && pendingAlbaran.trim());

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
        if (!ubicarReady) { showFeedback('err', 'Selecciona material, espesor y nº de albarán primero'); return; }
        setOpLoading(true);
        const locatedByName = displayName || operarioId || 'Desconocido';
        const ok = await ubicar(pos.positionId, effectiveMaterial, effectiveEspesor, locatedByName, pendingSpec.trim() || undefined, pendingAlbaran.trim());
        setOpLoading(false);
        if (ok) showFeedback('ok', `${effectiveMaterial} ${effectiveEspesor}mm → ${pos.positionId}`);
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
    [mode, moverOrigin, ubicarReady, effectiveMaterial, effectiveEspesor, pendingSpec, pendingAlbaran, displayName, operarioId, ubicar],
  );

  const handleRetirarConfirm = async (itemIds: string[]) => {
    if (!selectedPos) return;
    setOpLoading(true);
    const ok = await retirar(selectedPos.positionId, itemIds);
    setOpLoading(false);
    setSelectedPos(null);
    if (ok) showFeedback('ok', `Retirado de ${selectedPos.positionId}`);
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
    if (ok) showFeedback('ok', `Movido ${from} → ${to}`);
    else showFeedback('err', 'Error al mover');
  };

  const occupiedCount = positions.filter((p) => !p.isEmpty && p.items.length > 0).length;
  const totalPositions = positions.length;
  const freeCount = totalPositions - occupiedCount;
  const sheetCount = positions.reduce((n, p) => n + p.items.length, 0);
  const occupancyPct = totalPositions ? Math.round((occupiedCount / totalPositions) * 100) : 0;

  // Resumen por material — sirve de leyenda de colores + inventario rápido
  const materialSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of positions) {
      for (const it of p.items) counts.set(it.material, (counts.get(it.material) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [positions]);
  const activeMaterialFilter = searchQuery.trim().toUpperCase();
  const moverConfirm = mode === 'mover' && !!moverOrigin && !!selectedPos;
  const modeHint = mode === 'mover' && moverOrigin
    ? `Paso 2 · Toca el DESTINO — origen: ${moverOrigin.positionId}`
    : mode === 'mover' ? 'Paso 1 · Toca la celda ORIGEN (de dónde mueves)'
    : mode === 'retirar' ? 'Toca una celda ocupada para retirar'
    : '';

  return (
    <div className="h-dvh w-screen max-w-full bg-slate-50 flex flex-col overflow-hidden">

      {/* ── Header — Responsive ── */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm space-y-1.5">
        {/* Línea 1: Título + ocupación + Volver */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex-shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-slate-900 text-white">
              <Layers className="w-5 h-5" aria-hidden />
            </span>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">Chapero</h1>
          </div>

          {/* Ocupación — mismo lenguaje que la tarjeta de las estanterías */}
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="flex-1 min-w-[4rem] max-w-xs">
              <div className="flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-black text-emerald-600 tabular-nums leading-none">{occupancyPct}%</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">ocupación</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${occupancyPct}%` }} />
              </div>
            </div>
            <dl className="hidden sm:flex items-center gap-1.5 text-[11px]">
              {[
                { label: 'Libres', value: freeCount },
                { label: 'Ocupadas', value: occupiedCount },
                { label: 'Chapas', value: sheetCount },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-baseline gap-1 rounded-lg bg-slate-100 px-2 py-1">
                  <dt className="font-bold uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="font-black text-slate-900 tabular-nums text-sm leading-none">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {onClose && (
            <button onClick={onClose} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl flex-shrink-0 whitespace-nowrap hover:bg-slate-200 transition-colors">
              <ChevronLeft className="w-4 h-4" aria-hidden /> Volver
            </button>
          )}
        </div>

        {/* Línea 2: Botones de acción + búsqueda (en PC comparten línea) */}
        <div className="flex flex-col lg:flex-row gap-1.5">
          <div className="flex gap-1.5 lg:w-[30rem] lg:flex-shrink-0">
            {ACTION_BUTTONS.map(({ mode: m, label, Icon, activeClass, idleClass }) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMode(m)}
                aria-pressed={mode === m}
                className={`flex-1 min-h-11 py-2 rounded-xl font-bold transition-all active:scale-[0.97] inline-flex items-center justify-center gap-2 ${mode === m ? activeClass : idleClass}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs sm:text-sm tracking-wide">{label}</span>
              </button>
            ))}
          </div>

          {mode !== 'ubicar' && (
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-2.5 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar material, espesor o especificación…"
                className="w-full min-h-11 rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} aria-label="Borrar búsqueda" className="absolute right-2 p-1 text-slate-400 hover:text-slate-600 shrink-0">
                  <X className="w-4 h-4" aria-hidden />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Hint para retirar/mover */}
        {(mode === 'retirar' || mode === 'mover') && (
          <div className={`px-3 py-1.5 rounded-lg text-xs font-bold text-center w-full ${
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
            <div className="flex items-center gap-2 bg-emerald-600 rounded-lg px-2.5 py-1.5">
              <span className="text-white text-xs font-bold flex-1">Toca una celda libre</span>
              <span className="text-emerald-100 text-xs font-black shrink-0">
                {effectiveMaterial}{pendingSpec.trim() ? ` ${pendingSpec.trim().toUpperCase()}` : ''} · {effectiveEspesor}mm
              </span>
            </div>
          ) : (
            <div className="bg-emerald-600 text-white text-xs font-bold text-center py-1.5 rounded-lg">
              Selecciona material, espesor y nº de albarán
            </div>
          )}

          {/* Material + Espesor — responsive (vertical en móvil, horizontal en tablet+) */}
          <div className="flex flex-col sm:flex-row gap-1 sm:gap-1.5">
            {/* Material */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-1">Material</p>
              <div className="grid grid-cols-3 lg:grid-cols-4 gap-1 w-full">
                {CHAPERO_MATERIALS.map((m) => {
                  const style = getMaterialStyle(m);
                  const selected = pendingMaterial === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPendingMaterial(m)}
                      className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg border text-[11px] font-bold transition-all active:scale-95 ${
                        selected
                          ? `${style.cell} ${style.text} ring-2 ring-offset-1 ring-slate-400 shadow-sm`
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`} />
                      <span className="truncate">{m}</span>
                    </button>
                  );
                })}
              </div>
              {pendingMaterial === 'OTRO' && (
                <input
                  type="text"
                  value={customMaterial}
                  onChange={(e) => setCustomMaterial(e.target.value)}
                  placeholder="Material…"
                  autoFocus
                  className="mt-1 w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>

            {/* Espesor */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-1">Espesor (mm)</p>
              <div className="grid grid-cols-4 lg:grid-cols-7 gap-1 w-full">
                {CHAPERO_ESPESORES.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setPendingEspesor(e)}
                    className={`py-2 rounded-lg text-xs font-black tabular-nums transition-all active:scale-95 ${
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
                  className={`py-2 rounded-lg text-xs font-black transition-all active:scale-95 ${
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
                  className="mt-1 w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>
          </div>

          {/* Nº de albarán (obligatorio) + especificación (opcional) — en PC, en la misma línea */}
          <div className="flex flex-col sm:flex-row gap-1 sm:gap-1.5">
            <input
              type="text"
              value={pendingAlbaran}
              onChange={(e) => setPendingAlbaran(e.target.value)}
              placeholder="Nº de albarán (obligatorio)…"
              className="w-full sm:flex-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <input
              type="text"
              value={pendingSpec}
              onChange={(e) => setPendingSpec(e.target.value)}
              placeholder="Especificación opcional (ej: DC11, S235JR)…"
              className="w-full sm:flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
        </div>
      )}

      {/* ── Feedback toast ── */}
      {feedback && (
        <div className={`fixed top-4 left-4 right-4 z-50 p-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm shadow-2xl ${
          feedback.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {feedback.type === 'ok' ? <Check className="w-5 h-5 shrink-0" aria-hidden /> : <X className="w-5 h-5 shrink-0" aria-hidden />}
          {feedback.msg}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="mx-3 mt-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex-shrink-0">
          {error}
        </div>
      )}

      {/* ── Leyenda / resumen por material — cada chip filtra por su material ── */}
      {mode !== 'ubicar' && (materialSummary.length > 0 || searchQuery) && (
        <div className="flex-shrink-0 flex items-center gap-1.5 overflow-x-auto px-2 sm:px-3 py-1.5 bg-white border-b border-slate-200 [scrollbar-width:thin]">
          {materialSummary.map(([material, count]) => {
            const style = getMaterialStyle(material);
            const active = activeMaterialFilter === material.toUpperCase();
            return (
              <button
                key={material}
                type="button"
                onClick={() => setSearchQuery(active ? '' : material)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  active
                    ? `${style.cell} ${style.text} ring-2 ring-amber-400`
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} aria-hidden />
                {material}
                <span className="tabular-nums font-black opacity-60">{count}</span>
              </button>
            );
          })}
          {searchQuery && highlightedIds && (
            <span className={`ml-auto pl-2 whitespace-nowrap text-[11px] font-bold ${highlightedIds.size > 0 ? 'text-amber-700' : 'text-red-600'}`}>
              {highlightedIds.size > 0
                ? `${highlightedIds.size} posición${highlightedIds.size === 1 ? '' : 'es'} con «${searchQuery}»`
                : `Sin resultados para «${searchQuery}»`}
            </span>
          )}
        </div>
      )}

      {/* ── Grid ── */}
      <main className="flex-1 min-h-0 overflow-y-auto bg-slate-100">
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
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-blue-700 text-xs font-black active:scale-95"
          >
            {opLoading ? 'Moviendo…' : <><Check className="w-4 h-4" aria-hidden /> Confirmar</>}
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
