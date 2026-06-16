# Piece Counter V2 — Video Real-Time + Foto Referencia

**Goal:** Transform the single-shot piece counter into a premium two-step workflow: (1) mandatory reference photo of a single piece for calibration, then (2) real-time video counting with TF.js bounding boxes overlay + Claude Opus 4.8 on-demand deep analysis.

**Architecture:** Three-layer system: (1) TF.js COCO-SSD runs in-browser at 30+ FPS providing instant bounding boxes on a canvas overlay, (2) Claude Opus 4.8 analyzes on-demand when the user pauses or taps "analyse", returning annotated results with confidence, (3) reference photo calibrates scale via pixel-to-mm ratio. The component state machine expands: `reference -> live -> paused -> analysing -> review`.

**Tech Stack:** TensorFlow.js + COCO-SSD (object detection), Claude Opus 4.8 vision (deep analysis, streaming), Canvas 2D API (overlay), existing `ocrPreprocess.ts` sharpness measurement, Firebase Cloud Functions (backend proxy).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `APP/frontend/lib/detector/cocoSsdLoader.ts` | Lazy-load COCO-SSD model, singleton cache |
| Create | `APP/frontend/lib/detector/types.ts` | Shared types: `Detection`, `ReferenceProfile`, `AnnotatedResult` |
| Create | `APP/frontend/lib/detector/detectionLoop.ts` | RAF-based detection loop over video, emits detections |
| Create | `APP/frontend/lib/detector/overlayRenderer.ts` | Draw bounding boxes + labels on canvas overlay |
| Create | `APP/frontend/lib/detector/referenceAnalyzer.ts` | Analyze reference photo via Claude, extract dimensions |
| Create | `APP/frontend/lib/detector/claudeAnnotator.ts` | Send frame to Claude with prompt for bounding boxes + count |
| Modify | `APP/frontend/lib/api/pieceCounterApi.ts` | Add `analyseReference()` + `analysePieceFrame()` |
| Modify | `APP/backend/src/pieceCounter.ts` | Add Cloud Functions `analyseReference` + `analysePieceFrame` |
| Modify | `APP/backend/src/index.ts` | Export new functions |
| Modify | `APP/frontend/components/common/PieceCounterCamera.tsx` | **Full rewrite** — 3-phase flow (reference -> live -> review) |
| Modify | `APP/frontend/package.json` | Add `@tensorflow/tfjs` + `@tensorflow-models/coco-ssd` |

---

## Task 1: Add TF.js dependencies

**Files:**
- Modify: `APP/frontend/package.json`

### Step 1: Install TensorFlow.js + COCO-SSD

```bash
cd APP/frontend && npm install @tensorflow/tfjs@4.22.0 @tensorflow-models/coco-ssd@2.2.4
```

### Step 2: Verify install

```bash
cd APP/frontend && npm ls @tensorflow/tfjs @tensorflow-models/coco-ssd
```

Expected: both packages listed with no peer dependency errors.

### Step 3: Commit

```bash
git add APP/frontend/package.json APP/frontend/package-lock.json
git commit -m "chore: add @tensorflow/tfjs + coco-ssd for real-time object detection"
```

---

## Task 2: Create shared types

**Files:**
- Create: `APP/frontend/lib/detector/types.ts`

### Step 1: Create the types file

```typescript
/**
 * types.ts — Shared types for the piece detection pipeline.
 */

/** A single bounding-box detection from TF.js COCO-SSD or Claude. */
export interface Detection {
  /** [x, y, width, height] in video-element pixel space. */
  bbox: [number, number, number, number];
  /** Class label (e.g. "piece", "object"). */
  label: string;
  /** Confidence 0-1. */
  score: number;
}

/** Reference piece profile saved after the mandatory first photo. */
export interface ReferenceProfile {
  /** Data URL of the captured reference image (for display). */
  imageDataUrl: string;
  /** Bounding box of the reference piece in the reference photo. */
  refBbox: [number, number, number, number];
  /** Estimated width in mm (from Claude analysis). */
  widthMm: number | null;
  /** Estimated height in mm (from Claude analysis). */
  heightMm: number | null;
  /** Short textual description from Claude. */
  description: string;
  /** Pixel-to-mm ratio derived from the reference. */
  pxPerMm: number | null;
}

/** Result from Claude's deep analysis of a frame. */
export interface AnnotatedResult {
  count: number;
  confidencePct: number;
  range: { min: number; max: number } | null;
  detections: Detection[];
  reasoning: string;
  warnings: string[];
}

/** Phase of the PieceCounterCamera v2 state machine. */
export type CounterPhase =
  | 'starting'      // Camera initializing
  | 'reference'     // Taking the reference photo
  | 'ref-analysis'  // Claude analysing the reference
  | 'live'          // Real-time TF.js detection running
  | 'paused'        // Video paused, user reviewing
  | 'analysing'     // Claude analysing the paused frame
  | 'review'        // Final results shown
  | 'error';        // Error state
```

### Step 2: Commit

```bash
git add APP/frontend/lib/detector/types.ts
git commit -m "feat: add shared types for piece detection pipeline"
```

---

## Task 3: COCO-SSD lazy loader

**Files:**
- Create: `APP/frontend/lib/detector/cocoSsdLoader.ts`

### Step 1: Create the loader

```typescript
/**
 * cocoSsdLoader.ts — Lazy-loads COCO-SSD model as a singleton.
 * The model is ~5 MB and takes 2-5s to load on first use.
 * Subsequent calls return the cached instance instantly.
 */

import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';

let _model: cocoSsd.ObjectDetection | null = null;
let _loading: Promise<cocoSsd.ObjectDetection> | null = null;

/**
 * Returns the cached COCO-SSD model, loading it on first call.
 * Uses lite_mobilenet_v2 backend for speed (GPU via WebGL).
 */
export async function getCocoSsdModel(): Promise<cocoSsd.ObjectDetection> {
  if (_model) return _model;
  if (_loading) return _loading;

  _loading = (async () => {
    // Warm up TensorFlow.js WebGL backend
    await tf.ready();
    const model = await cocoSsd.load({
      base: 'lite_mobilenet_v2',
    });
    _model = model;
    return model;
  })();

  return _loading;
}

/** Returns true if the model is already loaded (no async). */
export function isModelLoaded(): boolean {
  return _model !== null;
}

/** Dispose the model to free GPU memory. */
export function disposeModel(): void {
  if (_model) {
    _model.dispose();
    _model = null;
  }
  _loading = null;
}
```

### Step 2: Commit

```bash
git add APP/frontend/lib/detector/cocoSsdLoader.ts
git commit -m "feat: lazy COCO-SSD model loader singleton"
```

---

## Task 4: Reference photo analyzer (Claude)

**Files:**
- Create: `APP/frontend/lib/detector/referenceAnalyzer.ts`
- Modify: `APP/backend/src/pieceCounter.ts`

### Step 1: Add the backend Cloud Function `analyseReference`

Append to `APP/backend/src/pieceCounter.ts` (before the closing of the file, after the `countPieces` export):

```typescript
/**
 * analyseReference — Analyses a photo of a SINGLE reference piece.
 * Returns dimensions (mm), description, and bounding box for calibration.
 */
export const analyseReference = functions
  .runWith({ memory: '1GB', timeoutSeconds: 60, secrets: ['ANTHROPIC_API_KEY'] })
  .https.onCall(async (data: any, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado.');
    }

    let imageBase64 = String(data?.imageBase64 || '').trim();
    if (!imageBase64) {
      throw new functions.https.HttpsError('invalid-argument', 'Falta la imagen.');
    }
    const commaIdx = imageBase64.indexOf(',');
    if (imageBase64.startsWith('data:') && commaIdx !== -1) {
      imageBase64 = imageBase64.slice(commaIdx + 1);
    }
    if (imageBase64.length > MAX_IMAGE_BYTES) {
      throw new functions.https.HttpsError('invalid-argument', 'La imagen es demasiado grande.');
    }

    let client: Anthropic;
    try {
      client = getClient();
    } catch {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'La API key de Anthropic no está configurada.',
      );
    }

    const REFERENCE_PROMPT = `Eres un asistente experto en piezas industriales de chapa metálica. Analiza la FOTO de UNA sola pieza individual sobre una superficie.

Devuelve ÚNICAMENTE un JSON válido con esta forma:
{
  "bbox": { "x": 0.12, "y": 0.08, "w": 0.45, "h": 0.72 },
  "widthMm": 150,
  "heightMm": 220,
  "description": "Pieza rectangular con 4 taladros en las esquinas",
  "confidence": 85
}

Reglas:
- "bbox" son coordenadas NORMALIZADAS (0-1) del rectángulo que rodea la pieza: x,y esquina superior-izquierda, w ancho, h alto.
- "widthMm" y "heightMm" son estimaciones en milímetros REALES de las dimensiones de la pieza. Si no puedes estimar, pon null.
- "description" es una descripción corta de la pieza en español.
- "confidence" es tu confianza en la estimación de dimensiones (0-100).
- Si hay múltiples piezas en la foto, enfócate en la pieza PRINCIPAL (la más grande/centrada).`;

    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        system: REFERENCE_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
              },
              { type: 'text', text: 'Analiza esta pieza y devuelve el JSON con las dimensiones y bounding box normalizado.' },
            ],
          },
        ],
      });

      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      const parsed = extractJson(text);
      if (!parsed) {
        throw new functions.https.HttpsError('internal', 'No se pudo interpretar el resultado.');
      }

      return {
        ok: true,
        bbox: parsed.bbox || { x: 0, y: 0, w: 1, h: 1 },
        widthMm: parsed.widthMm ?? null,
        heightMm: parsed.heightMm ?? null,
        description: String(parsed.description || ''),
        confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      };
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error('[analyseReference] Error:', err?.message || err);
      throw new functions.https.HttpsError('internal', 'Error al analizar la referencia.');
    }
  });
```

### Step 2: Export the new function from index.ts

In `APP/backend/src/index.ts`, add `analyseReference` to the existing `pieceCounter` import:

```typescript
export {
  countPieces,
  analyseReference,
} from './pieceCounter';
```

### Step 3: Add the frontend API wrapper

Append to `APP/frontend/lib/api/pieceCounterApi.ts`:

```typescript
export interface ReferenceAnalysisResult {
  ok: boolean;
  bbox: { x: number; y: number; w: number; h: number };
  widthMm: number | null;
  heightMm: number | null;
  description: string;
  confidence: number;
}

export const analyseReference = async (imageBase64: string): Promise<ReferenceAnalysisResult> => {
  const callable = httpsCallable(functions, 'analyseReference');
  const result = await callable({ imageBase64 });
  const data = (result?.data || {}) as Partial<ReferenceAnalysisResult>;
  return {
    ok: !!data.ok,
    bbox: data.bbox || { x: 0, y: 0, w: 1, h: 1 },
    widthMm: data.widthMm ?? null,
    heightMm: data.heightMm ?? null,
    description: String(data.description || ''),
    confidence: typeof data.confidence === 'number' ? data.confidence : 0,
  };
};
```

### Step 4: Verify TypeScript compiles

```bash
cd APP/frontend && ./node_modules/.bin/tsc --noEmit
cd APP/backend && ./node_modules/.bin/tsc --noEmit
```

Expected: no errors.

### Step 5: Commit

```bash
git add APP/backend/src/pieceCounter.ts APP/backend/src/index.ts APP/frontend/lib/api/pieceCounterApi.ts
git commit -m "feat: add analyseReference Cloud Function for reference piece calibration"
```

---

## Task 5: Detection loop + overlay renderer

**Files:**
- Create: `APP/frontend/lib/detector/detectionLoop.ts`
- Create: `APP/frontend/lib/detector/overlayRenderer.ts`

### Step 1: Create the detection loop

```typescript
/**
 * detectionLoop.ts — RAF-based loop that runs COCO-SSD on a video element
 * and emits detections at ~10-15 FPS (throttled, not every frame).
 */

import { getCocoSsdModel } from './cocoSsdLoader';
import type { Detection } from './types';

export type DetectionCallback = (detections: Detection[]) => void;

const DETECTION_INTERVAL_MS = 80; // ~12 FPS detection rate

/**
 * Starts a detection loop over `videoElement`.
 * Returns a stop function. The loop automatically stops if `active` becomes false.
 */
export function startDetectionLoop(
  videoElement: HTMLVideoElement,
  onDetections: DetectionCallback,
  active: boolean = true,
): () => void {
  let rafId: number | null = null;
  let lastDetectionTime = 0;
  let stopped = false;

  const loop = async (timestamp: number) => {
    if (stopped || !active) return;

    if (timestamp - lastDetectionTime >= DETECTION_INTERVAL_MS) {
      lastDetectionTime = timestamp;
      try {
        const model = await getCocoSsdModel();
        if (stopped || !active) return;

        const predictions = await model.detect(videoElement);
        if (stopped || !active) return;

        // Filter: keep only items with score > 0.3 and map to our Detection type
        const detections: Detection[] = predictions
          .filter((p) => p.score > 0.3)
          .map((p) => ({
            bbox: p.bbox as [number, number, number, number],
            label: p.class,
            score: p.score,
          }));

        onDetections(detections);
      } catch {
        // Silently skip failed detection frames (GPU busy, etc.)
      }
    }

    if (!stopped && active) {
      rafId = requestAnimationFrame(loop);
    }
  };

  rafId = requestAnimationFrame(loop);

  return () => {
    stopped = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}
```

### Step 2: Create the overlay renderer

```typescript
/**
 * overlayRenderer.ts — Draws detection bounding boxes on a canvas overlay
 * positioned on top of a video element.
 */

import type { Detection } from './types';

interface RenderOptions {
  /** Color for bounding box stroke. Default: '#00e5ff' (cyan). */
  strokeColor?: string;
  /** Font for labels. Default: 'bold 14px monospace'. */
  labelFont?: string;
  /** Whether to show score percentages. Default: true. */
  showScore?: boolean;
  /** Whether to show piece count in top-left. Default: true. */
  showCount?: boolean;
}

const DEFAULTS: Required<RenderOptions> = {
  strokeColor: '#00e5ff',
  labelFont: 'bold 14px monospace',
  showScore: true,
  showCount: true,
};

/**
 * Renders detections on a canvas that overlays a video element.
 * Call this inside a RAF loop or whenever detections update.
 */
export function renderDetections(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: Detection[],
  options?: RenderOptions,
): void {
  const opts = { ...DEFAULTS, ...options };
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Match canvas size to video display size
  const vw = video.clientWidth;
  const vh = video.clientHeight;
  if (canvas.width !== vw || canvas.height !== vh) {
    canvas.width = vw;
    canvas.height = vh;
  }

  // Scale factors: video pixel space -> CSS display space
  const scaleX = vw / (video.videoWidth || vw);
  const scaleY = vh / (video.videoHeight || vh);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw each detection
  detections.forEach((det) => {
    const [bx, by, bw, bh] = det.bbox;
    const x = bx * scaleX;
    const y = by * scaleY;
    const w = bw * scaleX;
    const h = bh * scaleY;

    // Bounding box
    ctx.strokeStyle = opts.strokeColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Semi-transparent fill
    if (opts.strokeColor.startsWith('#')) {
      const r = parseInt(opts.strokeColor.slice(1, 3), 16);
      const g = parseInt(opts.strokeColor.slice(3, 5), 16);
      const b = parseInt(opts.strokeColor.slice(5, 7), 16);
      ctx.fillStyle = `rgba(${r},${g},${b},0.1)`;
    }
    ctx.fillRect(x, y, w, h);

    // Label background
    const label = opts.showScore
      ? `${Math.round(det.score * 100)}%`
      : det.label;
    ctx.font = opts.labelFont;
    const textW = ctx.measureText(label).width;
    ctx.fillStyle = opts.strokeColor;
    ctx.fillRect(x, y - 22, textW + 8, 20);

    // Label text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 4, y - 6);
  });

  // Count badge (top-left)
  if (opts.showCount && detections.length > 0) {
    const text = `${detections.length} detectadas`;
    ctx.font = 'bold 24px system-ui';
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(12, 12, tw + 20, 40);
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(text, 22, 40);
  }
}

/** Clears the canvas overlay completely. */
export function clearOverlay(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}
```

### Step 3: Commit

```bash
git add APP/frontend/lib/detector/detectionLoop.ts APP/frontend/lib/detector/overlayRenderer.ts
git commit -m "feat: detection loop (TF.js COCO-SSD) + canvas overlay renderer"
```

---

## Task 6: Claude frame annotator

**Files:**
- Create: `APP/frontend/lib/detector/claudeAnnotator.ts`
- Modify: `APP/backend/src/pieceCounter.ts`

### Step 1: Add backend `analysePieceFrame` function

Append to `APP/backend/src/pieceCounter.ts`:

```typescript
/**
 * analysePieceFrame — Analyses a single frame for loose piece counting.
 * Returns bounding boxes + count + confidence. Designed for on-demand
 * use when the user pauses the video or taps "analyse".
 */
export const analysePieceFrame = functions
  .runWith({ memory: '1GB', timeoutSeconds: 90, secrets: ['ANTHROPIC_API_KEY'] })
  .https.onCall(async (data: any, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado.');
    }

    let imageBase64 = String(data?.imageBase64 || '').trim();
    if (!imageBase64) {
      throw new functions.https.HttpsError('invalid-argument', 'Falta la imagen.');
    }
    const commaIdx = imageBase64.indexOf(',');
    if (imageBase64.startsWith('data:') && commaIdx !== -1) {
      imageBase64 = imageBase64.slice(commaIdx + 1);
    }
    if (imageBase64.length > MAX_IMAGE_BYTES) {
      throw new functions.https.HttpsError('invalid-argument', 'La imagen es demasiado grande.');
    }

    const refDescription = String(data?.refDescription || '');
    const refWidthMm = data?.refWidthMm != null ? Number(data.refWidthMm) : null;

    let client: Anthropic;
    try {
      client = getClient();
    } catch {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'La API key de Anthropic no está configurada.',
      );
    }

    const FRAME_PROMPT = `Eres un asistente experto en CONTAR piezas de chapa metálica SUELTAS (no apiladas) en un taller industrial.

Analiza la imagen y cuenta TODAS las piezas visibles. Cada pieza es un objeto individual de chapa metálica, puede estar girada, solapada parcialmente, o cortada por el borde de la imagen.

${refDescription ? `REFERENCIA: La pieza tipo se describe como: "${refDescription}". Las piezas en esta imagen son del mismo tipo.` : ''}

Devuelve ÚNICAMENTE un JSON válido con esta forma:
{
  "count": 12,
  "confidencePct": 85,
  "range": { "min": 10, "max": 14 },
  "detections": [
    { "bbox": [x1, y1, x2, y2], "label": "piece", "score": 0.92 },
    { "bbox": [x1, y1, x2, y2], "label": "piece", "score": 0.88 }
  ],
  "reasoning": "Se distinguen 12 piezas claras. 2 en el borde inferior están parcialmente solapadas.",
  "warnings": ["2 piezas cortadas por el borde inferior"]
}

Reglas:
- "detections": lista de bounding boxes en COORDENADAS DE PÍXELES (no normalizadas) de la imagen original. Cada bbox es [x1, y1, x2, y2] (esquina superior-izquierda, esquina inferior-derecha).
- "label": siempre "piece".
- "score": tu confianza de que ese objeto es efectivamente una pieza (0-1).
- Si piezas están muy solapadas o no puedes distinguirlas, pon el rango y avisa en warnings.
- "confidencePct" debe reflejar tu certeza REAL.
- NO ignores piezas cortadas por el borde — incluirlas con score bajo.`;

    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 8192,
        thinking: { type: 'adaptive' },
        system: FRAME_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
              },
              { type: 'text', text: 'Cuenta las piezas de chapa sueltas y devuelve el JSON con bounding boxes.' },
            ],
          },
        ],
      });

      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      const parsed = extractJson(text);
      if (!parsed) {
        throw new functions.https.HttpsError('internal', 'No se pudo interpretar el resultado.');
      }

      const count = parsed?.count == null ? null : toInt(parsed.count);
      let confidencePct = toInt(parsed?.confidencePct, 0);
      confidencePct = Math.max(0, Math.min(100, confidencePct));

      let range: { min: number; max: number } | null = null;
      if (parsed?.range && parsed.range.min != null && parsed.range.max != null) {
        const min = toInt(parsed.range.min);
        const max = toInt(parsed.range.max);
        range = { min: Math.min(min, max), max: Math.max(min, max) };
      }

      // Normalise detections
      const detections: Array<{ bbox: number[]; label: string; score: number }> =
        Array.isArray(parsed?.detections)
          ? parsed.detections.map((d: any) => ({
              bbox: Array.isArray(d.bbox) ? d.bbox.map(Number) : [0, 0, 0, 0],
              label: String(d.label || 'piece'),
              score: Math.max(0, Math.min(1, Number(d.score) || 0)),
            }))
          : [];

      const warnings = Array.isArray(parsed?.warnings)
        ? parsed.warnings.map((w: any) => String(w)).filter(Boolean)
        : [];

      return {
        ok: true,
        count,
        confidencePct,
        range,
        detections,
        reasoning: String(parsed?.reasoning || ''),
        warnings,
      };
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error('[analysePieceFrame] Error:', err?.message || err);
      throw new functions.https.HttpsError('internal', 'Error al analizar el frame.');
    }
  });
```

### Step 2: Export from index.ts

Update the `pieceCounter` export in `APP/backend/src/index.ts`:

```typescript
export {
  countPieces,
  analyseReference,
  analysePieceFrame,
} from './pieceCounter';
```

### Step 3: Add frontend API wrapper

Append to `APP/frontend/lib/api/pieceCounterApi.ts`:

```typescript
export const analysePieceFrame = async (params: {
  imageBase64: string;
  refDescription?: string;
  refWidthMm?: number | null;
}): Promise<AnnotatedResult> => {
  const callable = httpsCallable(functions, 'analysePieceFrame');
  const result = await callable(params);
  const data = (result?.data || {}) as any;
  return {
    count: typeof data.count === 'number' ? data.count : null,
    confidencePct: typeof data.confidencePct === 'number' ? data.confidencePct : 0,
    range: data.range && typeof data.range.min === 'number'
      ? { min: data.range.min, max: data.range.max }
      : null,
    detections: Array.isArray(data.detections) ? data.detections : [],
    reasoning: String(data.reasoning || ''),
    warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
  };
};
```

(Note: you'll need to import `AnnotatedResult` from `../../lib/detector/types` at the top of the file.)

### Step 4: Verify TypeScript compiles

```bash
cd APP/frontend && ./node_modules/.bin/tsc --noEmit
cd APP/backend && ./node_modules/.bin/tsc --noEmit
```

### Step 5: Commit

```bash
git add APP/backend/src/pieceCounter.ts APP/backend/src/index.ts APP/frontend/lib/api/pieceCounterApi.ts
git commit -m "feat: add analysePieceFrame Cloud Function for bounding-box piece counting"
```

---

## Task 7: Rewrite PieceCounterCamera (the main component)

**Files:**
- Modify: `APP/frontend/components/common/PieceCounterCamera.tsx`

This is the largest task. The component is rewritten to support the 3-phase premium flow.

### Step 1: Rewrite the component

Replace the entire content of `APP/frontend/components/common/PieceCounterCamera.tsx` with the v2 implementation. Key changes from v1:

- State machine expands from 4 phases to 8: `starting -> reference -> ref-analysis -> live -> paused -> analysing -> review -> error`
- **Reference phase**: shows a guide frame, captures a single piece photo, sends to Claude for dimension analysis
- **Live phase**: TF.js COCO-SSD runs at ~12 FPS, draws bounding boxes on a canvas overlay
- **Analysing phase**: pauses video, sends frame to Claude for detailed bounding-box counting
- **Review phase**: shows count (editable), confidence, range, detections list
- Stacked mode still supported (skips reference, uses original `countPieces` API)

The component uses:
- `getCocoSsdModel()` from `cocoSsdLoader.ts` for lazy model loading
- `startDetectionLoop()` from `detectionLoop.ts` for real-time TF.js detection
- `renderDetections()` / `clearOverlay()` from `overlayRenderer.ts` for canvas overlay
- `analyseReferenceApi()` and `analysePieceFrame()` from `pieceCounterApi.ts` for Claude calls
- `measureSharpnessLive()` from existing `ocrPreprocess.ts` for sharpness indicator
- `waitForVideoReady()` from existing `ocrPreprocess.ts` for camera init

### Step 2: Verify TypeScript compiles

```bash
cd APP/frontend && ./node_modules/.bin/tsc --noEmit
```

Expected: no errors.

### Step 3: Commit

```bash
git add APP/frontend/components/common/PieceCounterCamera.tsx
git commit -m "feat: PieceCounterCamera v2 — reference photo + TF.js live + Claude analysis"
```

---

## Task 8: Integration test & polish

### Step 1: Manual test flow

Verify on a mobile device:
1. Open PunzonadoView -> tap "Contar piezas"
2. Camera opens -> mode defaults to "Sueltas"
3. Place ONE piece in the guide frame -> tap "Capturar referencia"
4. Claude analyses -> shows description + dimensions
5. Video resumes with TF.js bounding boxes appearing in real-time
6. Move pieces around -> boxes follow
7. Tap "Pausar + Analizar" -> Claude gives detailed count with boxes
8. Tap "Foto directa" -> instant Claude analysis
9. Review shows count, confidence, range, detections list
10. Edit count manually -> tap "Hecho"

### Step 2: Edge cases to verify

- Camera permission denied -> shows friendly error
- No TF.js model load -> still works (TF.js boxes just missing, Claude still works)
- Very dark/blurry video -> sharpness indicator shows red
- Multiple pieces overlapping -> Claude gives range
- Reference photo with multiple pieces -> Claude picks main piece
- Stacked mode -> skips reference analysis, uses original flow

### Step 3: Final commit

```bash
git add -A
git commit -m "feat: piece counter v2 complete — video real-time + reference + Claude bounding boxes"
```

---

## Architecture Diagram

```
PieceCounterCamera v2
  |
  |-- FASE: reference
  |   +-- getUserMedia() -> guide frame -> capture -> analyseReferenceApi()
  |       -> Claude Opus 4.8 -> ReferenceProfile { bbox, pxPerMm, description }
  |
  |-- FASE: live
  |   |-- TF.js COCO-SSD -> startDetectionLoop() @ ~12 FPS
  |   +-- overlayRenderer() -> canvas bounding boxes in real-time
  |
  |-- FASE: analysing (on pause)
  |   +-- captureFrame() -> analysePieceFrame() -> Claude Opus 4.8
  |       -> AnnotatedResult { count, detections[], confidence, range }
  |
  +-- FASE: review
      +-- Editable count + result details + confirm
```

## Dependencies

```json
"@tensorflow/tfjs": "^4.22.0",
"@tensorflow-models/coco-ssd": "^2.2.4"
```

~5 MB model, lazy-loaded in background, does not block startup.

## Backend Functions (2 new)

| Function | Purpose | Model | Timeout |
|----------|---------|-------|---------|
| `analyseReference` | Single piece photo -> dimensions + bbox | Claude Opus 4.8 | 60s |
| `analysePieceFrame` | Frame with loose pieces -> count + bboxes + confidence | Claude Opus 4.8 | 90s |
