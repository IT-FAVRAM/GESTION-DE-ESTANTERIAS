import type { WarehouseSection } from './sections';
import type { AppConfig } from './appConfig';

export type ShelfType = 'shelf' | 'cart';

export interface Shelf {
  code: string;
  name: string;
  section: WarehouseSection;
  type: ShelfType;
  locationCount: number;
  layout: ShelfLayout;
}

export interface ShelfLayout {
  zones: ShelfZone[];
  physicalBlocks?: ShelfPhysicalBlock[];
}

export interface ShelfZone {
  name: string;
  range: [number, number];
  color?: string;
  isUrgent?: boolean;
  isTechReview?: boolean;
}

export type SlotDef = number | string | null;

export interface ShelfPhysicalBlock {
  id: string;
  title: string;
  subtitle?: string;
  zoneName?: string;
  fullWidth?: boolean;
  rows: Array<Array<SlotDef>>;
  /** Ubicación de SUELO: franja a sangre a lo ancho de toda la estantería, bajo el rack. */
  floorPosition?: string;
}

// ── SHELF DEFINITIONS ────────────────────────────────────────────────────────

export const SHELF_DEFINITIONS: Shelf[] = [
  {
    code: 'PRE',
    name: 'Prensas - Mecanizado',
    section: 'PRENSAS_MECANIZADO',
    type: 'shelf',
    locationCount: 50,
    layout: {
      zones: [
        { name: 'URG MEC-PRE', range: [0, 0], color: '#ef4444', isUrgent: true },
        { name: 'PRENSAS', range: [1, 9], color: '#3b82f6' },
        { name: 'MECANIZADO', range: [14, 46], color: '#f97316' },
      ],
      physicalBlocks: [
        {
          id: 'pme-urg-shared',
          title: 'URG MEC-PRE',
          subtitle: 'Ubicaciones compartidas · 4 ubicaciones',
          zoneName: 'URG MEC-PRE',
          fullWidth: true,
          rows: [
            ['URG MEC-PRE 001'],
            ['URG MEC-PRE 002'],
            ['URG MEC-PRE 003'],
            ['URG MEC-PRE 004'],
          ],
        },
        {
          id: 'pme-prensas',
          title: 'Prensas',
          subtitle: '3 filas x 3 columnas',
          zoneName: 'PRENSAS',
          rows: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
        },
        {
          id: 'pme-mecanizado',
          title: 'Mecanizado',
          subtitle: '4 filas · 9 columnas (33 ubicaciones)',
          zoneName: 'MECANIZADO',
          rows: [
            [14, 15, 16,   null, null, null,   35, 36, 37],
            [17, 18, 19,   26,   27,   28,     38, 39, 40],
            [20, 21, 22,   29,   30,   31,     41, 42, 43],
            [23, 24, 25,   32,   33,   34,     44, 45, 46],
          ],
        },
      ],
    },
  },
  {
    code: 'PLE',
    name: 'Plegado',
    section: 'PLEGADORA',
    type: 'shelf',
    locationCount: 65,
    layout: {
      zones: [
        { name: 'URGENTE', range: [1, 6], color: '#ef4444', isUrgent: true },
        { name: 'ESTANTERIA 1', range: [7, 32], color: '#3b82f6' },
        { name: 'PUNZONADORA', range: [31, 66], color: '#f59e0b' },
      ],
      physicalBlocks: [
        {
          id: 'ple-punz-izq',
          title: 'Punzonadora Izquierda',
          subtitle: '052-067 · 4 filas + 3 vacías',
          zoneName: 'PUNZONADORA',
          rows: [
            [64, 65, 66, 67],
            [60, 61, 62, 63],
            [56, 57, 58, 59],
            [52, 53, 54, 55],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
          ],
        },
        {
          id: 'ple-punz',
          title: 'Punzonadora Derecha',
          subtitle: '031-051 · 7 filas · 3 columnas',
          zoneName: 'PUNZONADORA',
          rows: [
            [49, 50, 51],
            [46, 47, 48],
            [43, 44, 45],
            [40, 41, 42],
            [37, 38, 39],
            [34, 35, 36],
            [31, 32, 33],
          ],
        },
        {
          id: 'ple-est1',
          title: 'Estantería 1',
          subtitle: 'Urgentes (001-006) en filas inferiores',
          zoneName: 'ESTANTERIA 1',
          rows: [
            [15, 16, null, null],
            [13, 14, 29, 30],
            [11, 12, 27, 28],
            [9,  10, 25, 26],
            [7,  8,  23, 24],
            [5,  6,  21, 22],
            [3,  4,  19, 20],
            [1,  2,  17, 18],
          ],
        },
      ],
    },
  },
  {
    code: 'SOL',
    name: 'Soldadura',
    section: 'SOLDADURA',
    type: 'shelf',
    locationCount: 73,
    layout: {
      zones: [
        { name: 'URGENTE', range: [1, 4], color: '#ef4444', isUrgent: true },
        { name: 'PRINCIPAL', range: [5, 73], color: '#3b82f6' },
      ],
      physicalBlocks: [
        {
          id: 'sol-main',
          title: 'Estantería Soldadura',
          subtitle: '001-073 · 7 filas x 13 columnas',
          fullWidth: true,
          rows: [
            [17,   18,   24,   25,   38,   39,   40,   53,   54,   55,   71,   72,   73],
            [15,   16,   22,   23,   35,   36,   37,   50,   51,   52,   68,   69,   70],
            [13,   14,   20,   21,   32,   33,   34,   47,   48,   49,   65,   66,   67],
            [11,   12,   null, 1,    null, null, null, 44,   45,   46,   62,   63,   64],
            [9,    10,   null, 2,    null, null, null, null, null, null, 59,   60,   61],
            [7,    8,    null, 3,    29,   30,   31,   null, null, null, null, null, null],
            [5,    6,    19,   4,    26,   27,   28,   41,   42,   43,   56,   57,   58],
          ],
        },
      ],
    },
  },
  {
    code: 'RSO',
    name: 'Robot Soldadura',
    section: 'SOLDADURA',
    type: 'shelf',
    locationCount: 8,
    layout: {
      zones: [{ name: 'GENERAL', range: [1, 8], color: '#f97316' }],
      physicalBlocks: [
        {
          id: 'rso-main',
          title: 'Robot Soldadura',
          subtitle: '4 filas · 2 columnas',
          zoneName: 'GENERAL',
          rows: [[7, 8], [5, 6], [3, 4], [1, 2]],
        },
      ],
    },
  },
  {
    code: 'REP',
    name: 'Repasado',
    section: 'REPASADO',
    type: 'shelf',
    locationCount: 51,
    layout: {
      zones: [
        { name: 'URGENTE', range: [1, 4], color: '#ef4444', isUrgent: true },
        { name: 'ALUMINIO 1', range: [5, 9], color: '#fbbf24' },
        { name: 'ALUMINIO 2', range: [10, 14], color: '#fbbf24' },
        { name: 'NORMAL INDIVIDUAL 1', range: [15, 19], color: '#3b82f6' },
        { name: 'NORMAL INDIVIDUAL 2', range: [20, 24], color: '#0ea5e9' },
        { name: 'FUERA', range: [25, 39], color: '#f97316' },
        { name: 'DENTRO', range: [40, 51], color: '#10b981' },
      ],
      physicalBlocks: [
        {
          id: 'rep-urgent',
          title: 'Urgente',
          subtitle: '001-004 · Rojas',
          zoneName: 'URGENTE',
          rows: [[1], [2], [3], [4]],
        },
        {
          id: 'rep-alu1',
          title: 'Aluminio 1',
          subtitle: '005-009',
          zoneName: 'ALUMINIO 1',
          rows: [[5], [6], [7], [8], [9]],
        },
        {
          id: 'rep-alu2',
          title: 'Aluminio 2',
          subtitle: '010-014',
          zoneName: 'ALUMINIO 2',
          rows: [[10], [11], [12], [13], [14]],
        },
        {
          id: 'rep-normal1',
          title: 'Normal Individual 1',
          subtitle: '015-019',
          zoneName: 'NORMAL INDIVIDUAL 1',
          rows: [[15], [16], [17], [18], [19]],
        },
        {
          id: 'rep-normal2',
          title: 'Normal Individual 2',
          subtitle: '020-024',
          zoneName: 'NORMAL INDIVIDUAL 2',
          rows: [[20], [21], [22], [23], [24]],
        },
        {
          id: 'rep-fuera',
          title: 'Fuera',
          subtitle: '025-039 · 3 columnas',
          zoneName: 'FUERA',
          fullWidth: true,
          rows: [[37, 38, 39], [34, 35, 36], [31, 32, 33], [28, 29, 30], [25, 26, 27]],
        },
        {
          id: 'rep-dentro',
          title: 'Dentro',
          subtitle: '040-053 · 3 columnas',
          zoneName: 'DENTRO',
          fullWidth: true,
          rows: [[49, 50, 51], [46, 47, 48], [43, 44, 45], [40, 41, 42]],
        },
      ],
    },
  },
  {
    code: 'BOM',
    name: 'Bombo',
    section: 'REPASADO',
    type: 'shelf',
    locationCount: 2,
    layout: {
      zones: [{ name: 'BOMBO', range: [1, 2], color: '#0ea5e9' }],
      physicalBlocks: [
        {
          id: 'bom-main',
          title: 'Bombo',
          subtitle: '2 filas',
          zoneName: 'BOMBO',
          rows: [['BOMBO 1'], ['BOMBO 2']],
        },
      ],
    },
  },
  {
    code: 'PIN',
    name: 'Pintura',
    section: 'PINTURA',
    type: 'shelf',
    locationCount: 40,
    layout: {
      zones: [
        { name: 'DENTRO', range: [1, 27], color: '#3b82f6' },
        { name: 'FUERA', range: [28, 39], color: '#f97316' },
      ],
      physicalBlocks: [
        {
          id: 'pin-dentro',
          title: 'Estantería 1',
          subtitle: 'Dentro · 001-027 + suelo',
          zoneName: 'DENTRO',
          rows: [
            [19, 20, 21, 22, 23, 24, 25, 26, 27],
            [10, 11, 12, 13, 14, 15, 16, 17, 18],
            [1, 2, 3, 4, 5, 6, 7, 8, 9],
          ],
          floorPosition: 'SUELO',
        },
        {
          id: 'pin-fuera',
          title: 'Estantería 2',
          subtitle: 'Fuera · 028-039',
          zoneName: 'FUERA',
          rows: [[37, 38, 39], [34, 35, 36], [31, 32, 33], [28, 29, 30]],
        },
      ],
    },
  },
  {
    code: 'SXP',
    name: 'Soldadura Puntos',
    section: 'SXP',
    type: 'shelf',
    locationCount: 10,
    layout: {
      zones: [{ name: 'GENERAL', range: [1, 10], color: '#3b82f6' }],
      physicalBlocks: [
        {
          id: 'sxp-main',
          title: 'Soldadura por puntos',
          subtitle: '5 filas x 2 columnas',
          zoneName: 'GENERAL',
          rows: [[9, 10], [7, 8], [5, 6], [3, 4], [1, 2]],
        },
      ],
    },
  },
  {
    code: 'COM',
    name: 'Comodin',
    section: 'OTROS',
    type: 'shelf',
    locationCount: 18,
    layout: {
      zones: [
        { name: 'ESTANTERIA 1', range: [1, 18], color: '#3b82f6' },
      ],
      physicalBlocks: [
        {
          id: 'com-est1',
          title: 'Comodín Est. 1',
          subtitle: '001-018 · 6 filas · 3 columnas',
          zoneName: 'ESTANTERIA 1',
          rows: [[16, 17, 18], [13, 14, 15], [10, 11, 12], [7, 8, 9], [4, 5, 6], [1, 2, 3]],
        },
      ],
    },
  },
  {
    code: 'RPL',
    name: 'Autoplegadora',
    section: 'AUTOPLEGADORA',
    type: 'shelf',
    locationCount: 35,
    layout: {
      zones: [
        { name: 'ESTANTERIA 2', range: [1, 14], color: '#f97316' },
        { name: 'ESTANTERIA 1', range: [15, 35], color: '#f97316' }
      ],
      physicalBlocks: [
        {
          id: 'rpl-main',
          title: 'Estantería 1 Autoplegadora',
          subtitle: '015-035 · 7 filas · 3 columnas',
          zoneName: 'ESTANTERIA 1',
          rows: [[33, 34, 35], [30, 31, 32], [27, 28, 29], [24, 25, 26], [21, 22, 23], [18, 19, 20], [15, 16, 17]],
        },
        {
          id: 'rpl-autoplegado',
          title: 'Estantería 2 Autoplegado',
          subtitle: '001-014 · 7 filas · 2 columnas',
          zoneName: 'ESTANTERIA 2',
          rows: [[13, 14], [11, 12], [9, 10], [7, 8], [5, 6], [3, 4], [1, 2]],
        },
      ],
    },
  },
  {
    code: 'ARO',
    name: 'Autoroscadora',
    section: 'AUTOPLEGADORA',
    type: 'shelf',
    locationCount: 6,
    layout: {
      zones: [{ name: 'GENERAL', range: [1, 6], color: '#f97316' }],
      physicalBlocks: [
        {
          id: 'aro-main',
          title: 'Estantería Autoroscadora',
          subtitle: '3 filas · 2 columnas',
          zoneName: 'GENERAL',
          rows: [[5, 6], [3, 4], [1, 2]],
        },
      ],
    },
  },
  {
    code: 'CAL',
    name: 'Calidad',
    section: 'CALIDAD',
    type: 'shelf',
    locationCount: 34,
    layout: {
      zones: [
        { name: 'REPROCESOS', range: [1, 22], color: '#3b82f6' },
        { name: 'GENERAL', range: [23, 28], color: '#8b5cf6' },
        { name: 'URGENTE', range: [29, 29], color: '#ef4444', isUrgent: true },
        { name: 'GENERAL B', range: [30, 30], color: '#8b5cf6' },
        { name: 'REVISION TECNICA', range: [31, 31], color: '#f59e0b', isTechReview: true },
        { name: 'URGENTE B', range: [32, 32], color: '#ef4444', isUrgent: true },
        { name: 'GENERAL C', range: [33, 33], color: '#8b5cf6' },
        { name: 'REVISION TECNICA B', range: [34, 34], color: '#f59e0b', isTechReview: true },
      ],
      physicalBlocks: [
        {
          id: 'cal-reprocesos',
          title: 'Reprocesos (Estantería 1)',
          subtitle: 'CAL 001-022 · Reprocesos con importe EUR',
          zoneName: 'REPROCESOS',
          fullWidth: true,
          rows: [
            [1,  2,  null, null, null],
            [3,  4,  11,   12,   13  ],
            [5,  6,  14,   15,   16  ],
            [7,  8,  17,   18,   19  ],
            [9,  10, 20,   21,   22  ],
          ],
        },
        {
          id: 'cal-est2',
          title: 'Estantería 2',
          subtitle: 'CAL 023-034 · Control final y verificaciones',
          zoneName: 'GENERAL',
          rows: [
            [23, 24, 25],
            [26, 27, 28],
            [29, 30, 31],
            [32, 33, 34],
          ],
        },
      ],
    },
  },
  {
    code: 'ZIN',
    name: 'Zincado',
    section: 'ZINCADO',
    type: 'shelf',
    locationCount: 5,
    layout: {
      zones: [{ name: 'BALDAS', range: [1, 5], color: '#3b82f6' }],
      physicalBlocks: [
        {
          id: 'zin-baldas',
          title: 'Baldas Zincado',
          zoneName: 'BALDAS',
          rows: [[5], [4], [3], [2], [1]],
        },
      ],
    },
  },
  {
    code: 'UTS',
    name: 'Útiles Soldadura',
    section: 'SOLDADURA',
    type: 'shelf',
    locationCount: 12,
    layout: {
      zones: [{ name: 'UTILIDADES', range: [1, 12], color: '#8b5cf6' }],
      physicalBlocks: [
        {
          id: 'uts-main',
          title: 'Útiles Soldadura',
          subtitle: '2 columnas x 6 filas · UTIL SOL. 001-012',
          zoneName: 'UTILIDADES',
          fullWidth: true,
          rows: [
            ['UTIL SOL. 011', 'UTIL SOL. 012'],
            ['UTIL SOL. 009', 'UTIL SOL. 010'],
            ['UTIL SOL. 007', 'UTIL SOL. 008'],
            ['UTIL SOL. 005', 'UTIL SOL. 006'],
            ['UTIL SOL. 003', 'UTIL SOL. 004'],
            ['UTIL SOL. 001', 'UTIL SOL. 002'],
          ],
        },
      ],
    },
  },
];

export const CART_DEFINITIONS: Shelf[] = [
  {
    code: 'CS',
    name: 'Carro Soldadura',
    section: 'SOLDADURA',
    type: 'cart',
    locationCount: 4,
    layout: {
      zones: [{ name: 'BALDAS', range: [1, 4], color: '#10b981' }],
      physicalBlocks: [
        {
          id: 'cs-main',
          title: 'Carro Soldadura',
          subtitle: '4 baldas',
          zoneName: 'BALDAS',
          rows: [[1], [2], [3], [4]],
        },
      ],
    },
  },
  {
    code: 'CP1',
    name: 'Carro Plegadora 1',
    section: 'PLEGADORA',
    type: 'cart',
    locationCount: 4,
    layout: {
      zones: [{ name: 'BALDAS', range: [1, 4], color: '#10b981' }],
      physicalBlocks: [
        {
          id: 'cp1-main',
          title: 'Carro Plegadora 1',
          subtitle: '4 baldas',
          zoneName: 'BALDAS',
          rows: [[1], [2], [3], [4]],
        },
      ],
    },
  },
  {
    code: 'CP2',
    name: 'Carro Plegadora 2',
    section: 'PLEGADORA',
    type: 'cart',
    locationCount: 4,
    layout: {
      zones: [{ name: 'BALDAS', range: [1, 4], color: '#10b981' }],
      physicalBlocks: [
        {
          id: 'cp2-main',
          title: 'Carro Plegadora 2',
          subtitle: '4 baldas',
          zoneName: 'BALDAS',
          rows: [[1], [2], [3], [4]],
        },
      ],
    },
  },
  {
    code: 'CAM',
    name: 'Carro Plegadora Amada',
    section: 'AUTOPLEGADORA',
    type: 'cart',
    // 4 baldas + la franja de SUELO AMADA (ubicacion 'SUELO AMADA').
    locationCount: 5,
    layout: {
      zones: [{ name: 'BALDAS', range: [1, 4], color: '#10b981' }],
      physicalBlocks: [
        {
          id: 'cam-main',
          title: 'Carro Plegadora Amada',
          subtitle: '4 baldas + suelo',
          zoneName: 'BALDAS',
          rows: [[1], [2], [3], [4]],
          // Piezas demasiado grandes para una balda: se dejan en el suelo junto
          // al carro y se registran aqui para saber donde estan.
          floorPosition: 'SUELO AMADA',
        },
      ],
    },
  },
  {
    code: 'CRP',
    name: 'Carro Robot de Plegado',
    section: 'AUTOPLEGADORA',
    type: 'cart',
    locationCount: 4,
    layout: {
      zones: [{ name: 'BALDAS', range: [1, 4], color: '#10b981' }],
      physicalBlocks: [
        {
          id: 'crp-main',
          title: 'Carro Robot de Plegado',
          subtitle: '4 baldas',
          zoneName: 'BALDAS',
          rows: [[1], [2], [3], [4]],
        },
      ],
    },
  },
];

export const ALL_SHELVES: Shelf[] = [...SHELF_DEFINITIONS, ...CART_DEFINITIONS];

// ── HELPERS ──────────────────────────────────────────────────────────────────

/** Devuelve los carros disponibles para una sección, opcionalmente excluyendo algunos */
export const getCartsForSection = (section: WarehouseSection, excludedCarts?: string[]): string[] =>
  CART_DEFINITIONS
    .filter(cart => cart.section === section && !(excludedCarts?.includes(cart.code)))
    .map(cart => cart.code);

/** Genera el ID de ubicacion compuesto: "shelfCode-position" */
export const getLocationDocId = (shelfCode: string, position: number | string): string => {
  if (typeof position === 'number') {
    return `${shelfCode}-${position.toString().padStart(3, '0')}`;
  }
  return `${shelfCode}-${position}`;
};

/** Parsea un locationId en sus partes */
export const parseLocationId = (locationId: string): { shelfCode: string; position: string } | null => {
  const dashIndex = locationId.indexOf('-');
  if (dashIndex === -1) return null;
  return {
    shelfCode: locationId.substring(0, dashIndex),
    position: locationId.substring(dashIndex + 1),
  };
};

/** Comprueba si una ubicacion es urgente - acepta (shelfCode, position) o locationId */
export const isUrgentLocation = (
  shelfCodeOrLocationId: string,
  positionOrConfig?: number | AppConfig,
  config?: AppConfig,
): boolean => {
  let shelfCode: string;
  let position: number;
  let finalConfig: AppConfig | undefined;

  if (typeof positionOrConfig === 'number') {
    shelfCode = shelfCodeOrLocationId;
    position = positionOrConfig;
    finalConfig = config;
  } else {
    finalConfig = positionOrConfig;
    const parsed = parseLocationId(shelfCodeOrLocationId);
    if (!parsed) return false;
    shelfCode = parsed.shelfCode;
    const posNum = parseInt(parsed.position, 10);
    if (isNaN(posNum)) {
      // String position (e.g. 'URG MEC-PRE 001'): urgent by name convention
      if (parsed.position.toUpperCase().startsWith('URG')) return true;
      const locationId = getLocationDocId(parsed.shelfCode, parsed.position);
      return finalConfig?.urgentLocations?.includes(locationId) ?? false;
    }
    position = posNum;
  }

  const locationId = getLocationDocId(shelfCode, position);
  if (finalConfig?.urgentLocations?.includes(locationId)) return true;
  const shelf = SHELF_DEFINITIONS.find((s) => s.code === shelfCode);
  if (!shelf) return false;
  return shelf.layout.zones.some((z) => z.isUrgent && position >= z.range[0] && position <= z.range[1]);
};

/** Comprueba si una ubicacion es de revision tecnica - acepta (shelfCode, position) o locationId */
export const isTechReviewLocation = (
  shelfCodeOrLocationId: string,
  positionOrConfig?: number | AppConfig,
  config?: AppConfig,
): boolean => {
  let shelfCode: string;
  let position: number;
  let finalConfig: AppConfig | undefined;

  if (typeof positionOrConfig === 'number') {
    shelfCode = shelfCodeOrLocationId;
    position = positionOrConfig;
    finalConfig = config;
  } else {
    finalConfig = positionOrConfig;
    const parsed = parseLocationId(shelfCodeOrLocationId);
    if (!parsed) return false;
    shelfCode = parsed.shelfCode;
    const posNum = parseInt(parsed.position, 10);
    if (isNaN(posNum)) return false;
    position = posNum;
  }

  const locationId = getLocationDocId(shelfCode, position);
  if (finalConfig?.techReviewLocations?.includes(locationId)) return true;
  const shelf = SHELF_DEFINITIONS.find((s) => s.code === shelfCode);
  if (!shelf) return false;
  return shelf.layout.zones.some((z) => z.isTechReview && position >= z.range[0] && position <= z.range[1]);
};

/** Comprueba si una ubicacion es de Aluminio - acepta (shelfCode, position) o locationId */
export const isAluminioLocation = (
  shelfCodeOrLocationId: string,
  positionOrUndefined?: number,
): boolean => {
  let shelfCode: string;
  let position: number;

  if (typeof positionOrUndefined === 'number') {
    shelfCode = shelfCodeOrLocationId;
    position = positionOrUndefined;
  } else {
    const parsed = parseLocationId(shelfCodeOrLocationId);
    if (!parsed) return false;
    shelfCode = parsed.shelfCode;
    const posNum = parseInt(parsed.position, 10);
    if (isNaN(posNum)) return false;
    position = posNum;
  }

  const shelf = SHELF_DEFINITIONS.find((s) => s.code === shelfCode);
  if (!shelf) return false;
  return shelf.layout.zones.some((z) => z.name.includes('ALUMINIO') && position >= z.range[0] && position <= z.range[1]);
};

/** Comprueba si una ubicacion es de reprocesos (CAL 001-022) - acepta (shelfCode, position) o locationId */
export const isReprocesosLocation = (
  shelfCodeOrLocationId: string,
  positionOrUndefined?: number,
): boolean => {
  let shelfCode: string;
  let position: number;

  if (typeof positionOrUndefined === 'number') {
    shelfCode = shelfCodeOrLocationId;
    position = positionOrUndefined;
  } else {
    const parsed = parseLocationId(shelfCodeOrLocationId);
    if (!parsed) return false;
    shelfCode = parsed.shelfCode;
    const posNum = parseInt(parsed.position, 10);
    if (isNaN(posNum)) return false;
    position = posNum;
  }

  return shelfCode === 'CAL' && position >= 1 && position <= 22;
};

/** Obtiene la definicion de una estanteria por su codigo */
export const getShelfDefinition = (code: string): Shelf | undefined =>
  ALL_SHELVES.find((s) => s.code === code);

/** Genera todos los IDs de posicion para una estanteria, incluyendo string slots */
export const generatePositions = (shelf: Shelf): string[] => {
  const blocks = shelf.layout.physicalBlocks;
  if (blocks && blocks.length > 0) {
    const positions: string[] = [];
    const seen = new Set<string>();
    for (const block of blocks) {
      for (const row of block.rows) {
        for (const slot of row) {
          if (slot === null) continue;
          const pos = typeof slot === 'string' ? slot : slot.toString().padStart(3, '0');
          if (!seen.has(pos)) { positions.push(pos); seen.add(pos); }
        }
      }
      // La franja de suelo es una ubicación real del bloque (p.ej. 'SUELO AMADA').
      if (block.floorPosition && !seen.has(block.floorPosition)) {
        positions.push(block.floorPosition);
        seen.add(block.floorPosition);
      }
    }
    return positions;
  }
  const positions: string[] = [];
  for (let i = 1; i <= shelf.locationCount; i++) {
    positions.push(i.toString().padStart(3, '0'));
  }
  return positions;
};


