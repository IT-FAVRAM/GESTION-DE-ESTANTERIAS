/**
 * QR/Barcode Parser — Parseo de códigos escaneados con pistola
 * Gestor de Estanterías WMS v3.0
 * 
 * Formato esperado: "CL34712023 // OF25-07221"
 *   → articleCode: "CL34712023"
 *   → orderFab: "OF25-07221"
 * 
 * La pistola USB estándar emula un teclado y envía Enter al final.
 */

// ─── Types ───

export interface ParsedScan {
  /** Código del artículo (ej: "CL34712023") */
  articleCode: string;
  /** Orden de fabricación (ej: "OF25-07221") */
  orderFab: string;
}

export interface ScanResult {
  success: true;
  data: ParsedScan;
}

export interface ScanError {
  success: false;
  error: string;
  rawInput: string;
}

export type ScanParseResult = ScanResult | ScanError;

// ─── Regex Patterns ───

/**
 * Patrón principal: artículo // OFxx-nnnnn
 * Grupo 1: código del artículo (cualquier cosa antes de //)
 * Grupo 2: orden de fabricación (OFxx-nnnnn)
 */
const MAIN_PATTERN = /^(.+?)\s*\/\/\s*(OF\d{2}-\d+)$/i;

/**
 * Patrón alternativo con otros separadores: artículo <espacio>-<espacio> OFxx-nnnnn
 * Requiere espacios alrededor del separador para no confundirlo con guiones en el código de artículo
 */
const ALT_PATTERN = /^(.+?)\s+[-–—]\s+(OF\d{2}-\d+)$/i;

/**
 * Validación del formato de OF: empieza por "OF" + 2 dígitos del año + "-" + números
 */
const OF_PATTERN = /^OF\d{2}-\d+$/i;

// ─── Core Parser ───

/**
 * Parsea el texto recibido del escáner.
 * 
 * @param rawInput - Texto completo enviado por la pistola
 * @returns ScanResult con los datos parseados o ScanError con descripción del error
 * 
 * @example
 * parseScanInput("CL34712023 // OF25-07221")
 * // → { success: true, data: { articleCode: "CL34712023", orderFab: "OF25-07221" } }
 */
export const parseScanInput = (rawInput: string): ScanParseResult => {
  if (!rawInput || typeof rawInput !== 'string') {
    return { success: false, error: 'No se recibió ningún dato del escáner', rawInput: '' };
  }
  
  // Limpiar input: trim, eliminar caracteres de control
  const cleaned = rawInput
    .trim()
    .replace(/[\r\n\t]/g, '')
    .replace(/\s+/g, ' ');
  
  if (cleaned.length === 0) {
    return { success: false, error: 'El código escaneado está vacío', rawInput };
  }
  
  // Intentar patrón principal (// como separador)
  let match = cleaned.match(MAIN_PATTERN);
  
  if (!match) {
    // Intentar patrón alternativo (- como separador, solo si tiene OF)
    match = cleaned.match(ALT_PATTERN);
  }
  
  if (!match) {
    return {
      success: false,
      error: `Formato no reconocido. Se espera: "ARTÍCULO // OFxx-nnnnn"\nRecibido: "${cleaned}"`,
      rawInput,
    };
  }
  
  const articleCode = match[1].trim().toUpperCase();
  const orderFab = match[2].trim().toUpperCase();
  
  // Validar que el artículo no esté vacío
  if (!articleCode) {
    return { success: false, error: 'El código del artículo está vacío', rawInput };
  }
  
  // Validar formato de OF
  if (!OF_PATTERN.test(orderFab)) {
    return {
      success: false,
      error: `Formato de OF no válido: "${orderFab}". Se espera OFxx-nnnnn`,
      rawInput,
    };
  }
  
  return {
    success: true,
    data: {
      articleCode,
      orderFab,
    },
  };
};

/**
 * Formatea un artículo para mostrar en la UI.
 * "CL34712023 (OF25-07221)"
 */
export const formatArticleDisplay = (articleCode: string, orderFab: string): string => {
  return `${articleCode} (${orderFab})`;
};

/**
 * Formatea un artículo de forma corta.
 * "CL347...23"
 */
export const formatArticleShort = (articleCode: string, maxLength = 10): string => {
  if (articleCode.length <= maxLength) return articleCode;
  const half = Math.floor((maxLength - 3) / 2);
  return `${articleCode.slice(0, half)}...${articleCode.slice(-half)}`;
};
