import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { COLLECTIONS } from './schema/collections';
import { getItemAggregateId } from './schema/locations';
import { computeParciales, type ParcialInfo } from './parcialesCompute';

export type { ParcialInfo };

/**
 * Calcula el nº de "parcial" de cada presencia activa para los artículos dados.
 *
 * Parcial = orden de llegada (locatedAt ascendente) entre TODAS las presencias
 * activas del mismo artículo+OF en toda la nave. El primero que se ubicó es el
 * Parcial 1, y los siguientes por orden de llegada son los Parciales 2, 3, …
 *
 * Se calcula en tiempo real (no se persiste): así nunca queda desfasado tras
 * retiradas o movimientos. Devuelve un Map presenceId → { index, total }.
 */
export async function fetchParcialesByPresence(
  pairs: Array<{ articleCode: string; orderFab: string }>,
): Promise<Map<string, ParcialInfo>> {
  const result = new Map<string, ParcialInfo>();
  const keys = [...new Set(pairs.map((p) => getItemAggregateId(p.articleCode, p.orderFab)))].filter(Boolean);
  if (keys.length === 0) return result;

  // Firestore 'in' admite hasta 30 valores → trocear en lotes.
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += 30) chunks.push(keys.slice(i, i + 30));

  // Presencias activas agrupadas por aggregateKey. Filtramos `active` en cliente
  // para no exigir un índice compuesto (aggregateKey + active).
  const byKey = new Map<string, Array<{ presenceId: string; locatedAt: string }>>();
  await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(collection(db, COLLECTIONS.ITEMS), where('aggregateKey', 'in', chunk));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const data = d.data() as { aggregateKey?: string; presenceId?: string; locatedAt?: string; active?: boolean };
        if (data.active === false) return;
        const k = data.aggregateKey || '';
        if (!k) return;
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k)!.push({ presenceId: data.presenceId || d.id, locatedAt: data.locatedAt || '' });
      });
    }),
  );

  for (const [, list] of byKey) {
    for (const [presenceId, info] of computeParciales(list)) result.set(presenceId, info);
  }

  return result;
}

