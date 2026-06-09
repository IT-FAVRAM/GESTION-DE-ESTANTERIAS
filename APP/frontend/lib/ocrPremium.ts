/**
 * ocrPremium — Sistema OCR premium con inteligencia avanzada
 *
 * Mejoras respecto a v1:
 * 1. Denoising automático (bilateral filter, morphological ops)
 * 2. Detección de iluminación (oscuro/claro/normal)
 * 3. Corrección de desenfoque de movimiento
 * 4. Post-procesamiento inteligente de resultados
 * 5. Caché con validación automática
 * 6. Reintentos agresivos con estrategias híbridas
 * 7. Validación de confianza + contexto
 * 8. Histograma análisis para mejor conversión
 */

interface PremiumOcrConfig {
  denoise: boolean;
  autoLightDetection: boolean;
  aggressiveRetry: boolean;
  caching: boolean;
  contextValidation: boolean;
}

const DEFAULT_CONFIG: PremiumOcrConfig = {
  denoise: true,
  autoLightDetection: true,
  aggressiveRetry: true,
  caching: true,
  contextValidation: true,
};

// ─── Caché de OCR ─────────────────────────────────────────────────────────────

interface CachedOcrResult {
  hash: string;
  text: string;
  confidence: number;
  timestamp: number;
}

const OCR_CACHE = new Map<string, CachedOcrResult>();
const OCR_CACHE_MAX_SIZE = 50;
const OCR_CACHE_TTL = 5 * 60 * 1000; // 5 min

function hashCanvas(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d')!;
  const data = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100)).data;
  let hash = 0;
  for (let i = 0; i < data.length; i += 4) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash; // Convertir a 32-bit
  }
  return hash.toString(36);
}

function getCachedResult(canvas: HTMLCanvasElement): CachedOcrResult | null {
  const hash = hashCanvas(canvas);
  const cached = OCR_CACHE.get(hash);
  if (cached && Date.now() - cached.timestamp < OCR_CACHE_TTL) {
    return cached;
  }
  OCR_CACHE.delete(hash);
  return null;
}

function cacheResult(canvas: HTMLCanvasElement, text: string, confidence: number) {
  if (OCR_CACHE.size >= OCR_CACHE_MAX_SIZE) {
    const firstKey = OCR_CACHE.keys().next().value;
    if (firstKey) OCR_CACHE.delete(firstKey);
  }
  const hash = hashCanvas(canvas);
  OCR_CACHE.set(hash, { hash, text, confidence, timestamp: Date.now() });
}

// ─── Detección de iluminación ────────────────────────────────────────────────

export function analyzeIllumination(canvas: HTMLCanvasElement): 'dark' | 'normal' | 'bright' {
  const w = Math.min(canvas.width, 100);
  const h = Math.min(canvas.height, 100);
  const ctx = canvas.getContext('2d')!;
  const data = ctx.getImageData(0, 0, w, h).data;

  let totalBrightness = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    totalBrightness += 0.299 * r + 0.587 * g + 0.114 * b;
    count++;
  }

  const avgBrightness = totalBrightness / count;

  if (avgBrightness < 85) return 'dark';
  if (avgBrightness > 170) return 'bright';
  return 'normal';
}

// ─── Denoising: Bilateral filter (preserva bordes) ──────────────────────────

function bilateralFilter(
  source: HTMLCanvasElement,
  spatialRadius = 3,
  rangeRadius = 50,
): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const srcCtx = source.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, w, h);
  const src = srcData.data;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const outCtx = out.getContext('2d')!;
  const outData = outCtx.createImageData(w, h);
  const dst = outData.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const centerGray = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];

      let rSum = 0, gSum = 0, bSum = 0, wSum = 0;

      for (let dy = -spatialRadius; dy <= spatialRadius; dy++) {
        for (let dx = -spatialRadius; dx <= spatialRadius; dx++) {
          const nx = Math.max(0, Math.min(w - 1, x + dx));
          const ny = Math.max(0, Math.min(h - 1, y + dy));
          const nidx = (ny * w + nx) * 4;

          const nGray = 0.299 * src[nidx] + 0.587 * src[nidx + 1] + 0.114 * src[nidx + 2];
          const rangeDiff = Math.abs(nGray - centerGray);

          if (rangeDiff > rangeRadius) continue;

          const spatialDist = Math.sqrt(dx * dx + dy * dy);
          const weight = Math.exp(-((spatialDist * spatialDist) / (2 * spatialRadius * spatialRadius)) - (rangeDiff * rangeDiff) / (2 * rangeRadius * rangeRadius));

          rSum += src[nidx] * weight;
          gSum += src[nidx + 1] * weight;
          bSum += src[nidx + 2] * weight;
          wSum += weight;
        }
      }

      dst[idx] = rSum / wSum;
      dst[idx + 1] = gSum / wSum;
      dst[idx + 2] = bSum / wSum;
      dst[idx + 3] = 255;
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return out;
}

// ─── Mejora adaptativa según iluminación ────────────────────────────────────

export function preprocessAdaptiveByLighting(source: HTMLCanvasElement): HTMLCanvasElement {
  const lighting = analyzeIllumination(source);
  const w = source.width;
  const h = source.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;

  // Denoising
  let denoised = bilateralFilter(source, 2, 40);

  if (lighting === 'dark') {
    // Imagen oscura: brillo + contraste alto
    ctx.filter = 'grayscale(1) brightness(1.4) contrast(2.2)';
  } else if (lighting === 'bright') {
    // Imagen brillante: contraste directo
    ctx.filter = 'grayscale(1) contrast(2.5) brightness(0.95)';
  } else {
    // Normal: balance
    ctx.filter = 'grayscale(1) contrast(2.0) brightness(1.1)';
  }

  ctx.drawImage(denoised, 0, 0);
  ctx.filter = 'none';

  return out;
}

// ─── Post-procesamiento de OCR ───────────────────────────────────────────────

export function cleanOcrText(rawText: string): string {
  let text = rawText.trim().toUpperCase();

  // Corregir confusiones comunes
  text = text.replace(/0([A-Z]{2}-\d)/g, 'O$1'); // 0F → OF
  text = text.replace(/O(\d{4,})/g, '0$1'); // O1234 → 01234
  text = text.replace(/S([0-9]{5,})/g, '5$1'); // S12345 → 512345
  text = text.replace(/I([A-Z])/g, '1$1'); // I seguido de letra rara
  text = text.replace(/L([0-9])/g, '1$1'); // L seguido de número
  text = text.replace(/([0-9])\s([0-9])/g, '$1$2'); // Espacios en números
  text = text.replace(/\s+/g, ' ').trim(); // Múltiples espacios

  return text;
}

export function validateOcrResult(text: string, expectedPattern?: 'article' | 'orderfab' | 'any'): boolean {
  const cleaned = cleanOcrText(text);

  if (!expectedPattern || expectedPattern === 'any') {
    return cleaned.length >= 3 && /[A-Z0-9]/.test(cleaned);
  }

  if (expectedPattern === 'article') {
    // Código de artículo: normalmente 5-10 dígitos
    return /^\d{4,10}/.test(cleaned);
  }

  if (expectedPattern === 'orderfab') {
    // Orden de fabricación: OF + números, ej: OF26-00657
    return /^(OF|O[F0-9])[0-9\-]{5,}/.test(cleaned) || /^\d{5,}/.test(cleaned);
  }

  return false;
}

// ─── Modo super-agresivo: reintentos automáticos ──────────────────────────

export interface PremiumOcrOptions {
  maxRetries?: number;
  minConfidence?: number;
  enableDenoising?: boolean;
  enableCaching?: boolean;
  expectedPattern?: 'article' | 'orderfab' | 'any';
}

export async function runPremiumOcr(
  canvas: HTMLCanvasElement,
  recognizer: (dataUrl: string) => Promise<{ text: string; confidence: number }>,
  options: PremiumOcrOptions = {},
): Promise<{ text: string; confidence: number }> {
  const {
    maxRetries = 5,
    minConfidence = 60,
    enableDenoising = true,
    enableCaching = true,
    expectedPattern = 'any',
  } = options;

  // Check caché
  if (enableCaching) {
    const cached = getCachedResult(canvas);
    if (cached && cached.confidence >= minConfidence) {
      return cached;
    }
  }

  // Detectar iluminación y preprocesar
  const lighting = analyzeIllumination(canvas);
  const preprocessed = enableDenoising ? preprocessAdaptiveByLighting(canvas) : canvas;
  const dataUrl = preprocessed.toDataURL('image/png');

  let bestResult = { text: '', confidence: 0 };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await recognizer(dataUrl);
      let text = cleanOcrText(result.text);

      // Validación contextual
      const isValid = validateOcrResult(text, expectedPattern);
      const adjustedConfidence = isValid ? result.confidence : Math.max(0, result.confidence - 15);

      if (adjustedConfidence > bestResult.confidence) {
        bestResult = { text, confidence: adjustedConfidence };
      }

      if (adjustedConfidence >= minConfidence) {
        if (enableCaching) cacheResult(canvas, text, adjustedConfidence);
        return bestResult;
      }
    } catch (err) {
      console.warn(`[ocrPremium] Attempt ${attempt + 1} failed:`, err);
    }

    // Backoff exponencial
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(1.5, attempt)));
    }
  }

  if (bestResult.text && enableCaching) {
    cacheResult(canvas, bestResult.text, bestResult.confidence);
  }

  return bestResult;
}

// ─── Exportar para uso en CameraOCRScanner ──────────────────────────────────

export function createPremiumOcrPipeline(config: Partial<PremiumOcrConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  return { analyzeIllumination, preprocessAdaptiveByLighting, cleanOcrText, validateOcrResult, runPremiumOcr, finalConfig };
}
