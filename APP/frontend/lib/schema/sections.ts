export type WarehouseSection =
  | 'PRENSAS_MECANIZADO'
  | 'PLEGADORA'
  | 'SOLDADURA'
  | 'SXP'
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
  SXP: 'Soldadura Puntos',
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
  SXP: 'SXP',
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

/**
 * Mapa de secciones que pueden tener acceso adicional a otras secciones.
 * Usado para jefes que necesitan acceder a múltiples secciones.
 * Ej: Jefe de PLEGADORA también accede a AUTOPLEGADORA.
 */
const CROSS_SECTION_ACCESS: Partial<Record<WarehouseSection, WarehouseSection[]>> = {
  'PLEGADORA': ['AUTOPLEGADORA'],
  // El jefe de SOLDADURA conserva acceso a Soldadura Puntos (SXP), que ahora es
  // su propia sección con jefe dedicado (H / Mario). El jefe de SXP ve solo SXP.
  'SOLDADURA': ['SXP'],
};

/**
 * Devuelve todas las estanterías accesibles para una sección,
 * incluyendo las de la sección primaria + las de secciones adicionales.
 */
export const getAccessibleShelvesForSection = (section: WarehouseSection): string[] => {
  const shelves = getShelvesForSection(section);
  const additionalSections = CROSS_SECTION_ACCESS[section] || [];
  for (const addSection of additionalSections) {
    const additionalShelves = getShelvesForSection(addSection);
    shelves.push(...additionalShelves);
  }
  return shelves;
};


