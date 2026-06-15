import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/index.js';

export type CountMode = 'stacked' | 'loose';

export interface PieceCountResult {
  ok: boolean;
  mode: CountMode;
  count: number | null;
  confidencePct: number;
  range: { min: number; max: number } | null;
  method: string;
  reasoning: string;
  warnings: string[];
}

export interface CountPiecesParams {
  imageBase64: string;
  mode: CountMode;
  /** Espesor en mm de cada pieza (obligatorio en modo 'stacked'). */
  thicknessMm?: number;
}

/**
 * Envía una foto a la Cloud Function `countPieces` (Claude Opus 4.8 visión) y
 * devuelve el conteo de piezas con confianza, rango y avisos. Usado por la
 * herramienta de conteo de la sección PUNZONADO.
 */
export const countPieces = async (params: CountPiecesParams): Promise<PieceCountResult> => {
  const callable = httpsCallable(functions, 'countPieces');
  const result = await callable(params);
  const data = (result?.data || {}) as Partial<PieceCountResult>;
  return {
    ok: !!data.ok,
    mode: data.mode === 'loose' ? 'loose' : 'stacked',
    count: typeof data.count === 'number' ? data.count : null,
    confidencePct: typeof data.confidencePct === 'number' ? data.confidencePct : 0,
    range:
      data.range && typeof data.range.min === 'number' && typeof data.range.max === 'number'
        ? { min: data.range.min, max: data.range.max }
        : null,
    method: String(data.method || ''),
    reasoning: String(data.reasoning || ''),
    warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
  };
};
