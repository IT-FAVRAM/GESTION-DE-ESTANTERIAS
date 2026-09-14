/**
 * ScannerInput — Entrada de escaneo manual + botones para QR/OCR
 * Maneja escaneo por teclado y permite abrir cámaras.
 *
 * Con dualField=true muestra dos campos separados: Código artículo + Nº OF,
 * lo que facilita la entrada manual sin necesidad de recordar el formato "// ".
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, Keyboard, ScanBarcode, ScanText } from 'lucide-react';
import type { ScanParseResult } from '../../lib/qrParser';
import { parseScanInput } from '../../lib/qrParser';
import { FEATURE_CAMERA_QR_SCAN } from '../../lib/featureFlags';
import { useOfLookup } from '../../hooks/useOfLookup';
import OfLookupIndicator from '../erp/OfLookupIndicator';
import type { ErpOfArticle } from '../../lib/erp/ofLookupApi';
import { canonicalOrderFab, defaultOfPrefix, isBareOfPrefix, isOverlongOf } from '../../lib/erp/ofNormalize';

interface ScannerInputProps {
  onScan: (result: ScanParseResult) => void;
  active: boolean;
  disabled?: boolean;
  onOpenQRCamera?: () => void;
  onOpenOCRCamera?: () => void;
  /** Si false, solo muestra input de pistola/teclado (cámara vía ScanMethodPicker). */
  showCameraButtons?: boolean;
  /**
   * Si true, muestra dos campos separados (Código artículo + Nº OF) en lugar
   * del campo único de formato "ARTÍCULO // OFxx-nnnnn".
   * Fallback: si el campo artículo contiene "//", usa parseScanInput directamente
   * (compatibilidad con pistola de barras que escanea todo de una vez).
   */
  dualField?: boolean;
  /** Si true, el campo OF es opcional (flujo calidad: "sin OF"). */
  ofOptional?: boolean;
  /** Modo kiosko: centrar el formulario en medio de la pantalla. */
  kioskMode?: boolean;
  /**
   * Título del formulario grande de kiosko según la acción en curso
   * ("Ubicar artículo", "Retirar artículo", "Mover artículo"...). Antes estaba
   * fijo en "Ubicar artículo" aunque se usara para retirar/mover.
   */
  kioskTitle?: string;
  /** Verbo del botón de confirmar del formulario grande ("Ubicar", "Retirar"...). */
  kioskConfirmVerb?: string;
  /**
   * Cancela la acción en curso (tablet: hace falta una salida siempre visible,
   * el modal de kiosko tapa la barra de "Cancelar" de detrás). Si se define,
   * el modal de kiosko muestra un botón de cerrar y también cancela al tocar
   * fuera del recuadro.
   */
  onCancel?: () => void;
}

const ScannerInput: React.FC<ScannerInputProps> = ({
  onScan,
  active,
  disabled = false,
  onOpenQRCamera,
  onOpenOCRCamera,
  showCameraButtons = true,
  dualField = false,
  ofOptional = false,
  kioskMode = false,
  kioskTitle = 'Ubicar artículo',
  kioskConfirmVerb = 'Ubicar',
  onCancel,
}) => {
  // Modo single-field
  const [input, setInput] = useState('');

  // Modo dual-field
  const [articleInput, setArticleInput] = useState('');
  const [ofInput, setOfInput] = useState(() => (ofOptional ? '' : defaultOfPrefix()));
  // Error de validación del propio formulario. En kiosko el formulario es un
  // modal que tapa el aviso general de la pantalla: sin esto el operario no veía
  // por qué no se aceptaba lo que había escrito.
  const [formError, setFormError] = useState<string | null>(null);

  // Modo texto libre
  const [freeTextMode, setFreeTextMode] = useState(false);
  const [freeTextArticle, setFreeTextArticle] = useState('');
  const [freeTextReference, setFreeTextReference] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const ofRef = useRef<HTMLInputElement>(null);
  const freeTextArticleRef = useRef<HTMLInputElement>(null);
  const freeTextRefRef = useRef<HTMLInputElement>(null);

  // Foco al activar. Con dual-field la OF va primero (el artículo llega solo
  // desde el ERP) tanto en kiosko como fuera de él, así que el foco inicial es
  // el campo OF en cualquier pantalla donde se ubique por texto.
  useEffect(() => {
    if (!active) return;
    if (dualField) {
      ofRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [active, dualField]);

  // ── Autorrelleno del artículo desde el ERP ───────────────────────────────
  // El operario teclea la OF y el artículo llega solo. Nunca pisa lo que el
  // operario haya escrito a mano, pero SÍ actualiza si el valor actual es el
  // que puso el propio autorrelleno (para que cambiar de OF refresque el
  // artículo en vez de quedarse pegado al de la OF anterior).
  //
  // El chequeo se hace fuera del updater de setState a propósito: React (en
  // desarrollo/StrictMode) invoca dos veces la función de un updater
  // funcional, y mutar la ref ahí dentro hacía que la 2ª invocación viera la
  // ref ya cambiada por la 1ª y deshiciera la actualización.
  const articleInputRef = useRef(articleInput);
  useEffect(() => {
    articleInputRef.current = articleInput;
  }, [articleInput]);

  const lastAutoFilledRef = useRef<string | null>(null);

  const applyErpArticle = useCallback((article: ErpOfArticle) => {
    const code = article.code.toUpperCase();
    lastAutoFilledRef.current = code;
    setArticleInput(code);
  }, []);

  const ofLookup = useOfLookup(ofInput, {
    enabled: dualField && !ofOptional,
    onResolved: (article) => {
      const code = article.code.toUpperCase();
      const current = articleInputRef.current;
      const untouched = current.trim() === '' || current === lastAutoFilledRef.current;
      if (untouched) {
        lastAutoFilledRef.current = code;
        setArticleInput(code);
      }
    },
  });

  // Limpiar al desactivar
  useEffect(() => {
    if (!active) {
      setInput('');
      setArticleInput('');
      setOfInput(ofOptional ? '' : defaultOfPrefix());
      lastAutoFilledRef.current = null;
      setFormError(null);
      setFreeTextMode(false);
      setFreeTextArticle('');
      setFreeTextReference('');
    }
  }, [active, ofOptional]);

  // ── Single-field handler ─────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim()) {
        const result = parseScanInput(input.trim());
        onScan(result);
        setInput('');
        inputRef.current?.focus();
      }
    }
  };

  // ── Dual-field handlers ──────────────────────────────────────────────────

  const handleDualSubmit = () => {
    const article = articleInput.trim().toUpperCase();
    const ofRaw = ofInput.trim().toUpperCase();
    // El prefijo del año sin número detrás ("OF26-", "OF26") cuenta como vacío.
    // Lo demás se guarda canónico: "OF26-0461 9" → "OF26-04619".
    const of = isBareOfPrefix(ofRaw) ? '' : canonicalOrderFab(ofRaw);

    // Fallback: la pistola escaneó el código completo con "//" de una vez.
    // Puede caer en cualquiera de los dos campos según cuál tuviera el foco
    // (la OF va primero y se enfoca sola, pero un doble-scan rápido podría
    // pillar el artículo con foco todavía).
    const scannedCombined = article.includes('//') ? article : ofRaw.includes('//') ? ofRaw : null;
    if (scannedCombined) {
      const result = parseScanInput(scannedCombined);
      onScan(result);
      setArticleInput('');
      setOfInput(ofOptional ? '' : defaultOfPrefix());
      lastAutoFilledRef.current = null;
      ofRef.current?.focus();
      return;
    }

    const reject = (error: string) => {
      setFormError(error);
      onScan({ success: false, error, rawInput: article });
    };

    if (!article) {
      reject('El código del artículo es obligatorio');
      return;
    }

    if (!of && !ofOptional) {
      reject('Falta el número de la OF');
      return;
    }

    if (isOverlongOf(of)) {
      reject(`La OF "${of}" tiene más de 5 dígitos. ¿Se ha pegado el artículo detrás?`);
      return;
    }

    setFormError(null);

    onScan({
      success: true,
      data: { articleCode: article, orderFab: of || 'SIN-OF' },
    });
    setArticleInput('');
    setOfInput(ofOptional ? '' : defaultOfPrefix());
    lastAutoFilledRef.current = null;
    ofRef.current?.focus();
  };

  // La OF va siempre primero (se teclea antes: el artículo llega solo desde
  // el ERP), tanto en kiosko como fuera de él — mismo comportamiento en
  // cualquier pantalla donde se ubique por texto.
  // Enter en la OF pasa al artículo; Enter en el artículo confirma.
  const handleOfKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Si la pistola escaneó el código completo con "//" y cayó aquí
      // (la OF tiene el foco por defecto), procesar directamente.
      if (ofInput.includes('//')) {
        handleDualSubmit();
        return;
      }
      inputRef.current?.focus();
    }
  };

  const handleArticleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDualSubmit();
    }
  };

  // Al entrar al campo con el prefijo precargado ("OF26-"), deja el cursor al
  // final para que el operario siga escribiendo los dígitos sin tener que
  // moverlo él mismo.
  const handleOfFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.target;
    const end = el.value.length;
    requestAnimationFrame(() => el.setSelectionRange(end, end));
  };

  // ── Handlers para modo texto libre ───────────────────────────────────────

  const handleFreeTextSubmit = () => {
    const article = freeTextArticle.trim();
    const reference = freeTextReference.trim();

    if (!article) {
      onScan({ success: false, error: 'El nombre/descripción del artículo es obligatorio', rawInput: '' });
      return;
    }

    onScan({
      success: true,
      data: { articleCode: article.toUpperCase(), orderFab: reference.toUpperCase() || 'SIN-REF' },
    });
    setFreeTextMode(false);
    setFreeTextArticle('');
    setFreeTextReference('');
    // Volver al input principal si no estamos en dualField
    if (!dualField) {
      inputRef.current?.focus();
    }
  };

  const handleFreeTextArticleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      freeTextRefRef.current?.focus();
    }
  };

  const handleFreeTextRefKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFreeTextSubmit();
    }
  };

  if (!active) return null;

  // ── Modo texto libre render ──────────────────────────────────────────────

  if (freeTextMode) {
    return (
      <div className="flex-shrink-0 bg-white border-t-2 border-purple-500 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] p-4 space-y-2.5">
        <div className="flex gap-2 items-stretch">
          <div className="flex-1 flex flex-col gap-1.5">
            <input
              ref={freeTextArticleRef}
              type="text"
              value={freeTextArticle}
              onChange={(e) => setFreeTextArticle(e.target.value)}
              onKeyDown={handleFreeTextArticleKeyDown}
              placeholder="Nombre/Descripción artículo (ej: TORNILLOS M6x20)"
              disabled={disabled}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:opacity-50 text-sm"
            />
            <input
              ref={freeTextRefRef}
              type="text"
              value={freeTextReference}
              onChange={(e) => setFreeTextReference(e.target.value)}
              onKeyDown={handleFreeTextRefKeyDown}
              placeholder="Referencia/Nota (opcional, ej: CAJA-001)"
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="w-full px-3 py-2.5 bg-slate-50 border border-amber-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50 text-sm"
            />
          </div>
          <button
            onClick={handleFreeTextSubmit}
            disabled={disabled || !freeTextArticle.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-black text-lg transition-colors shrink-0 flex items-center justify-center"
            aria-label="Confirmar"
          >
            <Check className="w-6 h-6" strokeWidth={3} aria-hidden />
          </button>
        </div>
        <button
          onClick={() => {
            setFreeTextMode(false);
            setFreeTextArticle('');
            setFreeTextReference('');
            inputRef.current?.focus();
          }}
          disabled={disabled}
          className="w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg font-bold transition-colors"
        >
          ← Volver al escáner
        </button>
      </div>
    );
  }

  // ── Dual-field render ────────────────────────────────────────────────────

  if (dualField) {
    // En modo kiosko, centrar el formulario en la pantalla
    if (kioskMode) {
      return (
        <div
          className="fixed inset-0 z-[50] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
          onClick={(e) => {
            // Tocar fuera del recuadro cancela, igual que el botón ✕ (en tablet
            // no hay "atrás"; el estado de detrás queda tapado por este modal).
            if (e.target === e.currentTarget) onCancel?.();
          }}
        >
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-cyan-300 p-6 space-y-4">
            {onCancel && (
              <button
                onClick={onCancel}
                disabled={disabled}
                aria-label="Cancelar"
                className="absolute top-3 right-3 h-9 w-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-black disabled:opacity-50"
              >
                ✕
              </button>
            )}
            <h2 className="text-center text-2xl font-black text-slate-900">{kioskTitle}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-black text-cyan-700 mb-1 uppercase tracking-wide">
                  {ofOptional ? 'Nº OF (opcional)' : 'Nº Orden de Fabricación'}
                </label>
                <input
                  ref={ofRef}
                  type="text"
                  value={ofInput}
                  onChange={(e) => { setOfInput(e.target.value); setFormError(null); }}
                  onKeyDown={handleOfKeyDown}
                  onFocus={handleOfFocus}
                  placeholder={ofOptional ? 'Sin OF (opcional)' : 'OF25-1234'}
                  disabled={disabled}
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className={`w-full px-4 py-4 text-3xl font-black tracking-wide text-center bg-slate-50 border-2 rounded-xl text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-4 disabled:opacity-50 ${ofOptional ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/30' : 'border-cyan-400 focus:border-cyan-500 focus:ring-cyan-500/30'}`}
                />
                <OfLookupIndicator
                  status={ofLookup.status}
                  article={ofLookup.article}
                  articles={ofLookup.articles}
                  normalizedOf={ofLookup.normalizedOf}
                  typedArticle={articleInput}
                  onPickArticle={applyErpArticle}
                  tone="light"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">
                  Código artículo
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={articleInput}
                  onChange={(e) => { setArticleInput(e.target.value); setFormError(null); }}
                  onKeyDown={handleArticleKeyDown}
                  placeholder="Se rellena solo al escribir la OF"
                  disabled={disabled}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="w-full px-4 py-2.5 text-base bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                />
              </div>
            </div>
            {formError && (
              <p role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                {formError}
              </p>
            )}
            <div className="flex gap-2">
              {onCancel && (
                <button
                  onClick={onCancel}
                  disabled={disabled}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 rounded-lg font-bold transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={handleDualSubmit}
                disabled={disabled || !articleInput.trim()}
                className="flex-1 px-4 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg font-black text-xl transition-colors"
              >
                {kioskConfirmVerb}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-shrink-0 bg-white border-t-2 border-cyan-500 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] p-4 space-y-2.5">
        <div className="flex gap-2 items-stretch">
          <div className="flex-1 flex flex-col gap-1.5">
            <input
              ref={ofRef}
              type="text"
              value={ofInput}
              onChange={(e) => { setOfInput(e.target.value); setFormError(null); }}
              onKeyDown={handleOfKeyDown}
              onFocus={handleOfFocus}
              placeholder={ofOptional ? "Sin OF (opcional)" : "Nº OF (ej: OF25-1234)"}
              disabled={disabled}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={`w-full px-3 py-2.5 bg-slate-50 border-2 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 disabled:opacity-50 text-base font-bold ${ofOptional ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500' : 'border-cyan-400 focus:border-cyan-500 focus:ring-cyan-500'}`}
            />
            <OfLookupIndicator
              status={ofLookup.status}
              article={ofLookup.article}
              articles={ofLookup.articles}
              normalizedOf={ofLookup.normalizedOf}
              typedArticle={articleInput}
              onPickArticle={applyErpArticle}
              tone="light"
            />
            <input
              ref={inputRef}
              type="text"
              value={articleInput}
              onChange={(e) => { setArticleInput(e.target.value); setFormError(null); }}
              onKeyDown={handleArticleKeyDown}
              placeholder="Código artículo (se rellena solo)"
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 text-sm"
            />
          </div>
          <button
            onClick={handleDualSubmit}
            disabled={disabled || !articleInput.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg font-black text-lg transition-colors shrink-0 flex items-center justify-center"
            aria-label="Confirmar"
          >
            <Check className="w-6 h-6" strokeWidth={3} aria-hidden />
          </button>
        </div>

        <div className="flex gap-2">
          {FEATURE_CAMERA_QR_SCAN && showCameraButtons && onOpenQRCamera && (
            <button
              onClick={onOpenQRCamera}
              disabled={disabled}
              className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
            >
              <ScanBarcode className="w-5 h-5" aria-hidden /> Barras
            </button>
          )}
          {showCameraButtons && onOpenOCRCamera && (
            <button
              onClick={onOpenOCRCamera}
              disabled={disabled}
              className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
            >
              <ScanText className="w-5 h-5" aria-hidden /> OCR
            </button>
          )}
          <button
            onClick={() => {
              setFreeTextMode(true);
              setFreeTextArticle('');
              setFreeTextReference('');
            }}
            disabled={disabled}
            className="flex-1 px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Keyboard className="w-5 h-5" aria-hidden /> Texto libre
          </button>
        </div>
      </div>
    );
  }

  // ── Single-field render (modo pistola) ────────────────────────────────────

  return (
    <div className="flex-shrink-0 bg-white border-t-2 border-cyan-500 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] p-4 space-y-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escanea aquí o escribe..."
          disabled={disabled}
          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={() => {
            setInput('');
            inputRef.current?.focus();
          }}
          disabled={disabled || !input}
          className="px-3 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex gap-2">
        {showCameraButtons && onOpenQRCamera && (
          <button
            onClick={onOpenQRCamera}
            disabled={disabled}
            className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
          >
            <ScanBarcode className="w-5 h-5" aria-hidden /> Barras
          </button>
        )}
        {showCameraButtons && onOpenOCRCamera && (
          <button
            onClick={onOpenOCRCamera}
            disabled={disabled}
            className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
          >
            <ScanText className="w-5 h-5" aria-hidden /> OCR
          </button>
        )}
        <button
          onClick={() => {
            setFreeTextMode(true);
            setFreeTextArticle('');
            setFreeTextReference('');
          }}
          disabled={disabled}
          className="flex-1 px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
        >
          <Keyboard className="w-5 h-5" aria-hidden /> Texto libre
        </button>
      </div>
    </div>
  );
};

export default ScannerInput;
