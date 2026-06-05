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
/**
 * Normaliza texto OCR: une saltos de línea, mayúsculas, corrige las confusiones
 * típicas de OCR en el código de OF y colapsa espacios.
 */
const normalizeOcrText = (rawInput: string): string => {
  return rawInput
    .trim()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase()
    // Guiones y separadores confundidos (aplicar antes de las correcciones OF)
    .replace(/[–—―]/g, '-')
    // Correcciones OCR para "OF" mal reconocido — orden de más específico a más general
    .replace(/\b([0O])F\s*(\d)\s*(\d)\s*[-]?\s*(\d{3,})/g, 'OF$2$3-$4') // 0F 2 5-07221 / OF25 07221
    .replace(/\b0F(\d{2}-\d{3,})/g, 'OF$1')             // 0F25-07221 → OF25-07221 (cero → O)
    .replace(/\b0F\s*(\d{2,3})[-\s](\d{3,})/g, 'OF$1-$2') // 0F 25 07221 → OF25-07221
    .replace(/\bOF\s+(\d{2})\s+(\d{3,})/g, 'OF$1-$2')  // OF 25 07221 → OF25-07221
    .replace(/\bOF\s+(\d{2})-(\d{3,})/g, 'OF$1-$2')    // OF 25-07221 → OF25-07221
    .replace(/\bOF(\d{2})\s+(\d{3,})/g, 'OF$1-$2')     // OF25 07221 → OF25-07221 (guion faltante)
    .replace(/\bO(\d{2}-\d{3,})/g, 'OF$1')              // O25-07221 → OF25-07221 (F faltante)
    // Confusión O↔0 dentro del número de OF: OF25-O7221 → OF25-07221
    .replace(/\bOF(\d{2})-([0O])(\d{4,})/g, (_, yr, _z, rest) => `OF${yr}-0${rest}`)
    // Dígitos separados en el año de OF: OF 2 5-07221 → OF25-07221
    .replace(/\bOF\s*(\d)\s*(\d)\s*[-]\s*(\d{3,})/g, 'OF$1$2-$3')
    // Correcciones de caracteres individuales
    .replace(/[|!¡]/g, 'I')                             // | ! ¡ → I
    .replace(/©/g, 'C')                                 // © → C
    .replace(/®/g, 'R')                                 // ® → R
    .replace(/\$/g, 'S')                                // $ → S (confusión OCR)
    .replace(/\b0([A-Z])/g, 'O$1')                     // 0B → OB (0 inicial confundido con O)
    .replace(/\s*\/\/?\s*/g, ' // ')                    // / simple → // con espacios
    // Colapsar espacios múltiples
    .replace(/\s+/g, ' ')
    .trim();
};

/** Extrae el código OFxx-nnnnn de un texto YA normalizado; '' si no hay. */
const extractOF = (cleaned: string): string => {
  const ofMatch = cleaned.match(/OF\d{2}-\d{3,}/);
  if (ofMatch) return ofMatch[0];
  // OF seguido de espacios + dígitos (OCR a veces omite el guion)
  const noHyphenMatch = cleaned.match(/OF\s*(\d{2})\s*[-–—]?\s*(\d{3,})/);
  if (noHyphenMatch) return `OF${noHyphenMatch[1]}-${noHyphenMatch[2]}`;
  return '';
};

/**
 * Extrae el código de artículo de un texto (idealmente ya sin la OF). Quita
 * etiquetas comunes y toma el token más prometedor.
 */
const extractArticleCode = (text: string): string => {
  const cleanedNoLabels = text
    .replace(/\b(ART(I|Í)CULO|ARTICLE|REF(ERENCIA)?|ORDEN|ORDER|FABRICACI(O|Ó)N|OF|COD(IGO|Ó)?|PIEZA)\s*:?\s*/gi, '')
    .replace(/[\/\\|–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = cleanedNoLabels.split(/\s+/).filter(Boolean);
  // 1º: token alfanumérico (letra+número) más largo — artículos industriales típicos
  let articleCode = tokens
    .filter((t) => /[A-Z].*\d|\d.*[A-Z]/.test(t) && t.length >= 4)
    .sort((a, b) => b.length - a.length)[0];
  // 2º: token más largo de al menos 4 chars
  if (!articleCode) articleCode = tokens.filter((t) => t.length >= 4).sort((a, b) => b.length - a.length)[0];
  // 3º: primer token disponible
  if (!articleCode) articleCode = tokens[0];
  return articleCode || '';
};

export const parseScanInputLenient = (rawInput: string): ScanParseResult => {
  if (!rawInput || typeof rawInput !== 'string') {
    return { success: false, error: 'No se recibió ningún dato', rawInput: '' };
  }

  const cleaned = normalizeOcrText(rawInput);
  if (!cleaned) {
    return { success: false, error: 'El texto está vacío', rawInput };
  }

  // 1º intenta el parser estricto (formatos clásicos de pistola)
  const strict = parseScanInput(cleaned);
  if (strict.success) return strict;

  // 2º busca el patrón OF en cualquier parte (con o sin guion)
  const orderFab = extractOF(cleaned);
  if (!orderFab) {
    return {
      success: false,
      error: `No se encontró ningún código OFxx-nnnnn en el texto.\nRecibido: "${cleaned}"`,
      rawInput,
    };
  }

  // 3º extrae el código de artículo: todo lo que no sea el OF ni etiquetas comunes
  const articleCode = extractArticleCode(cleaned.replace(orderFab, ''));
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
 * Parseo OCR orientado a etiquetas multilínea: cuando la OF está en una línea y
 * el código de artículo en la línea inmediatamente inferior (caso típico de las
 * etiquetas de OF). Busca la primera línea con OF y, si esa misma línea no trae
 * el artículo, toma la siguiente línea como código de artículo.
 *
 * Devuelve ScanError si no hay OF en ninguna línea — el llamador debe entonces
 * caer al parser lenient sobre el texto completo, y si tampoco, a foto manual.
 */
export const parseScanFromLines = (lines: string[]): ScanParseResult => {
  const rawInput = Array.isArray(lines) ? lines.join('\n') : '';
  if (!Array.isArray(lines) || lines.length === 0) {
    return { success: false, error: 'Sin líneas OCR', rawInput };
  }

  const norm = lines.map((l) => normalizeOcrText(l)).filter((l) => l.length > 0);

  for (let i = 0; i < norm.length; i++) {
    const of = extractOF(norm[i]);
    if (!of) continue;

    // Si la propia línea de la OF ya trae el artículo, úsalo.
    const sameLine = extractArticleCode(norm[i].replace(of, ''));
    if (sameLine) {
      return { success: true, data: { articleCode: sameLine, orderFab: of } };
    }

    // Si no, el artículo casi siempre está en la línea inmediatamente inferior.
    if (i + 1 < norm.length) {
      const below = extractArticleCode(norm[i + 1]);
      if (below) {
        return { success: true, data: { articleCode: below, orderFab: of } };
      }
    }

    return {
      success: false,
      error: `Se detectó ${of} pero no el código de artículo debajo.`,
      rawInput,
    };
  }

  return {
    success: false,
    error: 'No se encontró ningún código OFxx-nnnnn en las líneas.',
    rawInput,
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


