/**
 * useOperativeKeyboardShortcuts — Atajos de teclado para power-users de escritorio.
 *
 * Solo se activan en `desktop` (ratón + teclado). En kioskos/tablets táctiles
 * NO hace nada, de modo que no interfiere con el flujo de producción.
 *
 * Atajos:
 *   U → iniciar UBICAR        R → iniciar RETIRAR       M → iniciar MOVER
 *   / → foco en el buscador   Esc → cancelar acción en curso
 *
 * Reglas de seguridad:
 *   - U/R/M y `/` se ignoran si el foco está en un input/textarea/select o
 *     elemento editable (para no robar pulsaciones mientras se escribe).
 *   - U/R/M solo disparan si la acción está permitida por la config del rol y
 *     estamos en `idle`.
 *   - Esc sí funciona siempre (cancelar es seguro y esperado incluso escribiendo).
 */

import { useEffect } from 'react';
import type { RoleOperativeConfig } from '../lib/operative/operativeConfig';
import type { UseOperativeShelfReturn } from './useOperativeShelf';

const isTypingTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

export function useOperativeKeyboardShortcuts(
  engine: UseOperativeShelfReturn,
  config: RoleOperativeConfig,
  enabled: boolean,
): void {
  const { action, startAction, cancelAction } = engine;
  const a = config.actions;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignorar combinaciones con modificadores (atajos del sistema/navegador).
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Escape: cancelar la acción en curso. Funciona incluso desde inputs.
      if (e.key === 'Escape') {
        if (action !== 'idle') {
          e.preventDefault();
          cancelAction();
        }
        return;
      }

      // El resto de atajos NO deben dispararse mientras se escribe.
      if (isTypingTarget(e.target)) return;

      // Foco en el buscador.
      if (e.key === '/') {
        const input = document.querySelector<HTMLInputElement>('[data-op-search] input');
        if (input) {
          e.preventDefault();
          input.focus();
        }
        return;
      }

      // Acciones primarias: solo desde idle y si el rol las permite.
      if (action !== 'idle') return;

      switch (e.key.toLowerCase()) {
        case 'u':
          if (a.ubicar) { e.preventDefault(); startAction('ubicar'); }
          break;
        case 'r':
          if (a.retirar) { e.preventDefault(); startAction('retirar'); }
          break;
        case 'm':
          if (a.mover) { e.preventDefault(); startAction('mover'); }
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, action, a.ubicar, a.retirar, a.mover, startAction, cancelAction]);
}
