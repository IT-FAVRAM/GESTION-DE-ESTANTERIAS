export interface NormalizedRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface CvCountResult {
    estimatedCount: number;
    confidence: 'high' | 'medium' | 'low';
    signalQuality: number;
    peakCount: number;
    meanSpacingPx: number;
    spacingStdPx: number;
    reasoning: string;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const loadImage = (dataUrl: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
};

const movingAverage = (values: number[], windowSize: number): number[] => {
    if (windowSize <= 1) return values;
    const out = new Array(values.length).fill(0);
    let sum = 0;
    const half = Math.floor(windowSize / 2);

    for (let i = 0; i < values.length; i++) {
        sum += values[i];
        if (i >= windowSize) sum -= values[i - windowSize];

        const avg = sum / Math.min(windowSize, i + 1);
        const writeIndex = i - half;
        if (writeIndex >= 0 && writeIndex < out.length) {
            out[writeIndex] = avg;
        }
    }

    for (let i = 0; i < out.length; i++) {
        if (out[i] === 0) out[i] = values[i];
    }

    return out;
};

export const dataUrlToBase64 = (dataUrl: string): string => {
    const parts = dataUrl.split(',');
    return parts.length > 1 ? parts[1] : dataUrl;
};

export const resizeImageDataUrl = async (dataUrl: string, maxSide = 1280): Promise<string> => {
    const image = await loadImage(dataUrl);
    const longest = Math.max(image.width, image.height);
    if (longest <= maxSide) return dataUrl;

    const ratio = maxSide / longest;
    const width = Math.round(image.width * ratio);
    const height = Math.round(image.height * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.9);
};

export const cropImageDataUrl = async (dataUrl: string, rect: NormalizedRect): Promise<string> => {
    const image = await loadImage(dataUrl);
    const x = Math.round(clamp(rect.x, 0, 1) * image.width);
    const y = Math.round(clamp(rect.y, 0, 1) * image.height);
    const w = Math.max(20, Math.round(clamp(rect.w, 0.02, 1) * image.width));
    const h = Math.max(20, Math.round(clamp(rect.h, 0.02, 1) * image.height));

    const safeW = Math.min(w, image.width - x);
    const safeH = Math.min(h, image.height - y);

    const canvas = document.createElement('canvas');
    canvas.width = safeW;
    canvas.height = safeH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.drawImage(image, x, y, safeW, safeH, 0, 0, safeW, safeH);
    return canvas.toDataURL('image/jpeg', 0.92);
};

export const getImageDimensions = async (dataUrl: string): Promise<{ width: number; height: number }> => {
    const image = await loadImage(dataUrl);
    return { width: image.width, height: image.height };
};

export const preprocessMetalImage = async (dataUrl: string): Promise<string> => {
    const image = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        let contrasted = (gray - 128) * 1.42 + 128;
        contrasted = clamp(contrasted, 0, 255);

        d[i] = contrasted;
        d[i + 1] = contrasted;
        d[i + 2] = contrasted;
    }

    const temp = new Uint8ClampedArray(d);
    const width = canvas.width;
    const height = canvas.height;
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            const c = temp[idx];
            const n = temp[((y - 1) * width + x) * 4];
            const s = temp[((y + 1) * width + x) * 4];
            const w = temp[(y * width + (x - 1)) * 4];
            const e = temp[(y * width + (x + 1)) * 4];
            const blur = (c + n + s + w + e) / 5;
            const sharpened = clamp(c + (c - blur) * 0.95, 0, 255);
            d[idx] = sharpened;
            d[idx + 1] = sharpened;
            d[idx + 2] = sharpened;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
};

export const countMetalSheetsCV = async (processedDataUrl: string): Promise<CvCountResult> => {
    const image = await loadImage(processedDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return {
            estimatedCount: 0,
            confidence: 'low',
            signalQuality: 0,
            peakCount: 0,
            meanSpacingPx: 0,
            spacingStdPx: 0,
            reasoning: 'No se pudo crear el contexto de procesamiento CV.'
        };
    }

    ctx.drawImage(image, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const energy = new Array(height).fill(0);
    for (let y = 1; y < height - 1; y++) {
        let rowEnergy = 0;
        for (let x = 0; x < width; x++) {
            const up = data[((y - 1) * width + x) * 4];
            const down = data[((y + 1) * width + x) * 4];
            rowEnergy += Math.abs(down - up);
        }
        energy[y] = rowEnergy / width;
    }

    const smooth = movingAverage(energy, 7);
    const mean = smooth.reduce((a, b) => a + b, 0) / Math.max(1, smooth.length);
    const variance = smooth.reduce((a, v) => a + (v - mean) * (v - mean), 0) / Math.max(1, smooth.length);
    const std = Math.sqrt(variance);
    const threshold = mean + std * 0.85;

    const peaks: number[] = [];
    for (let i = 2; i < smooth.length - 2; i++) {
        const isPeak = smooth[i] > threshold && smooth[i] >= smooth[i - 1] && smooth[i] >= smooth[i + 1];
        if (isPeak) peaks.push(i);
    }

    const minDistance = Math.max(2, Math.round(height / 240));
    const merged: number[] = [];
    for (const p of peaks) {
        if (merged.length === 0) {
            merged.push(p);
            continue;
        }
        const last = merged[merged.length - 1];
        if (p - last >= minDistance) {
            merged.push(p);
        } else if (smooth[p] > smooth[last]) {
            merged[merged.length - 1] = p;
        }
    }

    const spacings: number[] = [];
    for (let i = 1; i < merged.length; i++) {
        spacings.push(merged[i] - merged[i - 1]);
    }

    const meanSpacing = spacings.length
        ? spacings.reduce((a, b) => a + b, 0) / spacings.length
        : 0;
    const spacingVariance = spacings.length
        ? spacings.reduce((a, v) => a + (v - meanSpacing) * (v - meanSpacing), 0) / spacings.length
        : 0;
    const spacingStd = Math.sqrt(spacingVariance);
    const regularity = meanSpacing > 0 ? clamp(1 - spacingStd / meanSpacing, 0, 1) : 0;
    const contrastScore = std > 0 ? clamp((std / Math.max(1, mean)) * 1.8, 0, 1) : 0;
    const peakDensityScore = clamp(merged.length / Math.max(6, height / 4), 0, 1);
    const signalQuality = clamp((regularity * 0.45) + (contrastScore * 0.4) + (peakDensityScore * 0.15), 0, 1);

    const confidence: 'high' | 'medium' | 'low' = signalQuality > 0.72
        ? 'high'
        : signalQuality > 0.5
            ? 'medium'
            : 'low';

    return {
        estimatedCount: merged.length,
        confidence,
        signalQuality,
        peakCount: merged.length,
        meanSpacingPx: Number(meanSpacing.toFixed(2)),
        spacingStdPx: Number(spacingStd.toFixed(2)),
        reasoning: confidence === 'high'
            ? 'Patron de bordes periodico y estable detectado por CV clasico.'
            : confidence === 'medium'
                ? 'CV detecta bordes utiles, pero con variacion moderada de separaciones.'
                : 'Senal CV debil o irregular; se recomienda priorizar IA y ajuste manual.'
    };
};


