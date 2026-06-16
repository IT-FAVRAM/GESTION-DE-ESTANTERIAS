/**
 * useScannerCapture — Detector de pistola de escaneo GLOBAL (scan-first).
 *
 * Captura escaneos de pistola en reposo (idle) SIN robar el foco al buscador de
 * artículos. La pistola USB emula un teclado y envía los caracteres muy rápido,
 * terminando en Enter; un humano teclea mucho más lento. Esa diferencia de
 * velocidad es la heurística:
 *
 *   - caracteres con gap < ~35 ms entre sí → ráfaga de pistola.
 *   - terminada en Enter, con longitud ≥ 4 → es un escaneo (no tecleo humano).
 *
 * Cuando se detecta un escaneo se hace preventDefault/stopPropagation para que
 * el Enter no llegue al buscador, y se entrega el texto al `onScan` (sin
 * parsear — el llamador decide cómo interpretarlo). El tecleo humano normal no
 * dispara la heurística, así que el buscador sigue usable.
 *
 * Se mantiene desactivado fuera de idle o con cualquier modal abierto (lo
 * controla el llamador vía `active`).
 *
 * Ref: PLAN_ESCANEO_ATAJOS.md §4.
 */

import { useEffect, useRef } from 'react';

interface UseScannerCaptureOptions {
  /** Solo captura cuando es true (idle + sin modales abiertos). */
  active: boolean;
  /** Recibe el texto crudo del escaneo (sin parsear). */
  onScan: (raw: string) => void;
  /** Longitud mínima del buffer para considerarlo escaneo. Por defecto 4. */
  minLength?: number;
  /** Gap máximo entre teclas para considerarlas ráfaga de pistola (ms). Por defecto 35. */
  maxGapMs?: number;
}

export function useScannerCapture({
  active,
  onScan,
  minLength = 4,
  maxGapMs = 35,
}: UseScannerCaptureOptions): void {
  const bufferRef = useRef('');
  const lastTimeRef = useRef(0);
  // Refrescar la callback sin re-suscribir el listener en cada render.
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!active) {
      bufferRef.current = '';
      return;
    }

    const handler = (e: KeyboardEvent) => {
      // Ignorar combinaciones con modificadores (atajos de teclado).
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const now = Date.now();
      const gap = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (e.key === 'Enter') {
        const buf = bufferRef.current;
        bufferRef.current = '';
        // Solo se considera escaneo si se acumuló una ráfaga (los caracteres solo
        // se acumulan con gaps pequeños, así que length≥minLength ⇒ fue rápido).
        if (buf.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          onScanRef.current(buf);
        }
        return;
      }

      // Solo caracteres imprimibles (ignora Shift, Tab, flechas, etc.).
      if (e.key.length === 1) {
        if (gap > maxGapMs) {
          // Gap grande = tecleo humano (o 1er carácter de una ráfaga) → reiniciar
          // buffer y DEJAR pasar la tecla (no robamos el tecleo del buscador).
          bufferRef.current = e.key;
        } else {
          // Gap pequeño = parte de una ráfaga de pistola → acumular e impedir que
          // los caracteres siguientes contaminen el buscador.
          e.preventDefault();
          e.stopPropagation();
          bufferRef.current += e.key;
        }
      }
    };

    // Fase de captura: interceptamos antes de que el evento llegue al input del buscador.
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [active, minLength, maxGapMs]);
}
