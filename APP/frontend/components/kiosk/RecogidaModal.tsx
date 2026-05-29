import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useGlobalSearchWithCache, type GlobalSearchResult } from '../../hooks/useGlobalSearchWithCache';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';

interface RecogidaModalProps {
  open: boolean;
  currentShelfCode: string;
  processing: boolean;
  onConfirm: (
    articleCode: string,
    articleOrderFab: string,
    destShelfCode: string,
    destShelfName: string,
  ) => void;
  onClose: () => void;
}

type Step = 'article' | 'destination';

function shelfNameFor(code: string): string {
  return SHELF_DEFINITIONS.find((s) => s.code === code)?.name || code;
}

function positionNumber(posStr: string): number {
  const idx = posStr.lastIndexOf('_');
  const raw = idx >= 0 ? posStr.slice(idx + 1) : posStr;
  return parseInt(raw, 10);
}

// Secciones disponibles como destino de recogida
const DESTINATION_SECTIONS: { code: string; name: string; emoji: string }[] = [
  { code: 'ALMACEN',      name: 'Almacén',       emoji: '🏪' },
  { code: 'MECANIZADO',   name: 'Mecanizado',    emoji: '⚙️' },
  { code: 'PRENSAS',      name: 'Prensas',       emoji: '🔩' },
  { code: 'PLEGADORA',    name: 'Plegado',       emoji: '📐' },
  { code: 'SOLDADURA',    name: 'Soldadura',     emoji: '🔥' },
  { code: 'AUTOPLEGADORA',name: 'Autoplegadora', emoji: '🤖' },
  { code: 'REPASADO',     name: 'Repasado',      emoji: '🔧' },
  { code: 'PINTURA',      name: 'Pintura',       emoji: '🎨' },
  { code: 'LASER',        name: 'Láser',         emoji: '⚡' },
  { code: 'CALIDAD',      name: 'Calidad',       emoji: '✅' },
  { code: 'OTROS',        name: 'Otros',         emoji: '📦' },
];

const RecogidaModal: React.FC<RecogidaModalProps> = ({
  open,
  currentShelfCode,
  processing,
  onConfirm,
  onClose,
}) => {
  const [step, setStep] = useState<Step>('article');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<GlobalSearchResult | null>(null);
  const [destShelfCode, setDestShelfCode] = useState('');
  const [destShelfName, setDestShelfName] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const { results, loading: searching } = useGlobalSearchWithCache(debouncedQuery, currentShelfCode);

  useEffect(() => {
    if (open) {
      setStep('article');
      setQuery('');
      setDebouncedQuery('');
      setSelected(null);
      setDestShelfCode('');
      setDestShelfName('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val.trim()), 200);
  }, []);

  const handleSelect = useCallback((result: GlobalSearchResult) => {
    setSelected(result);
    setQuery(`${result.articleCode}${result.orderFab ? '  ·  ' + result.orderFab : ''}`);
    setDebouncedQuery('');
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelected(null);
    setQuery('');
    setDebouncedQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleConfirmDestination = useCallback(() => {
    if (!destShelfCode || !selected) return;
    onConfirm(selected.articleCode, selected.orderFab, destShelfCode, destShelfName);
  }, [selected, destShelfCode, destShelfName, onConfirm]);

  const showResults = debouncedQuery.length > 0 && !selected;

  if (!open) return null;

  // ─── Paso 2: selección de destino ───────────────────────────────────────────
  if (step === 'destination') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
          <button
            onClick={() => setStep('article')}
            disabled={processing}
            className="text-slate-400 hover:text-white transition-colors p-1 text-sm font-bold"
          >
            ← Volver
          </button>
          <h2 className="text-lg font-black text-white flex-1 text-center">🚚 ¿A dónde va?</h2>
          <div className="w-16" />
        </div>

        {/* Resumen artículo seleccionado */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-800/50">
          <div className="bg-slate-800/60 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div className="min-w-0">
              <p className="font-black text-white font-mono truncate">{selected?.articleCode}</p>
              {selected?.orderFab && (
                <p className="text-xs text-slate-400 font-mono">OF: {selected.orderFab}</p>
              )}
            </div>
            <button
              onClick={() => setStep('article')}
              className="ml-auto text-xs text-slate-500 hover:text-slate-300 font-bold shrink-0"
            >
              cambiar
            </button>
          </div>
        </div>

        {/* Selector de destino */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Selecciona el destino:</p>
          <div className="grid grid-cols-2 gap-2">
            {DESTINATION_SECTIONS.map((opt) => (
              <button
                key={opt.code}
                onClick={() => { setDestShelfCode(opt.code); setDestShelfName(opt.name); }}
                disabled={processing}
                className={`rounded-2xl border-2 px-3 py-4 text-center font-bold transition-all active:scale-95 ${
                  destShelfCode === opt.code
                    ? 'border-orange-400 bg-orange-500/20 text-orange-300'
                    : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="block text-2xl mb-1">{opt.emoji}</span>
                <span className="block text-sm font-black">{opt.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Confirmar */}
        <div className="px-4 pb-6 pt-3 border-t border-slate-800 space-y-2">
          <button
            onClick={handleConfirmDestination}
            disabled={!destShelfCode || processing}
            className="w-full h-16 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600
              text-white font-black text-xl shadow-lg shadow-orange-950/40
              active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {processing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>🔔 SOLICITAR RECOGIDA</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── Paso 1: búsqueda de artículo ────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
        <button onClick={onClose} disabled={processing} className="text-slate-400 hover:text-white transition-colors p-1 text-sm font-bold">
          ← Cancelar
        </button>
        <h2 className="text-lg font-black text-white flex-1 text-center">🔔 ¿Qué hay que recoger?</h2>
        <div className="w-16" />
      </div>

      {/* Buscador */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-800/50">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Código de artículo o nº de OF..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={processing || !!selected}
            className={`w-full pl-11 pr-10 py-3.5 rounded-2xl text-base font-mono outline-none transition-all
              ${selected
                ? 'bg-emerald-950/40 border-2 border-emerald-500/50 text-emerald-300 cursor-default'
                : 'bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent'
              }`}
          />
          {(query || selected) && (
            <button
              onClick={handleClearSelection}
              disabled={processing}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-all"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-xs text-slate-600 mt-1.5 ml-1">Escribe para filtrar · se busca en código de artículo y nº OF</p>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">

        {/* Artículo seleccionado — tarjeta de confirmación */}
        {selected && (
          <div className="mt-4 space-y-3">
            <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-3xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center shrink-0">
                  <span className="text-3xl">📦</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-2xl font-mono leading-tight break-all">{selected.articleCode}</p>
                  {selected.orderFab && (
                    <p className="text-base text-slate-400 font-mono mt-1">OF: {selected.orderFab}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-700">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ubicación actual</p>
                <div className="bg-slate-800/60 rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="text-slate-400">📍</span>
                  <span className="text-sm font-bold text-white">{shelfNameFor(selected.shelfCode)}</span>
                  <span className="text-xs text-slate-500 ml-auto">
                    {selected.positions.map((p) => {
                      const n = positionNumber(p);
                      return Number.isNaN(n) ? p : n;
                    }).filter((v, i, arr) => arr.indexOf(v) === i).sort((a, b) => Number(a) - Number(b)).map((p) => `pos. ${p}`).join(', ')}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep('destination')}
              disabled={processing}
              className="w-full h-16 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-600
                text-white font-black text-xl shadow-lg shadow-cyan-950/40
                active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              Siguiente: elegir destino →
            </button>
          </div>
        )}

        {/* Resultados de búsqueda */}
        {showResults && (
          <div className="mt-3 space-y-2">
            {searching && (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-[3px] border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!searching && results.length === 0 && (
              <div className="text-center py-10 bg-slate-900/60 rounded-2xl border border-slate-800">
                <span className="text-4xl block mb-2">🔍</span>
                <p className="text-slate-400 text-sm">Sin resultados para <span className="text-white font-mono">"{debouncedQuery}"</span></p>
              </div>
            )}
            {!searching && results.map((result, idx) => {
              const positions = result.positions
                .map((p) => { const n = positionNumber(p); return Number.isNaN(n) ? p : n; })
                .filter((v, i, arr) => arr.indexOf(v) === i)
                .sort((a, b) => Number(a) - Number(b));
              return (
                <button
                  key={`${result.aggregateKey}-${result.shelfCode}-${idx}`}
                  onClick={() => handleSelect(result)}
                  className={`w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.98] ${
                    result.matchesCurrentShelf
                      ? 'bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-400'
                      : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Código artículo — resaltado */}
                      <p className="font-black text-white text-lg font-mono leading-tight">{result.articleCode}</p>
                      {/* OF — subrayado */}
                      {result.orderFab && (
                        <p className="text-sm text-cyan-400/80 font-mono mt-0.5">OF: {result.orderFab}</p>
                      )}
                    </div>
                    {result.matchesCurrentShelf && (
                      <span className="shrink-0 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 font-bold">
                        Aquí
                      </span>
                    )}
                  </div>
                  {/* Ubicación */}
                  <div className="mt-2 pt-2 border-t border-slate-700/40 flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">📍</span>
                    <span className="text-xs font-bold text-slate-300">{shelfNameFor(result.shelfCode)}</span>
                    <span className="text-xs text-slate-500 ml-1">
                      {positions.length === 1 ? `· pos. ${positions[0]}` : `· pos. ${positions.join(', ')}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Estado inicial — sin búsqueda ni selección */}
        {!showResults && !selected && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-800/60 flex items-center justify-center mb-4">
              <span className="text-4xl">📦</span>
            </div>
            <p className="text-white font-bold text-lg">Busca el artículo a recoger</p>
            <p className="text-slate-500 text-sm mt-1">Escribe parte del código o del número de OF</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecogidaModal;
