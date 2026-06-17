/**
 * RecogidaModal — Flujo "QUE SE LLEVE" (RECOGER).
 *
 * El material normalmente NO está ubicado, así que el artículo/OF se escriben a
 * mano (con sugerencias del buscador como ayuda). Pasos:
 *   1. artículo (+ OF)  →  2. origen (dónde recogerlo)  →  [puesto soldadura]
 *   →  3. destino (a dónde va)  →  [puesto soldadura]  →  enviar.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useGlobalSearchWithCache, type GlobalSearchResult } from '../../hooks/useGlobalSearchWithCache';
import { REQUEST_SECTIONS, type RequestSection } from '../../lib/operative/requestSections';
import SoldaduraStationPicker from '../common/SoldaduraStationPicker';

export interface RecogidaSelection {
  articleCode: string;
  articleOrderFab: string;
  pickup: { code: string; name: string; section: RequestSection['section']; station: number | null };
  destination: { code: string; name: string; section: RequestSection['section']; station: number | null };
}

interface RecogidaModalProps {
  open: boolean;
  currentShelfCode: string;
  processing: boolean;
  targetCarretilleroName?: string;
  onConfirm: (selection: RecogidaSelection) => void;
  onClose: () => void;
}

type Step = 'article' | 'origin' | 'originStation' | 'destination' | 'destStation';

const SectionGrid: React.FC<{ onPick: (s: RequestSection) => void; selectedCode?: string; processing: boolean }> = ({ onPick, selectedCode, processing }) => (
  <div className="grid grid-cols-2 gap-2">
    {REQUEST_SECTIONS.map((opt) => (
      <button
        key={opt.code}
        onClick={() => onPick(opt)}
        disabled={processing}
        className={`rounded-2xl border-2 px-3 py-4 text-center font-bold transition-all active:scale-95 disabled:opacity-50 ${
          selectedCode === opt.code
            ? 'border-orange-400 bg-orange-500/20 text-orange-300'
            : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500'
        }`}
      >
        <span className="block text-2xl mb-1">{opt.emoji}</span>
        <span className="block text-sm font-black">{opt.name}</span>
      </button>
    ))}
  </div>
);

const RecogidaModal: React.FC<RecogidaModalProps> = ({
  open,
  currentShelfCode,
  processing,
  targetCarretilleroName,
  onConfirm,
  onClose,
}) => {
  const [step, setStep] = useState<Step>('article');
  const [articleCode, setArticleCode] = useState('');
  const [orderFab, setOrderFab] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [pickup, setPickup] = useState<RequestSection | null>(null);
  const [pickupStation, setPickupStation] = useState<number | null>(null);
  const [destination, setDestination] = useState<RequestSection | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const { results, loading: searching } = useGlobalSearchWithCache(debouncedQuery, currentShelfCode);

  useEffect(() => {
    if (open) {
      setStep('article');
      setArticleCode('');
      setOrderFab('');
      setDebouncedQuery('');
      setPickup(null);
      setPickupStation(null);
      setDestination(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleArticleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setArticleCode(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val.trim()), 250);
  }, []);

  const handlePickSuggestion = useCallback((r: GlobalSearchResult) => {
    setArticleCode(r.articleCode);
    setOrderFab(r.orderFab || '');
    setDebouncedQuery('');
  }, []);

  const submit = useCallback((dest: RequestSection, destStation: number | null) => {
    if (!pickup) return;
    onConfirm({
      articleCode: articleCode.trim(),
      articleOrderFab: orderFab.trim(),
      pickup: { code: pickup.code, name: pickup.name, section: pickup.section, station: pickupStation },
      destination: { code: dest.code, name: dest.name, section: dest.section, station: destStation },
    });
  }, [pickup, pickupStation, articleCode, orderFab, onConfirm]);

  if (!open) return null;

  const showSuggestions = debouncedQuery.length > 0 && results.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
        <button
          onClick={step === 'article' ? onClose : () => setStep(step === 'destination' || step === 'destStation' ? 'origin' : 'article')}
          disabled={processing}
          className="text-rose-400 hover:text-white transition-colors min-h-11 px-3 -ml-1 flex items-center text-sm font-bold"
        >
          ← {step === 'article' ? 'Cancelar' : 'Volver'}
        </button>
        <h2 className="text-lg font-black text-white flex-1 text-center">
          {step === 'article' && '🔔 ¿Qué hay que recoger?'}
          {step === 'origin' && '🚚 ¿De dónde se recoge?'}
          {step === 'destination' && '🚚 ¿A dónde va?'}
        </h2>
        <div className="w-16" />
      </div>

      {targetCarretilleroName && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-center">
          <span className="text-xs font-bold text-amber-300">🚜 Carretillero: {targetCarretilleroName}</span>
        </div>
      )}

      {/* ── Paso 1: artículo ── */}
      {step === 'article' && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-safe space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Código del artículo</label>
            <input
              ref={inputRef}
              type="text"
              value={articleCode}
              onChange={handleArticleChange}
              placeholder="Ej: CL34712023"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={processing}
              className="w-full px-4 py-3.5 rounded-2xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 font-mono text-base focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">OF (orden de fabricación)</label>
            <input
              type="text"
              value={orderFab}
              onChange={(e) => setOrderFab(e.target.value.toUpperCase())}
              placeholder="Ej: OF25-07221 (opcional)"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={processing}
              className="w-full px-4 py-3.5 rounded-2xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 font-mono text-base focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Sugerencias del buscador (ayuda; el material puede no estar ubicado) */}
          {searching && (
            <div className="flex items-center justify-center py-4">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {showSuggestions && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Coincidencias ubicadas</p>
              {results.slice(0, 6).map((r, idx) => (
                <button
                  key={`${r.aggregateKey}-${idx}`}
                  onClick={() => handlePickSuggestion(r)}
                  className="w-full text-left rounded-xl border border-slate-700 bg-slate-900/60 hover:border-slate-500 px-3 py-2.5 transition-all active:scale-[0.98]"
                >
                  <p className="font-black text-white font-mono text-sm">{r.articleCode}</p>
                  {r.orderFab && <p className="text-xs text-cyan-400/80 font-mono">OF: {r.orderFab}</p>}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setStep('origin')}
            disabled={!articleCode.trim() || processing}
            className="w-full h-16 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-black text-xl shadow-lg shadow-cyan-950/40 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            Siguiente: ¿de dónde? →
          </button>
        </div>
      )}

      {/* ── Paso 2: origen ── */}
      {step === 'origin' && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-safe">
          <div className="bg-slate-800/60 rounded-2xl px-4 py-3 mb-3 flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div className="min-w-0">
              <p className="font-black text-white font-mono truncate">{articleCode}</p>
              {orderFab && <p className="text-xs text-slate-400 font-mono">OF: {orderFab}</p>}
            </div>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">¿De qué sección hay que recogerlo?</p>
          <SectionGrid
            selectedCode={pickup?.code}
            processing={processing}
            onPick={(s) => {
              setPickup(s);
              setPickupStation(null);
              setStep(s.isSoldadura ? 'originStation' : 'destination');
            }}
          />
        </div>
      )}

      {/* ── Paso 3: destino ── */}
      {step === 'destination' && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-safe">
          <div className="bg-slate-800/60 rounded-2xl px-4 py-3 mb-3">
            <p className="text-xs text-slate-400">
              Recoger <span className="font-bold text-amber-300">{pickup?.name}{pickupStation ? ` · puesto ${pickupStation}` : ''}</span>
            </p>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">¿A qué sección va?</p>
          <SectionGrid
            selectedCode={destination?.code}
            processing={processing}
            onPick={(s) => {
              setDestination(s);
              if (s.isSoldadura) {
                setStep('destStation');
              } else {
                submit(s, null);
              }
            }}
          />
          {processing && (
            <div className="flex items-center justify-center gap-2 mt-4 text-orange-300 text-sm font-bold">
              <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              Enviando…
            </div>
          )}
        </div>
      )}

      {/* Puestos de soldadura (origen / destino) */}
      <SoldaduraStationPicker
        open={step === 'originStation'}
        variant="origen"
        selected={pickupStation}
        processing={processing}
        onBack={() => setStep('origin')}
        onSelect={(n) => { setPickupStation(n); setStep('destination'); }}
      />
      <SoldaduraStationPicker
        open={step === 'destStation'}
        variant="destino"
        selected={null}
        processing={processing}
        onBack={() => setStep('destination')}
        onSelect={(n) => { if (destination) submit(destination, n); }}
      />
    </div>
  );
};

export default RecogidaModal;
