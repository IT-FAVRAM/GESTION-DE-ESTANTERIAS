/** Preprocesa un frame de vídeo/canvas para mejorar OCR en etiquetas industriales. */
export function preprocessCanvasForOcr(source: HTMLCanvasElement): string {
  const sw = source.width;
  const sh = source.height;
  if (sw < 1 || sh < 1) {
    throw new Error('Imagen no válida (cámara sin dimensiones). Espera un momento y vuelve a capturar.');
  }

  // Resolución más baja para tablets lentos, pero suficiente para OCR
  const targetLong = 1280;
  const scale = Math.min(1.5, targetLong / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la imagen');

  ctx.drawImage(source, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  // Preprocesamiento adaptativo: usar otsu-like threshold en lugar de fijo
  let sum = 0;
  const pixelCount = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  const mean = sum / pixelCount;

  // Aplicar contraste adaptativo y binarización suave
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

    // Contraste adaptativo basado en la media de la imagen
    const factor = gray > mean ? 1.3 : 1.6;
    const contrast = Math.min(255, Math.max(0, (gray - 128) * factor + 128));

    // Binarización suave con histéresis
    const threshold = mean > 140 ? mean : 140;
    const low = threshold - 35;
    const high = threshold + 35;
    const v = contrast > high ? 255 : contrast < low ? 0 : contrast;

    d[i] = d[i + 1] = d[i + 2] = v;
  }

  ctx.putImageData(imageData, 0, 0);
  return work.toDataURL('image/jpeg', 0.9);
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


