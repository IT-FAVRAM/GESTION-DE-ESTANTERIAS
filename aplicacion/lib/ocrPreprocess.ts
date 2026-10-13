/**
 * ocrPreprocess — Pipeline de preprocesado multi-estrategia para OCR industrial
 *
 * Estrategias disponibles:
 *  A) Otsu binarization (global) — etiquetas bien iluminadas
 *  B) Adaptive block threshold — iluminación desigual, almacenes con sombras
 *  C) Inverted Otsu — etiquetas con fondo oscuro y texto claro
 *  D) High-contrast no-binarize — texto de bajo contraste, no binarizar
 *
 * measureSharpnessLive() — Laplacian variance sobre frame de vídeo reducido
 * para mostrar indicador en tiempo real sin bloquear el hilo principal.
 */

export interface OcrVariant {
  label: string;
  dataUrl: string;
}

// ─── Upscaling ────────────────────────────────────────────────────────────────

function upscaleCanvas(source: HTMLCanvasElement, targetLongSide = 2400): HTMLCanvasElement {
  const sw = source.width;
  const sh = source.height;
  const scale = Math.min(3.0, targetLongSide / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  // Nearest-neighbor preserva bordes nítidos del texto — mejor para Tesseract OCR
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, w, h);
  return out;
}

// Recorta la mitad superior o inferior del canvas con 15% de solapamiento.
// Usado para OCR de región: artículo (top) y OF (bottom) por separado.
export function cropHalfCanvas(source: HTMLCanvasElement, region: 'top' | 'bottom'): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const halfH = Math.round(h * 0.6); // 60% desde cada extremo con solapamiento
  const sy = region === 'top' ? 0 : h - halfH;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = halfH;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, sy, w, halfH, 0, 0, w, halfH);
  return out;
}

// ─── Otsu global threshold ────────────────────────────────────────────────────

function computeOtsuThreshold(gray: Uint8ClampedArray | Uint8Array, total: number): number {
  const hist = new Int32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > maxVar) { maxVar = v; threshold = i; }
  }
  return threshold;
}

// ─── Extract grayscale from RGBA imageData ────────────────────────────────────

function toGrayArray(d: Uint8ClampedArray): Uint8Array {
  const gray = new Uint8Array(d.length / 4);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
  }
  return gray;
}

// ─── Strategy A: Otsu binarization (GPU contrast boost + global threshold) ───

function preprocessOtsu(source: HTMLCanvasElement, invert = false): string {
  const up = upscaleCanvas(source);
  const w = up.width;
  const h = up.height;
  const ctx = up.getContext('2d')!;

  // GPU: grayscale + contraste + brillo
  ctx.filter = 'grayscale(1) contrast(2.0) brightness(1.05)';
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tmpCtx = tmp.getContext('2d')!;
  tmpCtx.filter = 'grayscale(1) contrast(2.0) brightness(1.05)';
  tmpCtx.drawImage(up, 0, 0);
  tmpCtx.filter = 'none';

  const imageData = tmpCtx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const gray = toGrayArray(d);
  const threshold = computeOtsuThreshold(gray, w * h);

  for (let i = 0; i < gray.length; i++) {
    const isLight = gray[i] > threshold;
    const v = (invert ? !isLight : isLight) ? 255 : 0;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
  }
  tmpCtx.putImageData(imageData, 0, 0);
  return tmp.toDataURL('image/png');
}

// ─── Strategy B: Adaptive block thresholding ──────────────────────────────────
// Divide la imagen en bloques y aplica Otsu local a cada uno.
// Mucho más robusto ante iluminación desigual (sombras, fluorescentes laterales).

function preprocessAdaptive(source: HTMLCanvasElement): string {
  const up = upscaleCanvas(source, 1600);
  const w = up.width;
  const h = up.height;
  const ctx = up.getContext('2d')!;

  // Pre-normalizar contraste globalmente antes del Otsu local
  ctx.filter = 'grayscale(1) contrast(1.6)';
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tmpCtx = tmp.getContext('2d')!;
  tmpCtx.filter = 'grayscale(1) contrast(1.6)';
  tmpCtx.drawImage(up, 0, 0);
  tmpCtx.filter = 'none';

  const imageData = tmpCtx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const gray = toGrayArray(d);

  // Bloques de 64×64 px con solape
  const blockSize = 64;
  const overlap = 16;
  const step = blockSize - overlap;

  const threshMap = new Float32Array(w * h);

  for (let by = 0; by < h; by += step) {
    for (let bx = 0; bx < w; bx += step) {
      const x0 = bx, y0 = by;
      const x1 = Math.min(bx + blockSize, w);
      const y1 = Math.min(by + blockSize, h);
      const bw = x1 - x0;
      const bh = y1 - y0;
      const blockGray = new Uint8Array(bw * bh);
      let gi = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          blockGray[gi++] = gray[y * w + x];
        }
      }
      const t = computeOtsuThreshold(blockGray, bw * bh);
      // Escribir threshold en el mapa (media ponderada con overlap)
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = y * w + x;
          if (threshMap[idx] === 0) threshMap[idx] = t;
          else threshMap[idx] = (threshMap[idx] + t) / 2;
        }
      }
    }
  }

  for (let i = 0; i < gray.length; i++) {
    const v = gray[i] > (threshMap[i] || 128) ? 255 : 0;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
  }
  tmpCtx.putImageData(imageData, 0, 0);
  return tmp.toDataURL('image/png');
}

// ─── Strategy D: High-contrast no-binarize ───────────────────────────────────
// Para etiquetas de bajo contraste donde la binarización destruye detalles.

function preprocessHighContrast(source: HTMLCanvasElement): string {
  const up = upscaleCanvas(source, 2000);
  const w = up.width;
  const h = up.height;
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const ctx = tmp.getContext('2d')!;
  ctx.filter = 'grayscale(1) contrast(2.5) brightness(1.15)';
  ctx.drawImage(up, 0, 0);
  ctx.filter = 'none';
  return tmp.toDataURL('image/png');
}

// ─── Strategy E: Single-line optimized ───────────────────────────────────────
// Máximo contraste para una sola línea (ej. zona OF en la mitad inferior).
// Aplica binarización Otsu + contraste muy alto para texto impreso claro.

export function preprocessSingleLine(source: HTMLCanvasElement): string {
  const up = upscaleCanvas(source, 2400);
  const w = up.width;
  const h = up.height;
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tmpCtx = tmp.getContext('2d')!;
  tmpCtx.filter = 'grayscale(1) contrast(3.0) brightness(1.1)';
  tmpCtx.drawImage(up, 0, 0);
  tmpCtx.filter = 'none';

  const imageData = tmpCtx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const gray = toGrayArray(d);
  const threshold = computeOtsuThreshold(gray, w * h);

  for (let i = 0; i < gray.length; i++) {
    const v = gray[i] > threshold ? 255 : 0;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
  }
  tmpCtx.putImageData(imageData, 0, 0);
  return tmp.toDataURL('image/png');
}

// ─── Main export: generate all variants ──────────────────────────────────────

/**
 * Genera 5 variantes de preprocesado del mismo frame.
 * El caller ejecuta OCR en el orden dado y para al superar el umbral de confianza.
 * Índices: 0=adaptive, 1=otsu, 2=inverted, 3=contrast, 4=singleLine
 */
export function generateOcrVariants(source: HTMLCanvasElement): OcrVariant[] {
  if (source.width < 1 || source.height < 1) {
    throw new Error('Imagen no válida (sin dimensiones). Espera y vuelve a capturar.');
  }
  return [
    { label: 'adaptive',   dataUrl: preprocessAdaptive(source) },
    { label: 'otsu',       dataUrl: preprocessOtsu(source, false) },
    { label: 'inverted',   dataUrl: preprocessOtsu(source, true) },
    { label: 'contrast',   dataUrl: preprocessHighContrast(source) },
    { label: 'singleLine', dataUrl: preprocessSingleLine(source) },
  ];
}

// ─── Sharpness estimation (Laplacian variance on small sample) ────────────────
// Mide la nitidez del frame de vídeo actual sobre un canvas de 200×112 px.
// Retorna un valor 0–100 donde >30 = aceptable, >50 = buena.

let _sharpCanvas: HTMLCanvasElement | null = null;
let _sharpCtx: CanvasRenderingContext2D | null = null;

export function measureSharpnessLive(video: HTMLVideoElement): number {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return 0;

  // Canvas fijo reutilizable (evita garbage collection)
  if (!_sharpCanvas) {
    _sharpCanvas = document.createElement('canvas');
    _sharpCanvas.width = 200;
    _sharpCanvas.height = 112;
    _sharpCtx = _sharpCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  const sw = video.videoWidth;
  const sh = video.videoHeight;
  // Captura sólo la franja central (zona guía)
  const sx = sw * 0.2;
  const sy = sh * 0.3;
  const sw2 = sw * 0.6;
  const sh2 = sh * 0.4;

  _sharpCtx!.drawImage(video, sx, sy, sw2, sh2, 0, 0, 200, 112);
  const { data } = _sharpCtx!.getImageData(0, 0, 200, 112);

  // Laplacian variance: mide cambios bruscos de intensidad (= nitidez)
  let sum = 0, sumSq = 0, count = 0;
  const W = 200, H = 112;
  for (let y = 1; y < H - 1; y += 2) {
    for (let x = 1; x < W - 1; x += 2) {
      const i = (y * W + x) * 4;
      const c  = 0.299 * data[i]   + 0.587 * data[i+1]   + 0.114 * data[i+2];
      const u  = 0.299 * data[((y-1)*W+x)*4]   + 0.587 * data[((y-1)*W+x)*4+1]   + 0.114 * data[((y-1)*W+x)*4+2];
      const d2 = 0.299 * data[((y+1)*W+x)*4]   + 0.587 * data[((y+1)*W+x)*4+1]   + 0.114 * data[((y+1)*W+x)*4+2];
      const l  = 0.299 * data[(y*W+x-1)*4]     + 0.587 * data[(y*W+x-1)*4+1]     + 0.114 * data[(y*W+x-1)*4+2];
      const r  = 0.299 * data[(y*W+x+1)*4]     + 0.587 * data[(y*W+x+1)*4+1]     + 0.114 * data[(y*W+x+1)*4+2];
      const lap = 4 * c - u - d2 - l - r;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  // Normalizar: variance ~0 = borroso, ~2500+ = muy nítido
  return Math.min(100, Math.round(Math.sqrt(Math.max(0, variance)) * 2));
}

// ─── Compat: función original para que los imports existentes no rompan ───────

export function preprocessCanvasForOcr(source: HTMLCanvasElement): string {
  return preprocessOtsu(source, false);
}

export function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 8000): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('La cámara tarda demasiado. Comprueba permisos e iluminación.'));
    }, timeoutMs);
    const onReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) { cleanup(); resolve(); }
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('loadedmetadata', onReady);
    };
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('loadedmetadata', onReady);
    video.play().catch(() => {});
  });
}
