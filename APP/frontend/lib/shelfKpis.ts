/**
 * shelfKpis — Cálculo ÚNICO de los KPIs de una estantería (ocupación, huecos,
 * artículos, urgentes). Lo usan la franja de KPIs del motor operativo, la
 * cabecera del grid y useShelf, para que todos cuadren con lo que pinta el grid.
 *
 * Reglas:
 * - El universo de huecos es el LAYOUT de la estantería (generatePositions): las
 *   mismas celdas que se dibujan. Documentos huérfanos en Firestore (p.ej. "1"
 *   junto a "001", o "50" sin padding) no cuentan; celdas sin documento cuentan
 *   como vacías.
 * - Un hueco está ocupado si tiene artículos (items), no por el flag isEmpty.
 * - Urgente = artículo en una celda roja del grid (zona isUrgent del layout o
 *   slot "URG …") O artículo con una alerta de urgencia activa.
 */

import type { ShelfLocationState } from './schema/locations';
import { type Shelf, generatePositions, isUrgentLocation } from './schema/shelves';

export interface ShelfKpis {
  totalSlots: number;
  occupiedSlots: number;
  emptySlots: number;
  totalArticles: number;
  /** % de ocupación (0-100), redondeado. */
  pct: number;
  /** Artículos urgentes en esta estantería (celda urgente ∪ alerta activa). */
  urgentArticles: number;
  /** De ellos, los que están en celdas urgentes (rojas). */
  urgentZoneArticles: number;
  /** De ellos, los que tienen alerta de urgencia activa. */
  urgentAlertArticles: number;
  /** Huecos urgentes ocupados / totales de la estantería. */
  urgentSlotsOccupied: number;
  urgentSlotsTotal: number;
}

/** ¿La celda `position` de `shelfCode` se pinta como urgente en el grid? */
export const isUrgentPosition = (shelfCode: string, position: string): boolean => {
  // Mismo criterio que ShelfGrid/ShelfRackView: slots de texto urgentes por
  // nombre ("URG MEC-PRE 001"); los numéricos por zona isUrgent del layout.
  if (!/^\d+$/.test(position)) return /URG/i.test(position);
  return isUrgentLocation(shelfCode, parseInt(position, 10));
};

export const computeShelfKpis = (
  locations: ShelfLocationState[],
  shelfDef: Shelf | undefined,
  urgentAlertCodes: ReadonlySet<string> = new Set(),
): ShelfKpis => {
  const byPosition = new Map<string, ShelfLocationState>();
  locations.forEach((loc) => byPosition.set(loc.position, loc));

  // Sin definición (estantería desconocida) caemos a los documentos existentes.
  const positions = shelfDef ? generatePositions(shelfDef) : locations.map((l) => l.position);
  const shelfCode = shelfDef?.code ?? '';

  let occupiedSlots = 0;
  let totalArticles = 0;
  let urgentArticles = 0;
  let urgentZoneArticles = 0;
  let urgentAlertArticles = 0;
  let urgentSlotsOccupied = 0;
  let urgentSlotsTotal = 0;

  for (const pos of positions) {
    const items = byPosition.get(pos)?.items ?? [];
    const urgentCell = !!shelfDef && isUrgentPosition(shelfCode, pos);
    if (urgentCell) urgentSlotsTotal++;
    if (items.length === 0) continue;

    occupiedSlots++;
    totalArticles += items.length;
    if (urgentCell) urgentSlotsOccupied++;

    for (const item of items) {
      const hasAlert = urgentAlertCodes.has(item.articleCode);
      if (urgentCell) urgentZoneArticles++;
      if (hasAlert) urgentAlertArticles++;
      if (urgentCell || hasAlert) urgentArticles++;
    }
  }

  const totalSlots = positions.length;
  return {
    totalSlots,
    occupiedSlots,
    emptySlots: Math.max(totalSlots - occupiedSlots, 0),
    totalArticles,
    pct: totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0,
    urgentArticles,
    urgentZoneArticles,
    urgentAlertArticles,
    urgentSlotsOccupied,
    urgentSlotsTotal,
  };
};
