export interface ParcialInfo {
  /** Nº de parcial (1 = el primero que se ubicó por orden de llegada). */
  index: number;
  /** Total de parciales activos del mismo artículo+OF en toda la nave. */
  total: number;
}

/**
 * Nº de parcial de cada presencia de UN artículo+OF, por orden de llegada.
 *
 * Las presencias con el mismo locatedAt salieron de la misma operación de
 * ubicar (una pieza grande en varios huecos): son UN parcial, no varios. Antes
 * una pieza en 2 huecos salía como "Parcial 1/2" y "2/2" aunque no hubiera
 * ningún otro parcial. Sin locatedAt (datos antiguos) cada presencia cuenta aparte.
 */
export function computeParciales(
  list: Array<{ presenceId: string; locatedAt: string }>,
): Map<string, ParcialInfo> {
  const arrivalOf = (p: { presenceId: string; locatedAt: string }) => p.locatedAt || `~${p.presenceId}`;
  // locatedAt es ISO 8601, comparable como string; los sin fecha van al final.
  const arrivals = [...new Set(list.map(arrivalOf))].sort((a, b) => a.localeCompare(b));
  const total = arrivals.length;
  const result = new Map<string, ParcialInfo>();
  for (const p of list) result.set(p.presenceId, { index: arrivals.indexOf(arrivalOf(p)) + 1, total });
  return result;
}
