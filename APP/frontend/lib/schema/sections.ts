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
};

/** Obtiene la seccion de una estanteria por su codigo */
export const getSectionForShelf = (shelfCode: string): WarehouseSection =>
  SHELF_TO_SECTION[shelfCode] || 'OTROS';

/** Devuelve todos los códigos de estantería que pertenecen a una sección */
export const getShelvesForSection = (section: WarehouseSection): string[] =>
  Object.entries(SHELF_TO_SECTION)
    .filter(([, sec]) => sec === section)
    .map(([code]) => code);


