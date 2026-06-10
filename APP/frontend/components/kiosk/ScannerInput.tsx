/**
 * ScannerInput — Entrada de escaneo manual + botones para QR/OCR
 * Maneja escaneo por teclado y permite abrir cámaras.
 *
 * Con dualField=true muestra dos campos separados: Código artículo + Nº OF,
 * lo que facilita la entrada manual sin necesidad de recordar el formato "// ".
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ScanParseResult } from '../../lib/qrParser';
import { parseScanInput } from '../../lib/qrParser';

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
}) => {
  // Modo single-field
  const [input, setInput] = useState('');

  // Modo dual-field
  const [articleInput, setArticleInput] = useState('');
  const [ofInput, setOfInput] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const ofRef = useRef<HTMLInputElement>(null);

  // Foco al activar
  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus();
    }
  }, [active]);

  // Limpiar al desactivar
  useEffect(() => {
    if (!active) {
      setInput('');
      setArticleInput('');
      setOfInput('');
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

  if (!active) return null;

  // ── Dual-field render ────────────────────────────────────────────────────

  if (dualField) {
    return (
      <div className="flex-shrink-0 bg-slate-900 border-t border-slate-800 p-4 space-y-2.5">
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
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 text-sm"
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
              className={`w-full px-3 py-2.5 bg-slate-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 disabled:opacity-50 text-sm ${ofOptional ? 'border-slate-600 focus:border-amber-500 focus:ring-amber-500' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500'}`}
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

        {showCameraButtons && (onOpenQRCamera || onOpenOCRCamera) && (
          <div className="flex gap-2">
            {onOpenQRCamera && (
              <button
                onClick={onOpenQRCamera}
                disabled={disabled}
                className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <span>📷</span> Barras
              </button>
            )}
            {onOpenOCRCamera && (
              <button
                onClick={onOpenOCRCamera}
                disabled={disabled}
                className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <span>📝</span> OCR
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Single-field render (modo pistola) ────────────────────────────────────

  return (
    <div className="flex-shrink-0 bg-slate-900 border-t border-slate-800 p-4 space-y-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escanea aquí o escribe..."
          disabled={disabled}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={() => {
            setInput('');
            inputRef.current?.focus();
          }}
          disabled={disabled || !input}
          className="px-3 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
        >
          ✕
        </button>
      </div>

      {showCameraButtons && (onOpenQRCamera || onOpenOCRCamera) && (
        <div className="flex gap-2">
          {onOpenQRCamera && (
            <button
              onClick={onOpenQRCamera}
              disabled={disabled}
              className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
            >
              <span>📷</span> Barras
            </button>
          )}
          {onOpenOCRCamera && (
            <button
              onClick={onOpenOCRCamera}
              disabled={disabled}
              className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
            >
              <span>📝</span> OCR
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ScannerInput;
