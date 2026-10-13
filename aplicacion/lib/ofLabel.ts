/**
 * Texto de OF para mostrar. Las OF reales ya empiezan por "OF" ("OF26-07093"),
 * así que anteponer "OF: " producía "OF: OF26-07093". Solo se añade el prefijo
 * cuando el valor no lo trae (p.ej. referencias libres).
 */
export const ofLabel = (orderFab?: string | null): string => {
  const v = (orderFab ?? '').trim();
  if (!v) return '';
  return /^OF/i.test(v) ? v : `OF: ${v}`;
};
