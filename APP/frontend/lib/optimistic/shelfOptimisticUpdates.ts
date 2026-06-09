/**
 * shelfOptimisticUpdates — Actualizaciones optimistas de estado para useShelf
 *
 * Funciones puras que transforman el array de ubicaciones localmente mientras
 * la operacion real se confirma en el servidor. Extraidas de useShelf para
 * poder testarlas de forma aislada.
 */

import type { ShelfLocationState } from '../schema/locations';
import type { LocationItem } from '../schema/locations';
import { getLocationDocId } from '../schema/shelves';
import { isSameArticle } from '../articleIdentity';

export const applyUbicar = (
  prev: ShelfLocationState[],
  shelfCode: string,
  articleCode: string,
  orderFab: string,
  position: string,
  operarioId: string,
  operarioName: string,
  importe?: number,
  cantidad?: number,
  presenceId?: string,
): ShelfLocationState[] => {
  return applyUbicarMulti(prev, shelfCode, articleCode, orderFab, [position], operarioId, operarioName, importe, cantidad, presenceId);
};

export const applyUbicarMulti = (
  prev: ShelfLocationState[],
  shelfCode: string,
  articleCode: string,
  orderFab: string,
  positions: string[],
  operarioId: string,
  operarioName: string,
  importe?: number,
  cantidad?: number,
  presenceId?: string,
): ShelfLocationState[] => {
  const now = new Date().toISOString();
  let next = [...prev];

  for (const position of positions) {
    const index = next.findIndex((loc) => loc.position === position);
    // Use provided presenceId or generate a dedup-friendly one: {uid}-{timestamp}-{shelf}-{pos}
    // This allows backend to dedup based on uid+shelf+position combo
    const finalPresenceId = presenceId || `${operarioId}-${Date.now()}-${shelfCode}-${position}`;
    const nextItem: LocationItem = {
      presenceId: finalPresenceId,
      articleCode,
      orderFab,
      locatedBy: operarioId,
      locatedByName: operarioName,
      locatedAt: now,
      ...(importe !== undefined && { unitCost: importe }),
      ...(cantidad !== undefined && { quantity: cantidad }),
    };

    if (index >= 0) {
      next[index] = { ...next[index], items: [...next[index].items, nextItem], isEmpty: false };
    } else {
      next.push({
        position,
        items: [nextItem],
        isEmpty: false,
        locationId: getLocationDocId(shelfCode, position),
      });
    }
  }

  return next.sort((a, b) => Number.parseInt(a.position, 10) - Number.parseInt(b.position, 10));
};

export const applyRetirar = (
  prev: ShelfLocationState[],
  articleCode: string,
  orderFab: string,
): { next: ShelfLocationState[]; positions: string[] } => {
  const positions: string[] = [];
  const next = prev.map((loc) => {
    const updatedItems = loc.items.filter((item) => !isSameArticle(item.articleCode, item.orderFab, articleCode, orderFab));
    if (updatedItems.length !== loc.items.length) positions.push(loc.position);
    return { ...loc, items: updatedItems, isEmpty: updatedItems.length === 0 };
  });
  return { next, positions };
};

export const applyRetirarDeUbicacion = (
  prev: ShelfLocationState[],
  articleCode: string,
  orderFab: string,
  position: string,
  presenceId?: string,
): { next: ShelfLocationState[]; found: boolean } => {
  let found = false;
  const next = prev.map((loc) => {
    if (loc.position !== position) return loc;
    let removedOne = false;
    const updatedItems = loc.items.filter((item) => {
      if (removedOne) return true;
      const matches = presenceId && item.presenceId
        ? item.presenceId === presenceId
        : isSameArticle(item.articleCode, item.orderFab, articleCode, orderFab);
      if (matches) { removedOne = true; found = true; return false; }
      return true;
    });
    return { ...loc, items: updatedItems, isEmpty: updatedItems.length === 0 };
  });
  return { next, found };
};

export const applyMover = (
  prev: ShelfLocationState[],
  shelfCode: string,
  articleCode: string,
  orderFab: string,
  newPositions: string[],
  operarioId: string,
  operarioName: string,
): ShelfLocationState[] => {
  const now = new Date().toISOString();
  const matchedItems = prev.flatMap((loc) =>
    loc.items.filter((item) => isSameArticle(item.articleCode, item.orderFab, articleCode, orderFab)),
  );
  const cleaned = prev
    .map((loc) => ({
      ...loc,
      items: loc.items.filter((item) => !isSameArticle(item.articleCode, item.orderFab, articleCode, orderFab)),
    }))
    .map((loc) => ({ ...loc, isEmpty: loc.items.length === 0 }));

  let result = cleaned.map((loc) => {
    const targetIndex = newPositions.findIndex((p) => p === loc.position);
    if (targetIndex < 0) return loc;
    const sourceItem = matchedItems[targetIndex] || matchedItems[0];
    return {
      ...loc,
      items: [
        ...loc.items,
        {
          ...sourceItem,
          presenceId: sourceItem?.presenceId || `offline-${Date.now()}-${targetIndex}`,
          articleCode,
          orderFab,
          locatedBy: operarioId,
          locatedByName: operarioName,
          locatedAt: now,
        },
      ],
      isEmpty: false,
    };
  });

  const existingPositions = new Set(result.map((loc) => loc.position));
  const missingPositions = newPositions.filter((p) => !existingPositions.has(p));
  for (let i = 0; i < missingPositions.length; i++) {
    const sourceItem = matchedItems[newPositions.indexOf(missingPositions[i])] || matchedItems[0];
    result.push({
      position: missingPositions[i],
      items: [
        {
          ...sourceItem,
          presenceId: sourceItem?.presenceId || `offline-${Date.now()}-${i}`,
          articleCode,
          orderFab,
          locatedBy: operarioId,
          locatedByName: operarioName,
          locatedAt: now,
        },
      ],
      isEmpty: false,
      locationId: `${shelfCode}_${missingPositions[i]}`,
    });
  }

  return result.sort((a, b) => Number.parseInt(a.position, 10) - Number.parseInt(b.position, 10));
};


