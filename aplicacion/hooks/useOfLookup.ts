/**
 * useOfLookup — autorrelleno del artículo a partir de la OF.
 *
 * El operario escribe la OF y, tras una pausa breve, el artículo llega desde el
 * ERP a través del bridge local (ver `lib/erp/ofLookupApi.ts`).
 *
 * Reglas de convivencia con lo que ya existe:
 *  - Nunca pisa lo que el operario haya escrito: el `onResolved` solo se dispara
 *    y el componente decide si rellenar (típicamente, solo si el campo artículo
 *    está vacío).
 *  - Si el bridge está caído, degrada a `timeout` en silencio y el flujo manual
 *    de siempre sigue funcionando.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { lookupArticleByOf, type OfLookupResult, type ErpOfArticle } from '../lib/erp/ofLookupApi';
import { normalizeOf } from '../lib/erp/ofNormalize';

/** Pausa tras la última tecla antes de consultar. Absorbe el tecleo y las pistolas. */
const DEBOUNCE_MS = 600;

export type OfLookupStatus =
  | 'idle'
  | 'loading'
  | 'found'
  | 'ambiguous'
  | 'not_found'
  | 'error'
  | 'timeout';

export interface OfLookupState {
  status: OfLookupStatus;
  /** Artículo único encontrado (status === 'found'). */
  article: ErpOfArticle | null;
  /** Candidatos cuando la OF devuelve varios artículos (status === 'ambiguous'). */
  articles: ErpOfArticle[];
  /** OF canónica consultada, p.ej. `OF26-05315`. */
  normalizedOf: string | null;
}

const IDLE: OfLookupState = { status: 'idle', article: null, articles: [], normalizedOf: null };

interface UseOfLookupOptions {
  /** Desactiva la consulta (p.ej. flujos "sin OF" o campo deshabilitado). */
  enabled?: boolean;
  /**
   * Se invoca cuando el ERP resuelve un artículo único. El componente decide
   * si autorrellena — normalmente solo si el campo artículo está vacío.
   */
  onResolved?: (article: ErpOfArticle, normalizedOf: string) => void;
}

export function useOfLookup(rawOf: string, options: UseOfLookupOptions = {}): OfLookupState & {
  reset: () => void;
} {
  const { enabled = true, onResolved } = options;
  const [state, setState] = useState<OfLookupState>(IDLE);

  // Ref para que cambiar el callback no reinicie la consulta en vuelo.
  const onResolvedRef = useRef(onResolved);
  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);

  const reset = useCallback(() => setState(IDLE), []);

  // Normalizamos aquí para que el efecto dependa del valor canónico: teclear
  // "OF26-5315" y "of26 5315" es la misma consulta, no dos.
  const normalized = enabled ? normalizeOf(rawOf) : null;

  useEffect(() => {
    if (!normalized) {
      setState(IDLE);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const timer = setTimeout(() => {
      setState({ status: 'loading', article: null, articles: [], normalizedOf: normalized });

      lookupArticleByOf(normalized, { signal: controller.signal })
        .then((result: OfLookupResult) => {
          if (cancelled) return;

          switch (result.kind) {
            case 'found':
              setState({
                status: 'found',
                article: result.article,
                articles: [result.article],
                normalizedOf: normalized,
              });
              onResolvedRef.current?.(result.article, normalized);
              break;
            case 'ambiguous':
              setState({
                status: 'ambiguous',
                article: null,
                articles: result.articles,
                normalizedOf: normalized,
              });
              break;
            case 'not_found':
              setState({ status: 'not_found', article: null, articles: [], normalizedOf: normalized });
              break;
            case 'timeout':
              setState({ status: 'timeout', article: null, articles: [], normalizedOf: normalized });
              break;
            case 'invalid':
              setState(IDLE);
              break;
            default:
              setState({ status: 'error', article: null, articles: [], normalizedOf: normalized });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setState({ status: 'error', article: null, articles: [], normalizedOf: normalized });
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalized]);

  return { ...state, reset };
}
