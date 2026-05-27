export type WarehouseSection =
  | 'MECANIZADO'
  | 'PLEGADORA'
  | 'PRENSAS'
  | 'SOLDADURA'
  | 'AUTOPLEGADORA'
  | 'REPASADO'
  | 'PINTURA'
  | 'LASER'
  | 'CALIDAD'
  | 'OTROS';

/** Mapa de codigo de estanteria → seccion */
export const SHELF_TO_SECTION: Record<string, WarehouseSection> = {
  PRE: 'PRENSAS',
  MEC: 'MECANIZADO',
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


