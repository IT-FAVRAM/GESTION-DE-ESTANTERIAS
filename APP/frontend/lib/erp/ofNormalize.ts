/**
 * Normalización de números de Orden de Fabricación (OF) para el ERP.
 *
 * La API del ERP (`/fichajes/getControlOfProduccion`) es estricta con el formato:
 * exige `OFyy-nnnnn` con los 5 dígitos rellenos de ceros. Verificado contra el
 * ERP real:
 *   - `OF26-05315` → 10 filas ✓
 *   - `OF26-5315`  → 0 filas ✗   (falta el relleno de ceros)
 *   - `of26-05315` → 10 filas ✓  (la API sí tolera minúsculas y espacios)
 *
 * El año varía (`OF25-`, `OF26-`, …), así que NUNCA se debe hardcodear el
 * prefijo. Si el operario no escribe el año no podemos adivinarlo, y devolvemos
 * `null` en vez de consultar una OF equivocada.
 */

/** Longitud a la que se rellenan con ceros los dígitos de la OF. */
const OF_DIGITS = 5;

/**
 * Valores centinela que la app usa cuando no hay OF real. Nunca deben
 * consultarse contra el ERP.
 * @see ScannerInput (`SIN-OF`), ManualEntryModal (`GENERAL`), texto libre (`SIN-REF`)
 */
const SENTINELS = new Set(['SIN-OF', 'SINOF', 'GENERAL', 'SIN-REF', 'SINREF', 'N/A']);

/**
 * Acepta `OF26-05315`, `of26 5315`, `OF26_5315`, `OF265315`… y lo lleva a la
 * forma canónica `OF26-05315`.
 */
const OF_PATTERN = /^OF(\d{2})[-_\s]*(\d{1,5})$/;

/**
 * Convierte lo que teclee el operario en el `n_orden` exacto que espera el ERP.
 *
 * @returns el número canónico `OFyy-nnnnn`, o `null` si no es una OF consultable.
 */
export function normalizeOf(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Quita espacios (incluidos los internos: "OF26 - 5315") y unifica a mayúsculas.
  const cleaned = raw.replace(/\s+/g, '').toUpperCase();
  if (!cleaned || SENTINELS.has(cleaned)) return null;

  const match = OF_PATTERN.exec(cleaned);
  if (!match) return null;

  const [, year, digits] = match;

  // "OF26-00000" no existe; evita una consulta inútil al ERP.
  if (Number(digits) === 0) return null;

  return `OF${year}-${digits.padStart(OF_DIGITS, '0')}`;
}

/**
 * ¿Merece la pena consultar el ERP con este texto? Útil para no disparar la
 * búsqueda mientras el operario aún está tecleando.
 */
export function isLookupableOf(raw: string | null | undefined): boolean {
  return normalizeOf(raw) !== null;
}
