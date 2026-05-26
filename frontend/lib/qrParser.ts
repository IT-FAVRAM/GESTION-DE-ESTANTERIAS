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
 * Parser lenient para OCR — busca el patrón OF en cualquier parte
 * del texto y toma el resto como código de artículo.
 *
 * Acepta:
 *   "CL34712023 OF25-07221"          (espacio)
 *   "CL34712023\nOF25-07221"         (multilínea)
 *   "ARTÍCULO: CL34712023 OF25-07221" (con etiquetas)
 *   "CL34712023 // OF25-07221"        (separador clásico)
 *   "OF25-07221 CL34712023"           (orden invertida)
 */
export const parseScanInputLenient = (rawInput: string): ScanParseResult => {
  if (!rawInput || typeof rawInput !== 'string') {
    return { success: false, error: 'No se recibió ningún dato', rawInput: '' };
  }

  // Normaliza: une saltos de línea, colapsa espacios, mayúsculas, corrige OCR típico
  const cleaned = rawInput
    .trim()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    // Correcciones OCR típicas para caracteres mal reconocidos
    .replace(/\b0F(\d{2}-\d+)/gi, 'OF$1')          // 0F → OF
    .replace(/\bO(?=\d{2}-\d+)/g, 'OF')             // O25- → OF25-
    .replace(/\b0F\s*(\d{2,3})[-\s](\d+)/gi, 'OF$1-$2') // 0F 25 07221 → OF25-07221
    .replace(/(\d)[|!¡](\d)/g, '$1I$2')             // dígito-|!¡-dígito
    .replace(/[|!¡]/g, 'I')                           // | → I
    .replace(/0(?=[A-Z])/g, 'O')                     // 0 seguido de letra → O
    .replace(/(?<=\d)5(?=\d)/g, 'S')                 // 5 entre dígitos → S (caso raro)
    .replace(/©/g, 'C')                              // © → C
    .replace(/®/g, 'R')                              // ® → R
    // Guiones confundidos con otros caracteres
    .replace(/[–—―]/g, '-')
    .replace(/\s*\/\/?\s*/g, ' // ')                // / simple → // con espacios
    // Colapsar espacios múltiples de nuevo
    .replace(/\s+/g, ' ')
    .toUpperCase();

  if (!cleaned) {
    return { success: false, error: 'El texto está vacío', rawInput };
  }

  // 1º intenta el parser estricto (formatos clásicos de pistola)
  const strict = parseScanInput(cleaned);
  if (strict.success) return strict;

  // 2º busca el patrón OF en cualquier parte (con o sin guion)
  const ofMatch = cleaned.match(/OF\d{2}-\d{3,}/);
  let orderFab = '';
  if (!ofMatch) {
    // Buscar OF seguido de espacios + dígitos (OCR a veces omite el guion)
    const noHyphenMatch = cleaned.match(/OF\s*(\d{2})\s*[-–—]?\s*(\d{3,})/);
    if (noHyphenMatch) {
      orderFab = `OF${noHyphenMatch[1]}-${noHyphenMatch[2]}`;
    }
  } else {
    orderFab = ofMatch[0];
  }

  if (!orderFab) {
    return {
      success: false,
      error: `No se encontró ningún código OFxx-nnnnn en el texto.\nRecibido: "${cleaned}"`,
      rawInput,
    };
  }

  // 3º extrae el código de artículo: todo lo que no sea el OF ni etiquetas comunes
  const withoutOF = cleaned.replace(orderFab, '');
  const cleanedNoLabels = withoutOF
    .replace(/\b(ART(I|Í)CULO|ARTICLE|REF(ERENCIA)?|ORDEN|ORDER|FABRICACI(O|Ó)N|OF|COD(IGO|Ó)?|PIEZA)\s*:?\s*/gi, '')
    .replace(/[\/\\|–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Toma el token más prometedor como código de artículo
  const tokens = cleanedNoLabels.split(/\s+/).filter(Boolean);
  // Preferir tokens alfanuméricos (letra+número) de longitud razonable
  let articleCode = tokens.find((t) => /[A-Z].*\d|\d.*[A-Z]/.test(t) && t.length >= 4);
  if (!articleCode) articleCode = tokens.find((t) => t.length >= 4);
  if (!articleCode) articleCode = tokens[0];

  if (!articleCode) {
    return {
      success: false,
      error: `Se encontró OF (${orderFab}) pero no un código de artículo válido en: "${cleaned}"`,
      rawInput,
    };
  }

  return {
    success: true,
    data: { articleCode, orderFab },
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


