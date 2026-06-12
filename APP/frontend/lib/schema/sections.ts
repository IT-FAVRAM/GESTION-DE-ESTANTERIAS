export type WarehouseSection =
  | 'PRENSAS_MECANIZADO'
  | 'PLEGADORA'
  | 'SOLDADURA'
  | 'AUTOPLEGADORA'
  | 'REPASADO'
  | 'PINTURA'
  | 'LASER'
  | 'CALIDAD'
  | 'PUNZONADO'
  | 'OTROS';

/** Nombres de sección para mostrar en la UI */
export const SECTION_DISPLAY_NAMES: Record<WarehouseSection, string> = {
  PRENSAS_MECANIZADO: 'Prensas-Mecanizado',
  PLEGADORA: 'Plegadora',
  SOLDADURA: 'Soldadura',
  AUTOPLEGADORA: 'Autoplegadora',
  REPASADO: 'Repasado',
  PINTURA: 'Pintura',
  LASER: 'Láser',
  CALIDAD: 'Calidad',
  PUNZONADO: 'Punzonado',
  OTROS: 'Otros',
};

/** Mapa de codigo de estanteria → seccion */
export const SHELF_TO_SECTION: Record<string, WarehouseSection> = {
  PRE: 'PRENSAS_MECANIZADO',
  MEC: 'PRENSAS_MECANIZADO',
  PLE: 'PLEGADORA',
  RPL: 'AUTOPLEGADORA',
  SOL: 'SOLDADURA',
  RSO: 'SOLDADURA',
  SXP: 'SOLDADURA',
  REP: 'REPASADO',
  PIN: 'PINTURA',
  ZIN: 'REPASADO',
  CAL: 'CALIDAD',
  COM: 'OTROS',
  CS: 'SOLDADURA',
  CP1: 'PLEGADORA',
  CP2: 'PLEGADORA',
  CRP: 'AUTOPLEGADORA',
};

/**
 * Códigos que son SOLO almacenamiento de datos, no vistas propias: se consolidan
 * dentro de otra estantería y nunca deben ofrecerse como estantería navegable.
 * 'MEC' (Mecanizado) vive físicamente junto a 'PRE' (Prensas) y se muestra dentro
 * de la vista combinada 'PRE' — ambas secciones actúan como una sola en la app.
 */
const DATA_ONLY_SHELVES = new Set<string>(['MEC']);

/** Obtiene la seccion de una estanteria por su codigo */
export const getSectionForShelf = (shelfCode: string): WarehouseSection =>
  SHELF_TO_SECTION[shelfCode] || 'OTROS';

/**
 * Devuelve los códigos de estantería NAVEGABLES de una sección. Excluye los
 * códigos solo-datos (p.ej. 'MEC'), que se consolidan en su vista combinada,
 * para no mostrar estanterías duplicadas/rotas en los selectores por sección.
 */
export const getShelvesForSection = (section: WarehouseSection): string[] =>
  Object.entries(SHELF_TO_SECTION)
    .filter(([code, sec]) => sec === section && !DATA_ONLY_SHELVES.has(code))
    .map(([code]) => code);


