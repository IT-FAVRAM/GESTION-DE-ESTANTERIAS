import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { isSameArticle } from './articleIdentity';
import { SHELF_DEFINITIONS } from './firestoreSchema';
import { COLLECTIONS } from './schema/collections';

export interface GlobalArticleLocation {
  shelfCode: string;
  shelfName: string;
  position: string;
}

/**
 * Busca un artículo en TODAS las estanterías simultáneamente.
 * Se usa para detectar artículos fantasma antes de ubicar.
 * Sólo consulta ubicaciones no vacías para reducir lecturas.
 */
export async function findArticleGlobal(
  articleCode: string,
  orderFab: string,
): Promise<GlobalArticleLocation[]> {
  try {
    const results: GlobalArticleLocation[] = [];

    await Promise.all(
      SHELF_DEFINITIONS.map(async (shelf) => {
        const locRef = collection(db, COLLECTIONS.SHELVES, shelf.code, COLLECTIONS.LOCATIONS);
        const q = query(locRef, where('isEmpty', '==', false));
        const snap = await getDocs(q);
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          const items: Array<{ articleCode: string; orderFab: string }> = data.items || [];
          if (items.some((i) => isSameArticle(i.articleCode, i.orderFab, articleCode, orderFab))) {
            results.push({
              shelfCode: shelf.code,
              shelfName: shelf.name,
              position: data.position || docSnap.id,
            });
          }
        });
      }),
    );

    return results;
  } catch (err) {
    console.warn('[findArticleGlobal] Error en búsqueda global:', err);
    return [];
  }
}


