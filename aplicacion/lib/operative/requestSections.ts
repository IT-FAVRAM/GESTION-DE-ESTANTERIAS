import type { WarehouseSection } from '../schema/sections';

/**
 * Secciones ofrecidas como ORIGEN (dónde recoger) y DESTINO (a dónde llevar) en
 * las solicitudes al carretillero. El `code` es un identificador de opción (no es
 * necesariamente un shelfCode real); `section` es la WarehouseSection canónica.
 *
 * Mecanizado y Prensas se muestran por separado por familiaridad del operario,
 * pero ambas mapean a la sección unificada PRENSAS_MECANIZADO.
 *
 * `isSoldadura` marca las opciones que requieren el paso extra de puesto 1..18
 * (solo la sección SOLDADURA — no robot RSO ni soldadura por puntos SXP).
 */
export interface RequestSection {
  code: string;
  name: string;
  section: WarehouseSection;
  isSoldadura?: boolean;
}

export const REQUEST_SECTIONS: RequestSection[] = [
  { code: 'ALMACEN',       name: 'Almacén',        section: 'OTROS' },
  { code: 'MECANIZADO',    name: 'Mecanizado',     section: 'PRENSAS_MECANIZADO' },
  { code: 'PRENSAS',       name: 'Prensas',        section: 'PRENSAS_MECANIZADO' },
  { code: 'PLEGADORA',     name: 'Plegadora',      section: 'PLEGADORA' },
  { code: 'PUNZONADO',     name: 'Punzonado',      section: 'PUNZONADO' },
  { code: 'SOLDADURA',     name: 'Soldadura',      section: 'SOLDADURA', isSoldadura: true },
  { code: 'AUTOPLEGADORA', name: 'Autoplegadora',  section: 'AUTOPLEGADORA' },
  { code: 'REPASADO',      name: 'Repasado',       section: 'REPASADO' },
  { code: 'ZINCADO',       name: 'Zincado',        section: 'ZINCADO' },
  { code: 'PINTURA',       name: 'Pintura',        section: 'PINTURA' },
  { code: 'LASER',         name: 'Láser',          section: 'LASER' },
  { code: 'CALIDAD',       name: 'Calidad',        section: 'CALIDAD' },
  { code: 'OTROS',         name: 'Otros',          section: 'OTROS' },
];

export const getRequestSection = (code: string): RequestSection | undefined =>
  REQUEST_SECTIONS.find((s) => s.code === code);

/** Puestos de soldadura disponibles (1..18). */
export const SOLDADURA_STATIONS: number[] = Array.from({ length: 18 }, (_, i) => i + 1);
