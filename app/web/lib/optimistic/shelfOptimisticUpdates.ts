/**
 * shelfOptimisticUpdates — Actualizaciones optimistas de estado para useShelf
 *
 * Funciones puras que transforman el array de ubicaciones localmente mientras
 * la operacion real se confirma en el servidor. Extraidas de useShelf para
 * poder testarlas de forma aislada.
 */

import type { ShelfLocationState } from '../schema/locations';
import type { LocationItem } from '../schema/locations';

const sameItem = (item: LocationItem, articleCode: string, orderFab: string) =>
  item.articleCode === articleCode && item.orderFab === orderFab;

export const applyUbicar = (
  prev: ShelfLocationState[],
  shelfCode: string,
  articleCode: string,
  orderFab: string,
  position: string,
  operarioId: string,
  operarioName: string,
): ShelfLocationState[] => {
  const now = new Date().toISOString();
  const next = [...prev];
  const index = next.findIndex((loc) => loc.position === position);
  const nextItem: LocationItem = {
    presenceId: `offline-${Date.now()}`,
    articleCode,
    orderFab,
    locatedBy: operarioId,
    locatedByName: operarioName,
    locatedAt: now,
  };

  if (index >= 0) {
    next[index] = { ...next[index], items: [...next[index].items, nextItem], isEmpty: false };
  } else {
    next.push({
      position,
      items: [nextItem],
      isEmpty: false,
      locationId: `${shelfCode}_${position}`,
    });
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
    const updatedItems = loc.items.filter((item) => !sameItem(item, articleCode, orderFab));
    if (updatedItems.length !== loc.items.length) positions.push(loc.position);
    return { ...loc, items: updatedItems, isEmpty: updatedItems.length === 0 };
  });
  return { next, positions };
};

export const applyMover = (
  prev: ShelfLocationState[],
  articleCode: string,
  orderFab: string,
  newPositions: string[],
  operarioId: string,
  operarioName: string,
): ShelfLocationState[] => {
  const now = new Date().toISOString();
  const matchedItems = prev.flatMap((loc) =>
    loc.items.filter((item) => sameItem(item, articleCode, orderFab)),
  );
  const cleaned = prev
    .map((loc) => ({
      ...loc,
      items: loc.items.filter((item) => !sameItem(item, articleCode, orderFab)),
    }))
    .map((loc) => ({ ...loc, isEmpty: loc.items.length === 0 }));

  return cleaned.map((loc) => {
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
};
