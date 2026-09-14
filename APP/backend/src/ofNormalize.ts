/**
 * Forma canónica de la OF al GUARDAR. Espejo de frontend/lib/erp/ofNormalize.ts
 * (canonicalOrderFab): si lo tecleado parece un número de OF se deja como
 * `OFyy-nnnnn`; si es texto libre ("OF- RECHAZO SEDECAL", "OF26-VARIOS") o un
 * centinela ("SIN-OF") se deja tal cual, en mayúsculas.
 *
 * Motivo: la OF forma parte de la identidad de la pieza (aggregateKey). Un
 * espacio o un guion de más ("OF26-0461 9", "OF26--03910") creaba otra pieza
 * distinta: no saltaba el aviso "ya está ubicado" y la etiqueta no la encontraba.
 */

const OF_PATTERN = /^OF(\d{2})[-_]*(\d{1,5})$/;

export const canonicalOrderFab = (raw: string): string => {
  const upper = raw.trim().toUpperCase();
  const match = OF_PATTERN.exec(upper.replace(/\s+/g, ''));
  if (!match || Number(match[2]) === 0) return upper;
  return `OF${match[1]}-${match[2].padStart(5, '0')}`;
};

/**
 * Número de OF con más de 5 dígitos ("OF26-0556524165"): casi siempre el
 * artículo pegado detrás de la OF. Una OF real nunca los tiene.
 */
export const isOverlongOf = (raw: string): boolean =>
  /^OF\d{2}[-_]*\d{6,}$/.test(raw.trim().toUpperCase().replace(/\s+/g, ''));

/** Solo el prefijo del año ("OF26", "OF26-"): falta el número de la OF. */
export const isBareOfPrefix = (raw: string): boolean =>
  /^OF\d{2}[-_\s]*$/.test(raw.trim().toUpperCase());
