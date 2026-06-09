/**
 * BarcodeFormScanner — Flujo de TEXTO/CÓDIGO BARRAS con prefill "OF26-" y auto-fetch de artículo.
 *
 * Permite al usuario escanear o escribir el código de barras que sigue a "OF26-".
 * Completa automáticamente la OF y busca el artículo desde la API Swagger.
 */

import React, { useEffect, useState, useRef } from 'react';
import { getArticuloByOf } from '../../lib/api/controlOfProduccionApi';
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Enfocar el input de código de barras cuando se activa
  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus();
    }
  }, [active]);

  // Cuando cambia el código de barras, completar OF y buscar artículo
  const handleBarcodeChange = async (code: string) => {
    setBarcodeInput(code);
    if (!code.trim()) {
      setOfValue('OF26-');
      setArticleValue('');
      return;
    }

    // Completar OF con el código escaneado
    const completeOf = `OF26-${code.trim()}`;
    setOfValue(completeOf);

    // Buscar artículo automáticamente
    setFetching(true);
    try {
      const articulo = await getArticuloByOf(completeOf);
      if (articulo) {
        setArticleValue(articulo);
        // Auto-submit si se tiene artículo
        setTimeout(() => {
          if (articulo) {
            onScan({
              success: true,
              data: {
                articleCode: articulo,
                orderFab: completeOf,
              },
            });
            // Limpiar para el siguiente escaneo
            setBarcodeInput('');
            setOfValue('OF26-');
            setArticleValue('');
            if (inputRef.current) inputRef.current.focus();
          }
        }, 500);
      } else {
        setArticleValue('');
      }
    } finally {
      setFetching(false);
    }
  };

  // Manejar eventos de teclado (Enter para submit, ESC para limpiar)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && articleValue && !disabled) {
      onScan({
        success: true,
        data: {
          articleCode: articleValue,
          orderFab: ofValue,
        },
      });
      setBarcodeInput('');
      setOfValue('OF26-');
      setArticleValue('');
      if (inputRef.current) inputRef.current.focus();
    } else if (e.key === 'Escape') {
      setBarcodeInput('');
      setOfValue('OF26-');
      setArticleValue('');
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

          {/* Artículo - mostrará resultado de búsqueda o fetch en progreso */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Artículo</label>
            <div className="relative">
              <input
                type="text"
                value={articleValue}
                readOnly
                placeholder={fetching ? 'Buscando artículo...' : 'Se llenará automáticamente'}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-sm font-mono text-slate-700 focus:outline-none"
              />
              {fetching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {articleValue && !fetching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-lg">
                  ✓
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setBarcodeInput('');
              setOfValue('OF26-');
              setArticleValue('');
              if (inputRef.current) inputRef.current.focus();
            }}
            disabled={disabled || !barcodeInput}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold disabled:opacity-50 transition-colors"
          >
            🔄 Limpiar
          </button>
          <button
            onClick={() => {
              if (articleValue) {
                onScan({
                  success: true,
                  data: {
                    articleCode: articleValue,
                    orderFab: ofValue,
                  },
                });
                setBarcodeInput('');
                setOfValue('OF26-');
                setArticleValue('');
                if (inputRef.current) inputRef.current.focus();
              }
            }}
            disabled={disabled || !articleValue || fetching}
            className="flex-1 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-50 transition-colors"
          >
            {fetching ? '⏳' : '✓'} Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeFormScanner;
