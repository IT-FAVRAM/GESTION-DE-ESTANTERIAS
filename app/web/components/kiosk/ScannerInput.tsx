/**
 * ScannerInput — Entrada de escaneo manual + botones para QR/OCR
 * Maneja escaneo por teclado y permite abrir cámaras
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
}

const ScannerInput: React.FC<ScannerInputProps> = ({
  onScan,
  active,
  disabled = false,
  onOpenQRCamera,
  onOpenOCRCamera,
}) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus();
    }
  }, [active]);

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

  if (!active) return null;

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
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
        >
          ✕
        </button>
      </div>

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
            <span>📸</span> OCR
          </button>
        )}
      </div>
    </div>
  );
};

export default ScannerInput;
