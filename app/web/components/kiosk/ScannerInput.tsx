/**
 * ScannerInput — Captura invisible de entrada de pistola de escáner
 * Gestor de Estanterías WMS v3.0
 * 
 * La pistola USB estándar emula un teclado: envía caracteres + Enter.
 * Este componente mantiene un input oculto con autofocus permanente,
 * captura el texto completo y lo parsea cuando llega el Enter.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { parseScanInput, type ScanParseResult } from '../../lib/qrParser';

interface ScannerInputProps {
  /** Se llama cuando se escanea un código correctamente */
  onScan: (result: ScanParseResult) => void;
  /** Si el escáner está activo */
  active: boolean;
  /** Si está deshabilitado */
  disabled?: boolean;
}

const ScannerInput: React.FC<ScannerInputProps> = ({ onScan, active, disabled = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [buffer, setBuffer] = useState('');
  const lastKeyTime = useRef<number>(0);

  // Mantener autofocus permanente
  useEffect(() => {
    if (!active || disabled) return;
    
    const refocusInterval = setInterval(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        // Solo re-enfocar si no hay ningún otro input activo
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          inputRef.current.focus();
        }
      }
    }, 500);
    
    // Focus inicial
    inputRef.current?.focus();
    
    return () => clearInterval(refocusInterval);
  }, [active, disabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    const now = Date.now();
    
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (buffer.trim().length > 0) {
        // Parsear el texto acumulado
        const result = parseScanInput(buffer.trim());
        onScan(result);
      }
      
      // Reset buffer
      setBuffer('');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    
    // Detectar si es entrada rápida de pistola (< 50ms entre teclas)
    // vs escritura humana manual (> 50ms)
    lastKeyTime.current = now;
  }, [buffer, disabled, onScan]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setBuffer(e.target.value);
  }, [disabled]);

  if (!active) return null;

  return (
    <input
      ref={inputRef}
      type="text"
      value={buffer}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      // Visually hidden pero funcional para capturar input de pistola
      className="fixed -top-[100px] -left-[100px] w-1 h-1 opacity-0 pointer-events-none"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
};

export default ScannerInput;
