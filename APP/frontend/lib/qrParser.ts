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
 * Patrón del QR físico de FAVRAM: artículo <pipe> OFxx-nnnnn
 * El QR devuelve siempre el par literal "ARTÍCULO | OFxx-nnnnn".
 */
const PIPE_PATTERN = /^(.+?)\s*\|\s*(OF\d{2}-\d+)$/i;

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
    // QR físico de FAVRAM: "ARTÍCULO | OFxx-nnnnn"
    match = cleaned.match(PIPE_PATTERN);
  }

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
    .replace(/\bHoja\b/gi, '')
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
  // Un código de artículo siempre lleva dígitos — sin este filtro, residuos de
  // etiquetas como "O.F." o "Nº" acababan devueltos como artículo.
  const hasDigits = (t: string) => (t.match(/\d/g) || []).length >= 2;
  // 1º: token alfanumérico (letra+número) más largo — artículos industriales típicos
  let articleCode = tokens
    .filter((t) => /[A-Z].*\d|\d.*[A-Z]/.test(t) && t.length >= 4)
    .sort((a, b) => b.length - a.length)[0];
  // 2º: token numérico/mixto más largo de al menos 4 chars
  if (!articleCode) articleCode = tokens.filter((t) => t.length >= 4 && hasDigits(t)).sort((a, b) => b.length - a.length)[0];
  // 3º: primer token con dígitos
  if (!articleCode) articleCode = tokens.find(hasDigits) || '';
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

// ─── Hoja de Ruta (Solmicro) ─────────────────────────────────────────────────

/** Token con pinta de fecha: 24/06/2026, 24-06-26 o pegada (24062026 / 20260624). */
const isDateLikeToken = (t: string): boolean => {
  if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(t)) return true;
  if (/^[0-3]\d(0\d|1[0-2])(19|20)\d{2}$/.test(t)) return true; // ddmmyyyy
  if (/^(19|20)\d{2}(0\d|1[0-2])[0-3]\d$/.test(t)) return true; // yyyymmdd
  return false;
};

/**
 * ¿Puede este token ser un código de artículo? El formato es LIBRE (numérico,
 * alfanumérico, con guiones/puntos...) — solo se descarta lo que seguro NO es
 * un artículo: fechas, OFs, palabras sin ningún dígito (etiquetas,
 * descripciones) y números cortos (años, centros tipo 1200, cantidades).
 */
const isPlausibleHojaArticle = (raw: string): boolean => {
  const t = raw.replace(/[.,:;]+$/g, '');
  if (t.length < 4 || t.length > 25) return false;
  if (/^OF\d{2}/.test(t)) return false; // es una OF
  if (isDateLikeToken(t)) return false; // es una fecha
  if (!/\d/.test(t)) return false; // los códigos siempre llevan algún dígito
  if (/^\d{1,5}$/.test(t)) return false; // años (2026), centros (1200), cantidades
  return true;
};

/**
 * Parser específico para la Hoja de Ruta de Solmicro (FAVRAM): el operario
 * fotografía el recuadro de cabecera con "O.F. Nº: OF26-05481" y
 * "Artículo: 20230110001".
 *
 * El FORMATO del artículo es libre — lo que se le enseña al parser es DÓNDE
 * mirar. Estrategia (de más a menos confianza):
 *  1. OF anclada a su etiqueta "O.F. Nº" (ignora las OFs del bloque
 *     "Histórico OFs" del pie, que son de órdenes ANTERIORES).
 *  2. Artículo: el valor pegado a la etiqueta "Artículo:" en la misma línea.
 *  3. Si Vision separó etiqueta y valor: primer código plausible en las
 *     líneas inmediatamente posteriores a la etiqueta.
 *  4. Votación por frecuencia: el artículo se repite en la cabecera y en cada
 *     fase de la hoja — el token con pinta de código más repetido gana
 *     (descartando fechas, OFs y números cortos).
 *
 * Acepta líneas OCR (ideal, en orden de lectura) o un string multilínea.
 * Devuelve ScanError si falta alguno de los dos campos — el llamador debe
 * caer entonces a parseScanFromLines / parseScanInputLenient.
 */
export const parseHojaDeRuta = (input: string[] | string): ScanParseResult => {
  const rawLines = Array.isArray(input) ? input : String(input || '').split(/\r?\n/);
  const rawInput = rawLines.join('\n');
  const norm = rawLines.map((l) => normalizeOcrText(l)).filter((l) => l.length > 0);
  if (norm.length === 0) {
    return { success: false, error: 'Sin texto OCR', rawInput };
  }

  // Las OFs a partir de "Histórico OFs" no son la OF actual de la hoja.
  const histIdx = norm.findIndex((l) => /HIST[OÓ]RIC/.test(l));
  const ofScope = histIdx === -1 ? norm : norm.slice(0, histIdx);

  // ── OF: 1º línea con etiqueta "O.F. Nº", 2º primera OF del documento ──
  let orderFab = '';
  for (const l of ofScope) {
    if (/\bO\.?\s*F\.?\s*N/.test(l)) {
      orderFab = extractOF(l);
      if (orderFab) break;
    }
  }
  if (!orderFab) {
    for (const l of ofScope) {
      orderFab = extractOF(l);
      if (orderFab) break;
    }
  }

  // ── Artículo 1º: el valor pegado a la etiqueta "Artículo:" (formato libre) ──
  let articleCode = '';
  for (const l of norm) {
    const m = l.match(/ART[IÍ]?CULO\s*[:.\-]?\s*(\S+)/);
    if (m && isPlausibleHojaArticle(m[1])) {
      articleCode = m[1].replace(/[.,:;]+$/g, '');
      break;
    }
  }

  // ── 2º: etiqueta sin valor en su línea (Vision los separó) — buscar el
  //    primer código plausible en las líneas siguientes a la etiqueta ──
  if (!articleCode) {
    const labelIdx = norm.findIndex((l) => /ART[IÍ]?CULO/.test(l));
    if (labelIdx !== -1) {
      for (let i = labelIdx; i < Math.min(norm.length, labelIdx + 4) && !articleCode; i++) {
        for (const tok of norm[i].split(/\s+/)) {
          const t = tok.replace(/[.,:;]+$/g, '');
          if (isPlausibleHojaArticle(t)) {
            articleCode = t;
            break;
          }
        }
      }
    }
  }

  // ── 3º: votación por frecuencia entre tokens con pinta de código —
  //    el artículo se repite en la cabecera y en cada fase de la hoja.
  //    Empate → gana el que aparece más arriba (la cabecera es lo primero). ──
  if (!articleCode) {
    const votes = new Map<string, { count: number; firstIdx: number }>();
    norm.forEach((l, idx) => {
      for (const tok of l.split(/\s+/)) {
        const t = tok.replace(/[.,:;]+$/g, '');
        if (!isPlausibleHojaArticle(t)) continue;
        const v = votes.get(t);
        if (v) v.count += 1;
        else votes.set(t, { count: 1, firstIdx: idx });
      }
    });
    const best = [...votes.entries()].sort(
      (a, b) => b[1].count - a[1].count || a[1].firstIdx - b[1].firstIdx,
    )[0];
    if (best) articleCode = best[0];
  }

  if (orderFab && articleCode) {
    return { success: true, data: { articleCode, orderFab } };
  }
  return {
    success: false,
    error: !orderFab
      ? 'No se encontró la O.F. en la hoja de ruta.'
      : `Se encontró ${orderFab} pero no el código de artículo.`,
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


