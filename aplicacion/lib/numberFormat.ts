/**
 * Formato numérico único para la UI (es-ES): coma decimal ("12,50") en vez del
 * punto que produce `toFixed`. Usar SIEMPRE para números mostrados al usuario.
 */
export const formatDecimal = (value: number, digits = 1): string =>
  Number.isFinite(value)
    ? value.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '—';

/** Porcentaje con coma decimal: formatPercentEs(12.345) → "12,3 %". */
export const formatPercentEs = (value: number, digits = 1): string =>
  Number.isFinite(value) ? `${formatDecimal(value, digits)} %` : '—';
