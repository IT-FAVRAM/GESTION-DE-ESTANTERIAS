export interface ChaperaItem {
  id: string;
  material: string;
  spec?: string;
  espesor: string;
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
