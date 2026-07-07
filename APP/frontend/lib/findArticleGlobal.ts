import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { SHELF_DEFINITIONS } from './firestoreSchema';
import { COLLECTIONS } from './schema/collections';
import { getItemAggregateId } from './schema/locations';

export interface GlobalArticleLocation {
  shelfCode: string;
  shelfName: string;
  position: string;
}

/**
 * Extrae la posición de un locationId ("PRE-14" → "14";
 * "PRE-URG MEC-PRE 001" → "URG MEC-PRE 001"). Mismo criterio que el backend
 * (inventory.ts): quitar el primer segmento (código de estantería) y rejuntar.
 */
const positionFromLocationId = (locationId: string): string =>
  locationId.split('-').slice(1).join('-');

/**
 * Busca un artículo en TODA la nave. Se usa para detectar artículos fantasma
 * antes de ubicar y para localizar dónde está un artículo.
 *
 * Consulta la colección `items` (fuente de verdad de presencias) con UNA sola
 * query por `aggregateKey`, en lugar de barrer las `locations` de las 15
 * estanterías (~15 lecturas → 1). Filtra `active` en cliente para no exigir un
 * índice compuesto (mismo patrón que lib/parciales.ts).
 *
 * IMPORTANTE: si la lectura falla, LANZA — no devuelve `[]` en silencio. Así,
 * un `[]` significa inequívocamente "no está ubicado en ningún sitio", y quien
 * decide si mostrar el aviso "ya ubicado" puede distinguir 0-real de
 * fallo-de-lectura y no colocar un duplicado a ciegas. Cada llamador debe
 * envolver la llamada en try/catch.
 */
export async function findArticleGlobal(
  articleCode: string,
  orderFab: string,
): Promise<GlobalArticleLocation[]> {
  const aggregateKey = getItemAggregateId(articleCode, orderFab);
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.ITEMS), where('aggregateKey', '==', aggregateKey)),
  );

  const results: GlobalArticleLocation[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as { active?: boolean; shelfCode?: string; locationIds?: string[] };
    // Presencias activas únicamente (filtro en cliente: evita índice compuesto).
    if (data.active === false) return;
    const locationId = String(data.locationIds?.[0] || '');
    const position = positionFromLocationId(locationId);
    if (!position) return;
    // `items.shelfCode` ya viene normalizado (MEC/PME→PRE), igual que los códigos
    // de SHELF_DEFINITIONS, así que casan directamente. Fallback defensivo al
    // propio código si no hubiese definición.
    const code = String(data.shelfCode || '').trim().toUpperCase();
    const def = SHELF_DEFINITIONS.find((s) => s.code === code);
    results.push({
      shelfCode: def?.code ?? code,
      shelfName: def?.name ?? code,
      position,
    });
  });

  return results;
}
