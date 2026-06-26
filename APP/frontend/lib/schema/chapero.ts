export interface ChaperaItem {
  id: string;
  material: string;
  spec?: string;
  espesor: string;
  albaran?: string;
  locatedBy: string;
  locatedByName: string;
  locatedAt: string;
}

export interface ChaperoPositionDoc {
  positionId: string;
  side: 'L' | 'R';
  column: number;
  level: number;
  items: ChaperaItem[];
  isEmpty: boolean;
}

export const CHAPERO_COLS = 16;
export const CHAPERO_LEVELS = 5;

export const CHAPERO_MATERIALS = [
  'ACERO',
  'ALUMINIO',
  'INOX',
  'GALVANIZADO',
  'COBRE',
  'LATÓN',
  'OTRO',
] as const;

export const CHAPERO_ESPESORES = [
  '0.5', '0.6', '0.8', '1.0', '1.2', '1.5', '2.0', '2.5', '3.0', '4.0', '5.0', '6.0',
] as const;

/** Estilo visual por material — color de celda, texto y punto de leyenda. */
export interface ChaperoMaterialStyle {
  /** Clases de fondo + borde para la celda ocupada. */
  cell: string;
  /** Clase de color de texto dentro de la celda / chip. */
  text: string;
  /** Clase de color del punto de la leyenda. */
  dot: string;
}

const MATERIAL_STYLES: Record<string, ChaperoMaterialStyle> = {
  ACERO:       { cell: 'bg-slate-100 border-slate-400',   text: 'text-slate-700',   dot: 'bg-slate-500' },
  ALUMINIO:    { cell: 'bg-sky-100 border-sky-400',        text: 'text-sky-800',     dot: 'bg-sky-500' },
  INOX:        { cell: 'bg-blue-100 border-blue-500',      text: 'text-blue-800',    dot: 'bg-blue-600' },
  GALVANIZADO: { cell: 'bg-teal-100 border-teal-400',      text: 'text-teal-800',    dot: 'bg-teal-500' },
  COBRE:       { cell: 'bg-orange-100 border-orange-400',  text: 'text-orange-800',  dot: 'bg-orange-500' },
  'LATÓN':     { cell: 'bg-amber-100 border-amber-500',    text: 'text-amber-800',   dot: 'bg-amber-500' },
};

/** Estilo para materiales personalizados / desconocidos (OTRO). */
const OTHER_MATERIAL_STYLE: ChaperoMaterialStyle = {
  cell: 'bg-violet-100 border-violet-400',
  text: 'text-violet-800',
  dot: 'bg-violet-500',
};

export const getMaterialStyle = (material: string): ChaperoMaterialStyle =>
  MATERIAL_STYLES[material.trim().toUpperCase()] ?? OTHER_MATERIAL_STYLE;

export const formatChaperoPositionId = (side: 'L' | 'R', column: number, level: number): string =>
  `${side}${String(column).padStart(2, '0')}-${level}`;

export const parseChaperoPositionId = (positionId: string): { side: 'L' | 'R'; column: number; level: number } | null => {
  const m = positionId.match(/^([LR])(\d{2})-(\d)$/);
  if (!m) return null;
  return { side: m[1] as 'L' | 'R', column: parseInt(m[2], 10), level: parseInt(m[3], 10) };
};

export const generateChaperoPositions = (): string[] => {
  const positions: string[] = [];
  for (const side of ['L', 'R'] as const) {
    for (let col = 1; col <= CHAPERO_COLS; col++) {
      for (let lv = 1; lv <= CHAPERO_LEVELS; lv++) {
        positions.push(formatChaperoPositionId(side, col, lv));
      }
    }
  }
  return positions;
};
