/**
 * NumericKeypad — Teclado numérico táctil para introducir ID de operario
 * Gestor de Estanterías WMS v3.0
 * 
 * Diseñado para tablets con botones grandes y fáciles de pulsar.
 */

import React, { useState, useCallback } from 'react';

interface NumericKeypadProps {
  /** Valor actual */
  value: string;
  /** Callback al cambiar el valor */
  onChange: (value: string) => void;
  /** Callback al confirmar (pulsar Enter/✓) */
  onConfirm: () => void;
  /** Máximo de dígitos permitidos */
  maxDigits?: number;
  /** Si está deshabilitado */
  disabled?: boolean;
  /** Placeholder del display */
  placeholder?: string;
  /** Mensaje de error a mostrar */
  error?: string | null;
  /** Si está cargando */
  loading?: boolean;
}

const NumericKeypad: React.FC<NumericKeypadProps> = ({
  value,
  onChange,
  onConfirm,
  maxDigits = 3,
  disabled = false,
  placeholder = 'Introduce tu nº de empleado',
  error = null,
  loading = false,
}) => {
  const handleDigit = useCallback((digit: string) => {
    if (disabled || loading) return;
    if (value.length >= maxDigits) return;
    onChange(value + digit);
  }, [value, maxDigits, disabled, loading, onChange]);

  const handleBackspace = useCallback(() => {
    if (disabled || loading) return;
    onChange(value.slice(0, -1));
  }, [value, disabled, loading, onChange]);

  const handleClear = useCallback(() => {
    if (disabled || loading) return;
    onChange('');
  }, [disabled, loading, onChange]);

  const handleConfirm = useCallback(() => {
    if (disabled || loading || !value) return;
    onConfirm();
  }, [disabled, loading, value, onConfirm]);

  const buttons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['C', '0', '⌫'],
  ];

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
      {/* Display */}
      <div className="relative">
        <div
          className={`
            w-full h-20 flex items-center justify-center rounded-2xl border-2 
            text-4xl font-black tracking-[0.3em] transition-all
            ${error
              ? 'border-red-400 bg-red-50 text-red-600'
              : value
                ? 'border-cyan-500 bg-cyan-50 text-slate-900'
                : 'border-slate-200 bg-slate-50 text-slate-400'
            }
          `}
        >
          {value || (
            <span className="text-base font-medium tracking-normal text-slate-400">
              {placeholder}
            </span>
          )}
        </div>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-center text-sm font-bold text-red-500 animate-shake px-2">
          {error}
        </div>
      )}

      {/* Keypad grid */}
      <div className="grid grid-cols-3 gap-3">
        {buttons.flat().map((btn, i) => {
          if (btn === 'C') {
            return (
              <button
                key={btn}
                type="button"
                onClick={handleClear}
                disabled={disabled || loading || !value}
                className="h-16 rounded-xl bg-slate-200 text-slate-600 text-xl font-bold 
                  active:scale-95 active:bg-slate-300 transition-all disabled:opacity-40
                  hover:bg-slate-300"
              >
                AC
              </button>
            );
          }
          if (btn === '⌫') {
            return (
              <button
                key={btn}
                type="button"
                onClick={handleBackspace}
                disabled={disabled || loading || !value}
                className="h-16 rounded-xl bg-slate-200 text-slate-600 text-2xl font-bold
                  active:scale-95 active:bg-slate-300 transition-all disabled:opacity-40
                  hover:bg-slate-300"
              >
                ⌫
              </button>
            );
          }
          return (
            <button
              key={btn}
              type="button"
              onClick={() => handleDigit(btn)}
              disabled={disabled || loading || value.length >= maxDigits}
              className="h-16 rounded-xl bg-white border-2 border-slate-200 text-slate-800 
                text-2xl font-black shadow-sm
                active:scale-95 active:bg-cyan-50 active:border-cyan-400 transition-all 
                disabled:opacity-40 hover:border-cyan-300 hover:bg-cyan-50/50"
            >
              {btn}
            </button>
          );
        })}
      </div>

      {/* Confirm button */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={disabled || loading || !value}
        className={`
          w-full h-16 rounded-2xl text-xl font-black shadow-lg transition-all
          active:scale-[0.98]
          ${value && !disabled && !loading
            ? 'bg-emerald-500 text-white hover:bg-emerald-400 active:bg-emerald-600'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-3">
            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
            Verificando...
          </span>
        ) : (
          'CONFIRMAR ✓'
        )}
      </button>
    </div>
  );
};

export default NumericKeypad;


