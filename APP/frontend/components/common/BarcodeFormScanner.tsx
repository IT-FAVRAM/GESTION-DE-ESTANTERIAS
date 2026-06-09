/**
 * BarcodeFormScanner — Flujo de TEXTO/CÓDIGO BARRAS con prefill "OF26-" y auto-fetch de artículo.
 *
 * Permite al usuario escanear o escribir el código de barras que sigue a "OF26-".
 * Completa automáticamente la OF y busca el artículo desde la API Swagger.
 */

import React, { useEffect, useState, useRef } from 'react';
import type { ScanParseResult } from '../../lib/qrParser';

interface BarcodeFormScannerProps {
  active: boolean;
  disabled: boolean;
  onScan: (result: ScanParseResult) => void;
}

const BarcodeFormScanner: React.FC<BarcodeFormScannerProps> = ({
  active,
  disabled,
  onScan,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [ofValue, setOfValue] = useState('OF26-');
  const [articleValue, setArticleValue] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount or when active changes to false
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Cleanup and focus when active changes
  useEffect(() => {
    if (!active) {
      // Cleanup when component is hidden
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }
    // Focus when component becomes active
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [active]);

  // Cuando cambia el código de barras, simplemente completar OF
  // No hacemos búsqueda automática (evita problemas de CORS y API)
  const handleBarcodeChange = (code: string) => {
    setBarcodeInput(code);
    setError(null);

    if (!code.trim()) {
      setOfValue('OF26-');
      setArticleValue('');
      return;
    }

    // Completar OF con el código escaneado
    const completeOf = `OF26-${code.trim()}`;
    setOfValue(completeOf);

    // IMPORTANTE: No buscamos artículo automáticamente
    // El usuario ingresa el artículo manualmente o presiona Enter para confirmar
  };

  // Manejar eventos de teclado (Enter para submit, ESC para limpiar)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !disabled) {
      // Permitir submit incluso sin artículo (es opcional)
      if (ofValue && ofValue !== 'OF26-') {
        onScan({
          success: true,
          data: {
            articleCode: articleValue || '',
            orderFab: ofValue,
          },
        });
        setBarcodeInput('');
        setOfValue('OF26-');
        setArticleValue('');
        if (inputRef.current) inputRef.current.focus();
      }
    } else if (e.key === 'Escape') {
      setBarcodeInput('');
      setOfValue('OF26-');
      setArticleValue('');
      setError(null);
    }
  };

  if (!active) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50">
      <div className="px-4 py-4 space-y-3">
        {/* Barra informativa */}
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
          <p className="text-xs text-cyan-900 font-bold">📝 Escanea o escribe el código (sin "OF26-")</p>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-xs text-red-700 font-bold">❌ {error}</p>
          </div>
        )}

        {/* Campos de entrada */}
        <div className="space-y-2">
          {/* OF - readonly */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Orden de Fabricación</label>
            <div className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-300 text-sm font-mono text-slate-700">
              {ofValue}
            </div>
          </div>

          {/* Código de barras */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Código de barras</label>
            <input
              ref={inputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => handleBarcodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder="Escanea aquí o escribe el código"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50"
            />
          </div>

          {/* Artículo - campo de entrada manual */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Artículo (opcional)</label>
            <input
              type="text"
              value={articleValue}
              onChange={(e) => setArticleValue(e.target.value)}
              disabled={disabled}
              placeholder="Ingresa el código de artículo (ej: 27894-05)"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (abortControllerRef.current) abortControllerRef.current.abort();
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              setBarcodeInput('');
              setOfValue('OF26-');
              setArticleValue('');
              setError(null);
              if (inputRef.current) inputRef.current.focus();
            }}
            disabled={disabled || !barcodeInput}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold disabled:opacity-50 transition-colors"
          >
            🔄 Limpiar
          </button>
          <button
            onClick={() => {
              // Permitir confirmar con solo OF (artículo es opcional)
              if (ofValue && ofValue !== 'OF26-') {
                onScan({
                  success: true,
                  data: {
                    articleCode: articleValue || '',
                    orderFab: ofValue,
                  },
                });
                setBarcodeInput('');
                setOfValue('OF26-');
                setArticleValue('');
                setError(null);
                if (inputRef.current) inputRef.current.focus();
              }
            }}
            disabled={disabled || !ofValue || ofValue === 'OF26-'}
            className="flex-1 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-50 transition-colors"
          >
            ✓ Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeFormScanner;
