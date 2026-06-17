import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useGlobalSearchWithCache, type GlobalSearchResult } from '../../hooks/useGlobalSearchWithCache';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';
import { parseScanInput, parseScanInputLenient } from '../../lib/qrParser';
import { REQUEST_SECTIONS, type RequestSection } from '../../lib/operative/requestSections';
import SoldaduraStationPicker from '../common/SoldaduraStationPicker';
import CameraQRScanner from '../common/CameraQRScanner';
const CameraOCRScanner = React.lazy(() => import('../common/CameraOCRScanner'));

export interface TraerSelection {
  articleCode: string;
  articleOrderFab: string;
  articleShelfCode: string;
  articleShelfName: string;
  articlePositions: string[];
  destination: { code: string; name: string; section: RequestSection['section']; station: number | null };
}

interface TraerArticuloModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selection: TraerSelection) => void;
  currentShelfCode: string;
  loading?: boolean;
  targetCarretilleroName?: string;
}

function formatPositionLabel(posStr: string): string {
  const idx = posStr.lastIndexOf('_');
  if (idx < 0) return posStr;
  const posShelfCode = posStr.slice(0, idx);
  const posNum = posStr.slice(idx + 1);
  const shelf = SHELF_DEFINITIONS.find((s) => s.code === posShelfCode);
  const shelfName = shelf?.name || posShelfCode;
  const num = parseInt(posNum, 10);
  return `${shelfName}, posición ${Number.isNaN(num) ? posNum : num}`;
}

function positionNumber(posStr: string): number {
  const idx = posStr.lastIndexOf('_');
  const raw = idx >= 0 ? posStr.slice(idx + 1) : posStr;
  const num = parseInt(raw, 10);
  if (Number.isNaN(num)) {
    console.warn(`[TraerArticuloModal] Invalid position number for "${posStr}"`);
    return 0; // Fallback a 0 en lugar de NaN
  }
  return num;
}

function shelfNameFor(code: string): string {
  return SHELF_DEFINITIONS.find((s) => s.code === code)?.name || code;
}

type InputMethod = 'search' | 'manual';

type Step = 'select' | 'destination' | 'destStation';

const TraerArticuloModal: React.FC<TraerArticuloModalProps> = ({
  open,
  onClose,
  onConfirm,
  currentShelfCode,
  loading = false,
  targetCarretilleroName,
}) => {
  const [step, setStep] = useState<Step>('select');
  const [destination, setDestination] = useState<RequestSection | null>(null);
  const [inputMethod, setInputMethod] = useState<InputMethod>('search');
  const [query, setQuery] = useState('');
  const [manualArticleCode, setManualArticleCode] = useState('');
  const [manualOrderFab, setManualOrderFab] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<GlobalSearchResult | null>(null);
  const [scannerBuffer, setScannerBuffer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [showCameraQR, setShowCameraQR] = useState(false);
  const [showCameraOCR, setShowCameraOCR] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const { results, loading: searching } = useGlobalSearchWithCache(debouncedQuery, currentShelfCode);

  useEffect(() => {
    if (open) {
      setStep('select');
      setDestination(null);
      setQuery('');
      setDebouncedQuery('');
      setSelected(null);
      setManualArticleCode('');
      setManualOrderFab('');
      setScannerBuffer('');
      setScanError(null);
      setInputMethod('search');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val), 200);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleSelect = useCallback((result: GlobalSearchResult) => {
    setSelected(result);
    setQuery(`${result.articleCode} ${result.orderFab}`.trim());
    setDebouncedQuery('');
  }, []);

  // Tras elegir el artículo ubicado → pasar a elegir destino.
  const handleGoToDestination = useCallback(() => {
    if (!selected) return;
    setStep('destination');
  }, [selected]);

  const submit = useCallback((dest: RequestSection, destStation: number | null) => {
    if (!selected) return;
    const articleShelfName = shelfNameFor(selected.shelfCode);
    const humanPositions = selected.positions
      .map((p) => {
        const num = positionNumber(p);
        return Number.isNaN(num) ? p : String(num);
      })
      .filter((v, i, arr) => arr.indexOf(v) === i);
    onConfirm({
      articleCode: selected.articleCode,
      articleOrderFab: selected.orderFab,
      articleShelfCode: selected.shelfCode,
      articleShelfName,
      articlePositions: humanPositions,
      destination: { code: dest.code, name: dest.name, section: dest.section, station: destStation },
    });
  }, [selected, onConfirm]);

  const buscarArticuloManual = useCallback((articleCode: string, orderFab: string) => {
    const q = `${articleCode} ${orderFab}`.trim();
    setDebouncedQuery(q);
    setQuery(q);
  }, []);

  const handleScannerKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = scannerBuffer.trim();
      if (!raw) return;

      const parsed = parseScanInput(raw);
      if (parsed.success) {
        setManualArticleCode(parsed.data.articleCode);
        setManualOrderFab(parsed.data.orderFab);
        setScannerBuffer('');
        setScanError(null);
        buscarArticuloManual(parsed.data.articleCode, parsed.data.orderFab);
        return;
      }

      const lenient = parseScanInputLenient(raw);
      if (lenient.success) {
        setManualArticleCode(lenient.data.articleCode);
        setManualOrderFab(lenient.data.orderFab);
        setScannerBuffer('');
        setScanError(null);
        buscarArticuloManual(lenient.data.articleCode, lenient.data.orderFab);
        return;
      }

      setScanError('error' in lenient ? lenient.error : 'Formato no reconocido');
      setScannerBuffer('');
    }
  }, [scannerBuffer, buscarArticuloManual]);

  const handleManualSearch = useCallback(() => {
    if (!manualArticleCode.trim()) return;
    const of = manualOrderFab.trim() || '';
    buscarArticuloManual(manualArticleCode.trim().toUpperCase(), of);
  }, [manualArticleCode, manualOrderFab, buscarArticuloManual]);

  const handleCameraQRScan = useCallback((qrCode: string) => {
    setShowCameraQR(false);
    const parsed = parseScanInput(qrCode);
    if (parsed.success) {
      setManualArticleCode(parsed.data.articleCode);
      setManualOrderFab(parsed.data.orderFab);
      setScanError(null);
      buscarArticuloManual(parsed.data.articleCode, parsed.data.orderFab);
      return;
    }
    const lenient = parseScanInputLenient(qrCode);
    if (lenient.success) {
      setManualArticleCode(lenient.data.articleCode);
      setManualOrderFab(lenient.data.orderFab);
      setScanError(null);
      buscarArticuloManual(lenient.data.articleCode, lenient.data.orderFab);
    } else {
      setScanError('QR no reconocido. Escanea un código con artículo y OF.');
    }
  }, [buscarArticuloManual]);

  const handleCameraOCRResult = useCallback((text: string) => {
    setShowCameraOCR(false);
    const result = parseScanInputLenient(text);
    if (result.success) {
      setManualArticleCode(result.data.articleCode);
      setManualOrderFab(result.data.orderFab);
      setScanError(null);
      buscarArticuloManual(result.data.articleCode, result.data.orderFab);
    } else {
      setScanError('OCR no reconoció artículo+OF. Corrige el texto manualmente.');
      setManualArticleCode(text);
    }
  }, [buscarArticuloManual]);

  const showResults = debouncedQuery.trim().length > 0 && !selected;

  const renderSearchResults = () => {
    if (!showResults) return null;
    return (
      <div className="space-y-2 mt-2">
        {searching && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!searching && results.length === 0 && debouncedQuery.trim() && (
          <div className="text-center py-10 bg-slate-900/60 rounded-2xl border border-slate-800">
            <p className="text-slate-400">No se encontró ningún artículo para <span className="text-white font-mono">"{debouncedQuery}"</span></p>
          </div>
        )}
        {!searching && results.map((result, idx) => {
          const shelf = shelfNameFor(result.shelfCode);
          const positions = result.positions
            .map((p) => {
              const num = positionNumber(p);
              return Number.isNaN(num) ? p : num;
            })
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .sort((a, b) => Number(a) - Number(b));

          return (
            <button
              key={`${result.aggregateKey}-${result.shelfCode}-${idx}`}
              onClick={() => handleSelect(result)}
              className={`w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.98] ${
                result.matchesCurrentShelf
                  ? 'bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-400/60'
                  : 'bg-slate-900/60 border-slate-700 hover:border-slate-500'}
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-black text-white text-lg font-mono leading-tight truncate">
                    {result.articleCode}
                  </p>
                  {result.orderFab && (
                    <p className="text-sm text-slate-400 font-mono mt-0.5">OF: {result.orderFab}</p>
                  )}
                </div>
                {result.matchesCurrentShelf && (
                  <span className="shrink-0 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 font-bold mt-1">
                    Esta estant.
                  </span>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">Ubicación:</p>
                <p className="text-sm text-slate-300 font-medium">{shelf}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {positions.length === 1 ? `Posición ${positions[0]}` : `Posiciones: ${positions.join(', ')}`}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderSelectedCard = () => {
    if (!selected || showResults) return null;
    return (
      <div className="mt-4 space-y-4">
        <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center shrink-0">
              <span className="text-2xl">📦</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-2xl font-mono leading-tight">
                {selected.articleCode}
              </p>
              {selected.orderFab && (
                <p className="text-base text-slate-400 font-mono mt-1">OF: {selected.orderFab}</p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ubicación actual</p>
            <div className="bg-slate-800/60 rounded-xl p-3">
              <p className="text-sm font-bold text-white">{shelfNameFor(selected.shelfCode)}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {selected.positions.map((p, i) => {
                  const num = positionNumber(p);
                  return (
                    <span key={i} className="text-xs bg-slate-700 text-slate-200 rounded-lg px-2 py-1 font-mono">
                      Pos. {Number.isNaN(num) ? p : num}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-xs text-amber-300">
              El carretillero recibirá un aviso para traer el artículo desde su ubicación hasta tu sección.
            </p>
          </div>
        </div>

        <button
          onClick={handleGoToDestination}
          disabled={loading}
          className="w-full h-16 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600
            text-white font-black text-xl shadow-lg shadow-amber-950/40
            active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
        >
          Siguiente: elegir destino →
        </button>

        <button
          onClick={() => { setSelected(null); setQuery(''); setDebouncedQuery(''); setInputMethod('search'); }}
          disabled={loading}
          className="w-full h-12 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-sm font-bold"
        >
          ← Buscar otro artículo
        </button>
      </div>
    );
  };

  const renderEmptyState = () => {
    if (showResults || selected) return null;
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-6xl mb-4">🔍</span>
        <p className="text-slate-400 font-medium">Escribe el artículo que necesitas</p>
        <p className="text-slate-600 text-sm mt-1">Busca por código de artículo o número de OF</p>
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
        <button
          onClick={step === 'select' ? onClose : () => setStep('select')}
          disabled={loading}
          className="text-rose-400 hover:text-white transition-colors p-1"
        >
          ← {step === 'select' ? 'Cancelar' : 'Volver'}
        </button>
        <h2 className="text-lg font-black text-white flex-1 text-center">
          {step === 'select' ? '📦 Traer artículo' : '🚚 ¿A dónde traerlo?'}
        </h2>
        <div className="w-20" />
      </div>

      {targetCarretilleroName && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-center">
          <span className="text-xs font-bold text-amber-300">🚜 Carretillero: {targetCarretilleroName}</span>
        </div>
      )}

      {/* ── Paso destino ── */}
      {step === 'destination' && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {selected && (
            <div className="bg-slate-800/60 rounded-2xl px-4 py-3 mb-3 flex items-center gap-3">
              <span className="text-2xl">📦</span>
              <div className="min-w-0">
                <p className="font-black text-white font-mono truncate">{selected.articleCode}</p>
                <p className="text-xs text-slate-400 font-mono">
                  {selected.orderFab ? `OF: ${selected.orderFab} · ` : ''}{shelfNameFor(selected.shelfCode)}
                </p>
              </div>
            </div>
          )}
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">¿A qué sección traerlo?</p>
          <div className="grid grid-cols-2 gap-2">
            {REQUEST_SECTIONS.map((opt) => (
              <button
                key={opt.code}
                onClick={() => {
                  setDestination(opt);
                  if (opt.isSoldadura) setStep('destStation');
                  else submit(opt, null);
                }}
                disabled={loading}
                className={`rounded-2xl border-2 px-3 py-4 text-center font-bold transition-all active:scale-95 disabled:opacity-50 ${
                  destination?.code === opt.code
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                    : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="block text-2xl mb-1">{opt.emoji}</span>
                <span className="block text-sm font-black">{opt.name}</span>
              </button>
            ))}
          </div>
          {loading && (
            <div className="flex items-center justify-center gap-2 mt-4 text-amber-300 text-sm font-bold">
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              Enviando…
            </div>
          )}
        </div>
      )}

      <SoldaduraStationPicker
        open={step === 'destStation'}
        variant="destino"
        selected={null}
        processing={loading}
        onBack={() => setStep('destination')}
        onSelect={(n) => { if (destination) submit(destination, n); }}
      />

      {/* ─── Tabs: Buscar / Escanear ─── */}
      {step === 'select' && (<>
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => { setInputMethod('search'); setScanError(null); }}
          className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${
            inputMethod === 'search'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-950/20'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          🔍 Buscar
        </button>
        <button
          onClick={() => { setInputMethod('manual'); setScanError(null); if (scannerInputRef.current) scannerInputRef.current.focus(); }}
          className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${
            inputMethod === 'manual'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-950/20'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          📸 Escanear / Escribir
        </button>
      </div>

      {/* ─── Content area ─── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {inputMethod === 'search' && (
          <>
            {/* Search input */}
            <div className="pt-4 pb-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">🔍</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={handleQueryChange}
                  placeholder="Buscar artículo o número de OF..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={loading}
                  className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-600 rounded-2xl
                    text-base text-white placeholder-slate-500 font-mono
                    focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none
                    transition-all disabled:opacity-50"
                />
                {query && (
                  <button onClick={() => { setQuery(''); setDebouncedQuery(''); setSelected(null); inputRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 hover:text-white text-lg"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 ml-1">Escribe el código o número de OF para encontrar el artículo</p>
            </div>
            {renderSearchResults()}
            {renderSelectedCard()}
            {renderEmptyState()}
          </>
        )}

        {inputMethod === 'manual' && (
          <>
            {/* Scanner input oculto para pistola USB */}
            <input
              ref={scannerInputRef}
              type="text"
              value={scannerBuffer}
              onChange={(e) => setScannerBuffer(e.target.value)}
              onKeyDown={handleScannerKeyDown}
              className="fixed -top-[100px] -left-[100px] w-1 h-1 opacity-0 pointer-events-none"
              autoComplete="off"
              autoCapitalize="characters"
            />

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Código del artículo</label>
                <input
                  type="text"
                  value={manualArticleCode}
                  onChange={(e) => setManualArticleCode(e.target.value.toUpperCase())}
                  placeholder="Ej: CL34712023"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl
                    text-base text-white placeholder-slate-500 font-mono
                    focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">OF (orden de fabricación)</label>
                <input
                  type="text"
                  value={manualOrderFab}
                  onChange={(e) => setManualOrderFab(e.target.value.toUpperCase())}
                  placeholder="Ej: OF25-07221"
                  autoComplete="off"
                  autoCorrect="off"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl
                    text-base text-white placeholder-slate-500 font-mono
                    focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                />
              </div>

              {scanError && (
                <p className="text-red-400 text-xs bg-red-950/30 border border-red-800/40 rounded-xl px-3 py-2">
                  {scanError}
                </p>
              )}

              <button
                onClick={handleManualSearch}
                disabled={!manualArticleCode.trim() || loading}
                className="w-full h-12 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-500 transition-colors disabled:opacity-50"
              >
                🔍 Buscar artículo
              </button>

              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-xs text-slate-500">O escanea con la cámara</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowCameraQR(true)}
                  disabled={loading}
                  className="flex-1 h-14 rounded-xl bg-cyan-700/40 border border-cyan-600/40 text-white font-bold
                    hover:bg-cyan-700/60 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="text-xl">📷</span> QR/Barras
                </button>
                <button
                  onClick={() => setShowCameraOCR(true)}
                  disabled={loading}
                  className="flex-1 h-14 rounded-xl bg-purple-700/40 border border-purple-600/40 text-white font-bold
                    hover:bg-purple-700/60 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="text-xl">📸</span> OCR
                </button>
              </div>

              <p className="text-xs text-slate-500 text-center">También puedes usar la pistola USB — escanea directamente</p>

              {renderSearchResults()}
              {renderSelectedCard()}
            </div>
          </>
        )}
      </div>
      </>)}

      {/* Camera scanners */}
      {showCameraQR && (
        <CameraQRScanner onScan={handleCameraQRScan} onClose={() => setShowCameraQR(false)} />
      )}
      {showCameraOCR && (
        <React.Suspense fallback={<div className="p-4 text-center">Cargando escáner OCR...</div>}>
          <CameraOCRScanner onResult={handleCameraOCRResult} onClose={() => setShowCameraOCR(false)} />
        </React.Suspense>
      )}
    </div>
  );
};

export default TraerArticuloModal;

