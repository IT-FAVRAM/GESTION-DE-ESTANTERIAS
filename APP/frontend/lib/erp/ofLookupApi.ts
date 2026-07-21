/**
 * Consulta de artículo por OF contra el ERP, vía el bridge local.
 *
 * ── Por qué este diseño ──────────────────────────────────────────────────────
 * El ERP vive en `http://10.0.0.19:8000`, una IP privada de la LAN. Ni las
 * Cloud Functions (están en la nube, no ven la LAN) ni el navegador (la app es
 * HTTPS → Mixed Content) pueden llamarla. El intento anterior
 * (`lib/api/controlOfProduccionApi.ts`) usaba un proxy en `localhost:3000`, lo
 * que obligaba a instalarlo en CADA tablet y kiosko.
 *
 * Solución: un bridge que corre en un PC fijo de la nave y solo hace conexiones
 * SALIENTES. Firestore es el canal:
 *
 *   App ──escribe {status:'pending'}──> erp_lookups/{OF} <──lee/escribe── Bridge ──> ERP
 *    └────────────── onSnapshot espera el resultado ──────────────┘
 *
 * El mismo documento hace de CACHÉ: si la OF ya se consultó hace poco, el
 * artículo aparece al instante sin tocar el ERP ni despertar al bridge.
 */

import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { normalizeOf } from './ofNormalize';

export const ERP_LOOKUPS_COLLECTION = 'erp_lookups';

/** Cuánto vale una respuesta cacheada antes de volver a preguntar al ERP. */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 h

/** Si un `pending` lleva más de esto, se asume abandonado y se reintenta. */
const STALE_PENDING_MS = 30 * 1000;

/** Cuánto esperamos al bridge antes de rendirnos (bridge caído o parado). */
const WAIT_TIMEOUT_MS = 10 * 1000;

/** Artículo devuelto por el ERP para una OF. */
export interface ErpOfArticle {
  code: string;
  qFabricar?: number | null;
  estado?: string | null;
  descOperacion?: string | null;
}

/** Forma del documento en `erp_lookups/{OF}`. Compartida con el bridge. */
export interface ErpOfLookupDoc {
  of: string;
  status: 'pending' | 'done' | 'not_found' | 'error';
  articles?: ErpOfArticle[];
  rowCount?: number;
  error?: string;
  requestedAt?: Timestamp | null;
  resolvedAt?: Timestamp | null;
}

/**
 * Resultado para la UI. `ambiguous` solo aparece si una OF devuelve más de un
 * artículo distinto — en las pruebas reales contra el ERP nunca pasó (OF26-05315,
 * OF26-02217 y OF25-06771 devolvieron 10, 7 y 17 filas con un único artículo),
 * pero si ocurre preguntamos al operario en vez de adivinar.
 */
export type OfLookupResult =
  | { kind: 'found'; of: string; article: ErpOfArticle }
  | { kind: 'ambiguous'; of: string; articles: ErpOfArticle[] }
  | { kind: 'not_found'; of: string }
  | { kind: 'invalid'; of: string }
  | { kind: 'error'; of: string; message: string }
  | { kind: 'timeout'; of: string };

const toMillis = (value: unknown): number => {
  if (value instanceof Timestamp) return value.toMillis();
  return 0;
};

/** Traduce el documento resuelto de Firestore al resultado que consume la UI. */
const toResult = (of: string, data: ErpOfLookupDoc): OfLookupResult | null => {
  switch (data.status) {
    case 'done': {
      const articles = data.articles ?? [];
      if (articles.length === 0) return { kind: 'not_found', of };
      if (articles.length === 1) return { kind: 'found', of, article: articles[0] };
      return { kind: 'ambiguous', of, articles };
    }
    case 'not_found':
      return { kind: 'not_found', of };
    case 'error':
      return { kind: 'error', of, message: data.error || 'Error consultando el ERP' };
    case 'pending':
      return null; // aún en vuelo
    default:
      return null;
  }
};

/** ¿Podemos servir este documento sin volver a molestar al ERP? */
const isFreshResult = (data: ErpOfLookupDoc): boolean => {
  if (data.status === 'pending' || data.status === 'error') return false;
  const age = Date.now() - toMillis(data.resolvedAt);
  return age >= 0 && age < CACHE_TTL_MS;
};

/**
 * Busca el artículo de una OF.
 *
 * Nunca lanza: cualquier fallo (bridge caído, sin red, permisos) se devuelve
 * como resultado para que la UI degrade con elegancia y el operario siga
 * pudiendo escribir el artículo a mano.
 */
export async function lookupArticleByOf(
  rawOf: string,
  options: { signal?: AbortSignal } = {},
): Promise<OfLookupResult> {
  const of = normalizeOf(rawOf);
  if (!of) return { kind: 'invalid', of: rawOf };

  const ref = doc(db, ERP_LOOKUPS_COLLECTION, of);

  try {
    // 1. ¿Lo tenemos ya cacheado y fresco?
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as ErpOfLookupDoc) : null;

    if (existing && isFreshResult(existing)) {
      const cached = toResult(of, existing);
      if (cached) return cached;
    }

    // 2. ¿Hay ya una petición en vuelo de otro dispositivo? Nos enganchamos a
    //    ella en vez de duplicar trabajo.
    const pendingInFlight =
      existing?.status === 'pending' && Date.now() - toMillis(existing.requestedAt) < STALE_PENDING_MS;

    if (!pendingInFlight) {
      await setDoc(
        ref,
        {
          of,
          status: 'pending',
          requestedAt: serverTimestamp(),
          requestedBy: auth.currentUser?.uid ?? null,
        },
        { merge: true },
      );
    }

    // 3. Esperar a que el bridge resuelva.
    return await waitForResolution(of, ref, options.signal);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[erp] lookup falló para ${of}:`, message);
    return { kind: 'error', of, message };
  }
}

/** Escucha el documento hasta que el bridge lo resuelva, con timeout. */
function waitForResolution(
  of: string,
  ref: ReturnType<typeof doc>,
  signal?: AbortSignal,
): Promise<OfLookupResult> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: OfLookupResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };

    const onAbort = () => finish({ kind: 'timeout', of });

    const timer = setTimeout(() => finish({ kind: 'timeout', of }), WAIT_TIMEOUT_MS);

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        // Ignora el eco local de nuestro propio `setDoc` optimista.
        if (snap.metadata.hasPendingWrites) return;
        const result = toResult(of, snap.data() as ErpOfLookupDoc);
        if (result) finish(result);
      },
      (err) => finish({ kind: 'error', of, message: err.message }),
    );

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
