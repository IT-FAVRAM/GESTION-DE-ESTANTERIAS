/**
 * ScannerInput — Entrada de escaneo manual + botones para QR/OCR
 * Maneja escaneo por teclado y permite abrir cámaras.
 *
 * Con dualField=true muestra dos campos separados: Código artículo + Nº OF,
 * lo que facilita la entrada manual sin necesidad de recordar el formato "// ".
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ScanParseResult } from '../../lib/qrParser';
import { parseScanInput } from '../../lib/qrParser';
import { FEATURE_CAMERA_QR_SCAN } from '../../lib/featureFlags';
import { useOfLookup } from '../../hooks/useOfLookup';
import OfLookupIndicator from '../erp/OfLookupIndicator';
import type { ErpOfArticle } from '../../lib/erp/ofLookupApi';

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
}) => {
  // Modo single-field
  const [input, setInput] = useState('');

  // Modo dual-field
  const [articleInput, setArticleInput] = useState('');
  const [ofInput, setOfInput] = useState('');

  // Modo texto libre
  const [freeTextMode, setFreeTextMode] = useState(false);
  const [freeTextArticle, setFreeTextArticle] = useState('');
  const [freeTextReference, setFreeTextReference] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const ofRef = useRef<HTMLInputElement>(null);
  const freeTextArticleRef = useRef<HTMLInputElement>(null);
  const freeTextRefRef = useRef<HTMLInputElement>(null);

  // Foco al activar
  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus();
    }
  }, [active]);

  // ── Autorrelleno del artículo desde el ERP ───────────────────────────────
  // El operario teclea la OF y el artículo llega solo. Solo rellena si el campo
  // está vacío: jamás pisa lo que haya escrito o escaneado.
  const applyErpArticle = useCallback((article: ErpOfArticle) => {
    setArticleInput(article.code.toUpperCase());
  }, []);

  const ofLookup = useOfLookup(ofInput, {
    enabled: dualField && !ofOptional,
    onResolved: (article) => {
      setArticleInput((current) => (current.trim() ? current : article.code.toUpperCase()));
    },
  });

  // Limpiar al desactivar
  useEffect(() => {
    if (!active) {
      setInput('');
      setArticleInput('');
      setOfInput('');
      setFreeTextMode(false);
      setFreeTextArticle('');
      setFreeTextReference('');
    }
  }, [active]);

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
    const of = ofInput.trim().toUpperCase();

    if (!article) {
      onScan({ success: false, error: 'El código del artículo es obligatorio', rawInput: '' });
      return;
    }

    // Fallback: pistola escaneó todo junto en el campo artículo (contiene "//")
    if (article.includes('//')) {
      const combined = of ? article : article;
      const result = parseScanInput(combined);
      onScan(result);
      setArticleInput('');
      setOfInput('');
      inputRef.current?.focus();
      return;
    }

    if (!of && !ofOptional) {
      onScan({ success: false, error: 'El campo Nº OF es obligatorio', rawInput: article });
      return;
    }

    onScan({
      success: true,
      data: { articleCode: article, orderFab: of || 'SIN-OF' },
    });
    setArticleInput('');
    setOfInput('');
    inputRef.current?.focus();
  };

  const handleArticleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Si la pistola escaneó el código completo con "//", procesar directamente
      if (articleInput.includes('//')) {
        handleDualSubmit();
        return;
      }
      // Si no, pasar al campo OF
      ofRef.current?.focus();
    }
  };

  const handleOfKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDualSubmit();
    }
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
          >
            ✅
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
        <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-cyan-300 p-6 space-y-4">
            <h2 className="text-center text-2xl font-black text-slate-900">Ubicar artículo</h2>
            <div className="space-y-2.5">
              <input
                ref={inputRef}
                type="text"
                value={articleInput}
                onChange={(e) => setArticleInput(e.target.value)}
                onKeyDown={handleArticleKeyDown}
                placeholder="Código artículo"
                disabled={disabled}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="w-full px-4 py-3 text-lg bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              />
              <input
                ref={ofRef}
                type="text"
                value={ofInput}
                onChange={(e) => setOfInput(e.target.value)}
                onKeyDown={handleOfKeyDown}
                placeholder={ofOptional ? "Sin OF (opcional)" : "Nº OF  (ej: OF25-1234)"}
                disabled={disabled}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={`w-full px-4 py-3 text-lg bg-slate-50 border rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 disabled:opacity-50 ${ofOptional ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500' : 'border-slate-300 focus:border-cyan-500 focus:ring-cyan-500'}`}
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
            <button
              onClick={handleDualSubmit}
              disabled={disabled || !articleInput.trim()}
              className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg font-black text-xl transition-colors"
            >
              ✅ Ubicar
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-shrink-0 bg-white border-t-2 border-cyan-500 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] p-4 space-y-2.5">
        <div className="flex gap-2 items-stretch">
          <div className="flex-1 flex flex-col gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={articleInput}
              onChange={(e) => setArticleInput(e.target.value)}
              onKeyDown={handleArticleKeyDown}
              placeholder="Código artículo"
              disabled={disabled}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 text-sm"
            />
            <input
              ref={ofRef}
              type="text"
              value={ofInput}
              onChange={(e) => setOfInput(e.target.value)}
              onKeyDown={handleOfKeyDown}
              placeholder={ofOptional ? "Sin OF (opcional)" : "Nº OF  (ej: OF25-1234)"}
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={`w-full px-3 py-2.5 bg-slate-50 border rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 disabled:opacity-50 text-sm ${ofOptional ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500' : 'border-slate-300 focus:border-cyan-500 focus:ring-cyan-500'}`}
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
          <button
            onClick={handleDualSubmit}
            disabled={disabled || !articleInput.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg font-black text-lg transition-colors shrink-0 flex items-center justify-center"
          >
            ✅
          </button>
        </div>

        <div className="flex gap-2">
          {FEATURE_CAMERA_QR_SCAN && showCameraButtons && onOpenQRCamera && (
            <button
              onClick={onOpenQRCamera}
              disabled={disabled}
              className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
            >
              <span>📷</span> Barras
            </button>
          )}
          {showCameraButtons && onOpenOCRCamera && (
            <button
              onClick={onOpenOCRCamera}
              disabled={disabled}
              className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
            >
              <span>📝</span> OCR
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
            <span>✏️</span> Texto libre
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
            <span>📷</span> Barras
          </button>
        )}
        {showCameraButtons && onOpenOCRCamera && (
          <button
            onClick={onOpenOCRCamera}
            disabled={disabled}
            className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
          >
            <span>📝</span> OCR
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
          <span>✏️</span> Texto libre
        </button>
      </div>
    </div>
  );
};

export default ScannerInput;
