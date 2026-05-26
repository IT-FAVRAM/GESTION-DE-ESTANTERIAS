/** Preprocesa un frame de vídeo/canvas para mejorar OCR en etiquetas industriales. */
export function preprocessCanvasForOcr(source: HTMLCanvasElement): string {
  const sw = source.width;
  const sh = source.height;
  if (sw < 1 || sh < 1) {
    throw new Error('Imagen no válida (cámara sin dimensiones). Espera un momento y vuelve a capturar.');
  }

  // Escalar a 1600px en el lado largo — más píxeles = mejor OCR para texto pequeño
  const targetLong = 1600;
  const scale = Math.min(2.0, targetLong / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la imagen');

  // Paso 1: grayscale + contraste via CSS filter (GPU, mucho más rápido que pixel loop)
  ctx.filter = 'grayscale(1) contrast(1.8) brightness(1.1)';
  ctx.drawImage(source, 0, 0, w, h);
  ctx.filter = 'none';

  // Paso 2: binarización con umbral Otsu (óptimo para texto sobre fondo)
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const total = w * h;

  // Histograma de grises
  const hist = new Int32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    hist[d[i]]++; // Canal R = G = B tras grayscale
  }

  // Método de Otsu: maximiza la varianza entre clases
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
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVar) { maxVar = variance; threshold = i; }
  }

  // Binarización estricta: blanco o negro (Tesseract prefiere binario puro)
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] > threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    // d[i+3] = alpha, dejar intacto
  }

  ctx.putImageData(imageData, 0, 0);

  // PNG lossless: sin artefactos JPEG que confunden caracteres (ej. '8' vs 'B')
  return work.toDataURL('image/png');
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
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        cleanup();
        resolve();
      }
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
