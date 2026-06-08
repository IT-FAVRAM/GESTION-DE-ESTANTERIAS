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
}

// ── SHELF DEFINITIONS ────────────────────────────────────────────────────────

export const SHELF_DEFINITIONS: Shelf[] = [
  {
    code: 'PRE',
    name: 'Prensas',
    section: 'PRENSAS_MECANIZADO',
    type: 'shelf',
    locationCount: 13,
    layout: {
      zones: [
        { name: 'ESTANTERIA PRINCIPAL', range: [1, 9], color: '#3b82f6' },
        { name: 'URG MEC-PRE', range: [0, 0], color: '#ef4444', isUrgent: true },
      ],
      physicalBlocks: [
        {
          id: 'pre-main',
          title: 'Estanteria principal',
          subtitle: '3 filas x 3 columnas',
          zoneName: 'ESTANTERIA PRINCIPAL',
          rows: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
        },
        {
          id: 'pre-urg-shared',
          title: 'URG MEC-PRE',
          subtitle: 'Compartidas con Mecanizado · 4 ubicaciones',
          zoneName: 'URG MEC-PRE',
          rows: [
            ['URG MEC-PRE 001'],
            ['URG MEC-PRE 002'],
            ['URG MEC-PRE 003'],
            ['URG MEC-PRE 004'],
          ],
        },
      ],
    },
  },
  {
    code: 'MEC',
    name: 'Mecanizado',
    section: 'PRENSAS_MECANIZADO',
    type: 'shelf',
    locationCount: 37,
    layout: {
      zones: [
        { name: 'URG MEC-PRE', range: [0, 0], color: '#ef4444', isUrgent: true },
        { name: 'PRINCIPAL', range: [14, 46], color: '#f97316' },
      ],
      physicalBlocks: [
        {
          id: 'mec-urg-shared',
          title: 'URG MEC-PRE',
          subtitle: 'Compartidas con Prensas · 4 ubicaciones',
          zoneName: 'URG MEC-PRE',
          rows: [
            ['URG MEC-PRE 001'],
            ['URG MEC-PRE 002'],
            ['URG MEC-PRE 003'],
            ['URG MEC-PRE 004'],
          ],
        },
        {
          id: 'mec-main',
          title: 'Mecanizado',
          subtitle: '4 filas · 9 columnas (33 ubicaciones)',
          zoneName: 'PRINCIPAL',
          // Misma forma que antes. Numeración desplazada +13 para cuerpos 1-2 (001-021 → 014-034)
          // y +16 para cuerpo3 (022-030 → 038-046). 3 celdas nuevas en fila 1 de cuerpo3 (035-037).
          // Cols 0-2 = cuerpo1 (014-025). Cols 3-5 = cuerpo2 (026-034, filas 2-4).
          // Cols 6-8 = cuerpo3 (035-037 fila 1 nuevas; 038-046 filas 2-4 renumeradas).
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
        { name: 'PUNZONADORA', range: [33, 65], color: '#f59e0b' },
      ],
      physicalBlocks: [
        {
          id: 'ple-punz-izq',
          title: 'Punzonadora Izquierda',
          subtitle: '054-065 · 4 baldas superiores',
          zoneName: 'PUNZONADORA',
          rows: [
            [54, 55, 56],
            [57, 58, 59],
            [60, 61, 62],
            [63, 64, 65],
            [null, null, null],
            [null, null, null],
            [null, null, null],
          ],
        },
        {
          id: 'ple-punz',
          title: 'Punzonadora Derecha',
          subtitle: '033-053 · 7 filas · 3 columnas',
          zoneName: 'PUNZONADORA',
          rows: [
            [33, 34, 35],
            [36, 37, 38],
            [39, 40, 41],
            [42, 43, 44],
            [45, 46, 47],
            [48, 49, 50],
            [51, 52, 53],
          ],
        },
        {
          id: 'ple-est1',
          title: 'Estanteria 1',
          subtitle: 'Urgentes (001-006) en filas inferiores',
          zoneName: 'ESTANTERIA 1',
          rows: [
            [7,  8,  17, 18],
            [9,  10, 19, 20],
            [11, 12, 21, 22],
            [13, 14, 23, 24],
            [15, 16, 25, 26],
            [1,  2,  27, 28],
            [3,  4,  29, 30],
            [5,  6,  31, 32],
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
    locationCount: 54,
    layout: {
      zones: [
        { name: 'PRINCIPAL', range: [1, 7], color: '#3b82f6' },
        { name: 'URGENTE', range: [8, 8], color: '#ef4444', isUrgent: true },
        { name: 'PRINCIPAL 2', range: [9, 21], color: '#0ea5e9' },
        { name: 'ESTANTERIA 3', range: [22, 36], color: '#14b8a6' },
        { name: 'ESTANTERIA 4', range: [37, 54], color: '#f59e0b' },
      ],
      physicalBlocks: [
        {
          id: 'sol-main',
          title: 'Estantería Soldadura',
          subtitle: '001-054 · Vista continua',
          fullWidth: true,
          rows: [
            [7,    null, null, null, null, null, null, null, null, null],
            [6,    11,   16,   21,   22,   23,   24,   37,   38,   39  ],
            [5,    10,   15,   20,   25,   26,   27,   40,   41,   42  ],
            [4,    9,    14,   19,   28,   29,   30,   43,   44,   45  ],
            [3,    null, 13,   18,   31,   32,   33,   46,   47,   48  ],
            [2,    null, null, null, 34,   35,   36,   49,   50,   51  ],
            [1,    8,    12,   17,   null, null, null, 52,   53,   54  ],
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
          rows: [[1, 2], [3, 4], [5, 6], [7, 8]],
        },
      ],
    },
  },
  {
    code: 'REP',
    name: 'Repasado',
    section: 'REPASADO',
    type: 'shelf',
    locationCount: 39,
    layout: {
      zones: [
        { name: 'URGENTE', range: [1, 4], color: '#ef4444', isUrgent: true },
        { name: 'ALUMINIO', range: [5, 14], color: '#eab308' },
        { name: 'GENERAL', range: [15, 24], color: '#3b82f6' },
        { name: 'MODULAR', range: [25, 39], color: '#8b5cf6' },
      ],
      physicalBlocks: [
        {
          id: 'rep-urgent',
          title: 'Urgente',
          subtitle: '001-004',
          zoneName: 'URGENTE',
          rows: [[1], [2], [3], [4]],
        },
        {
          id: 'rep-alu1',
          title: 'Aluminio 1',
          subtitle: '005-009',
          zoneName: 'ALUMINIO',
          rows: [[5], [6], [7], [8], [9]],
        },
        {
          id: 'rep-alu2',
          title: 'Aluminio 2',
          subtitle: '010-014',
          zoneName: 'ALUMINIO',
          rows: [[10], [11], [12], [13], [14]],
        },
        {
          id: 'rep-general',
          title: 'General',
          subtitle: '015-024',
          zoneName: 'GENERAL',
          fullWidth: true,
          rows: [[15, 16], [17, 18], [19, 20], [21, 22], [23, 24]],
        },
        {
          id: 'rep-modular',
          title: 'Almacen Modular',
          subtitle: '025-039',
          zoneName: 'MODULAR',
          fullWidth: true,
          rows: [[25, 26, 27], [28, 29, 30], [31, 32, 33], [34, 35, 36], [37, 38, 39]],
        },
      ],
    },
  },
  {
    code: 'PIN',
    name: 'Pintura',
    section: 'PINTURA',
    type: 'shelf',
    locationCount: 24,
    layout: {
      zones: [
        { name: 'DENTRO', range: [1, 15], color: '#3b82f6' },
        { name: 'FUERA', range: [16, 24], color: '#f97316' },
      ],
      physicalBlocks: [
        {
          id: 'pin-dentro',
          title: 'Estanteria 1',
          subtitle: 'Dentro · 001-015',
          zoneName: 'DENTRO',
          rows: [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12, 13, 14, 15]],
        },
        {
          id: 'pin-fuera',
          title: 'Estanteria 2',
          subtitle: 'Fuera · 016-024',
          zoneName: 'FUERA',
          rows: [[16, 17, 18], [19, 20, 21], [22, 23, 24]],
        },
      ],
    },
  },
  {
    code: 'SXP',
    name: 'Soldadura Puntos',
    section: 'SOLDADURA',
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
          rows: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]],
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
          rows: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12], [13, 14, 15], [16, 17, 18]],
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
        { name: 'GENERAL', range: [1, 21], color: '#f97316' },
        { name: 'AUTOPLEGADO', range: [22, 35], color: '#f97316' }
      ],
      physicalBlocks: [
        {
          id: 'rpl-main',
          title: 'Estantería 1 Autoplegadora',
          subtitle: '001-021 · 7 filas · 3 columnas',
          zoneName: 'GENERAL',
          rows: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12], [13, 14, 15], [16, 17, 18], [19, 20, 21]],
        },
        {
          id: 'rpl-autoplegado',
          title: 'Estantería 2 Autoplegado',
          subtitle: '022-035 · 7 filas · 2 columnas',
          zoneName: 'AUTOPLEGADO',
          rows: [[22, 23], [24, 25], [26, 27], [28, 29], [30, 31], [32, 33], [34, 35]],
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
          title: 'Reprocesos (Estanteria 1)',
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
          title: 'Estanteria 2',
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
    section: 'REPASADO',
    type: 'shelf',
    locationCount: 5,
    layout: {
      zones: [{ name: 'BALDAS', range: [1, 5], color: '#3b82f6' }],
      physicalBlocks: [
        {
          id: 'zin-baldas',
          title: 'Baldas Zincado',
          zoneName: 'BALDAS',
          rows: [[1], [2], [3], [4], [5]],
        },
      ],
    },
  },
];

export const CART_DEFINITIONS: Shelf[] = [
  {
    code: 'RSOL',
    name: 'Repuestos Soldadura',
    section: 'SOLDADURA',
    type: 'cart',
    locationCount: 8,
    layout: {
      zones: [{ name: 'BALDAS', range: [1, 8], color: '#10b981' }],
      physicalBlocks: [
        {
          id: 'rsol-main',
          title: 'Repuestos Soldadura',
          subtitle: '8 baldas',
          zoneName: 'BALDAS',
          rows: [[1], [2], [3], [4], [5], [6], [7], [8]],
        },
      ],
    },
  },
  {
    code: 'CSOL',
    name: 'Carro Soldadura',
    section: 'SOLDADURA',
    type: 'cart',
    locationCount: 8,
    layout: {
      zones: [{ name: 'BALDAS', range: [1, 8], color: '#10b981' }],
      physicalBlocks: [
        {
          id: 'csol-main',
          title: 'Carro Soldadura',
          subtitle: '8 baldas',
          zoneName: 'BALDAS',
          rows: [[1], [2], [3], [4], [5], [6], [7], [8]],
        },
      ],
    },
  },
  {
    code: 'CSXP',
    name: 'Carro SXP',
    section: 'SOLDADURA',
    type: 'cart',
    locationCount: 4,
    layout: {
      zones: [{ name: 'BALDAS', range: [1, 4], color: '#10b981' }],
      physicalBlocks: [
        {
          id: 'csxp-main',
          title: 'Carro SXP',
          subtitle: '4 baldas',
          zoneName: 'BALDAS',
          rows: [[1], [2], [3], [4]],
        },
      ],
    },
  },
  {
    code: 'CRPL',
    name: 'Carro Autoplegadora',
    section: 'AUTOPLEGADORA',
    type: 'cart',
    locationCount: 4,
    layout: {
      zones: [{ name: 'BALDAS', range: [1, 4], color: '#10b981' }],
      physicalBlocks: [
        {
          id: 'crpl-main',
          title: 'Carro Autoplegadora',
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
    if (isNaN(posNum)) return false;
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
  return shelf.layout.zones.some((z) => z.name === 'ALUMINIO' && position >= z.range[0] && position <= z.range[1]);
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
    }
    return positions;
  }
  const positions: string[] = [];
  for (let i = 1; i <= shelf.locationCount; i++) {
    positions.push(i.toString().padStart(3, '0'));
  }
  return positions;
};


