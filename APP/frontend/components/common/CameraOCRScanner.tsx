/**
 * CameraOCRScanner — Captura de etiquetas con OCR multi-estrategia
 *
 * Mejoras v2:
 *  - Indicador de nitidez en tiempo real (Laplacian variance, 200ms polling)
 *  - Multi-variante de preprocesado: adaptive > otsu > inverted > contrast
 *  - Multi-PSM: PSM 6 (bloque) + PSM 7 (línea) según confianza
 *  - Para si la confianza supera el 72% (early exit)
 *  - Timeout aumentado a 20s para estrategias múltiples
 *  - Resultado con mayor confianza entre todas las pasadas
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import { generateOcrVariants, cropHalfCanvas, preprocessSingleLine, measureSharpnessLive, waitForVideoReady } from '../../lib/ocrPreprocess';
import { parseScanInputLenient, parseScanFromLines } from '../../lib/qrParser';
import { recognizeImage } from '../../lib/api/ocrApi';

interface CameraOCRScannerProps {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  onClose: () => void;
}

type Phase = 'starting' | 'live' | 'processing' | 'review' | 'error';

// ─── Worker singleton ─────────────────────────────────────────────────────────

interface OcrWorkerState {
  promise: Promise<import('tesseract.js').Worker> | null;
  worker: import('tesseract.js').Worker | null;
  progressFn: (p: number) => void;
}

const _ocr: OcrWorkerState = { promise: null, worker: null, progressFn: () => {} };

function ensureOcrWorker(): Promise<import('tesseract.js').Worker> {
  if (_ocr.promise) return _ocr.promise;

  _ocr.promise = createWorker('eng', 1, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        _ocr.progressFn(Math.round(m.progress * 100));
      }
    },
  } as Parameters<typeof createWorker>[2])
    .then(async (w) => {
      await w.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ/- .',
        tessedit_pageseg_mode: '6',
      } as Record<string, string>);
      _ocr.worker = w;
      return w;
    })
    .catch((err) => {
      _ocr.promise = null;
      _ocr.worker = null;
      throw err;
    });

  return _ocr.promise;
}

// ─── Umbral de confianza para early exit ─────────────────────────────────────
const CONFIDENCE_THRESHOLD = 72;

// ─── Helper: run one OCR pass with given psm ─────────────────────────────────
async function runOcrPass(
  worker: import('tesseract.js').Worker,
  dataUrl: string,
  psm: '3' | '4' | '6' | '7' | '8' | '11',
): Promise<{ text: string; confidence: number }> {
  await worker.setParameters({ tessedit_pageseg_mode: psm } as Record<string, string>);
  const result = await worker.recognize(dataUrl);
  return {
    text: result.data.text.trim(),
    confidence: result.data.confidence,
  };
}

// ─── Respaldo local (Tesseract) — solo si Cloud Vision no está disponible ─────
async function runTesseractFallback(
  crop: HTMLCanvasElement,
  onProgress: (pct: number, label: string) => void,
  shouldAbort: () => boolean,
): Promise<{ text: string; confidence: number }> {
  const variants = generateOcrVariants(crop);
  const worker = await ensureOcrWorker();

  const strategies: Array<{ variantIdx: number; psm: '3' | '4' | '6' | '7' }> = [
    { variantIdx: 0, psm: '4' },
    { variantIdx: 1, psm: '4' },
    { variantIdx: 0, psm: '3' },
    { variantIdx: 1, psm: '6' },
    { variantIdx: 2, psm: '6' },
    { variantIdx: 1, psm: '7' },
  ];

  let bestText = '';
  let bestConfidence = 0;

  for (let s = 0; s < strategies.length; s++) {
    if (shouldAbort()) break;
    const { variantIdx, psm } = strategies[s];
    onProgress(40 + Math.round((s / strategies.length) * 50), 'OCR local (respaldo)...');
    const { text, confidence } = await runOcrPass(worker, variants[variantIdx].dataUrl, psm);
    if (confidence > bestConfidence || (confidence === bestConfidence && text.length > bestText.length)) {
      bestConfidence = confidence;
      bestText = text;
    }
    if (bestConfidence >= CONFIDENCE_THRESHOLD) break;
  }

  // Pase dedicado de OF en zona inferior si no se detectó
  const hasOF = /OF\s*\d{2}\s*[-–—]?\s*\d{3,}/i.test(bestText);
  if (!hasOF && !shouldAbort()) {
    try {
      const cropBottom = cropHalfCanvas(crop, 'bottom');
      const ofVariant = preprocessSingleLine(cropBottom);
      const { text: ofText, confidence: ofConf } = await runOcrPass(worker, ofVariant, '7');
      if (ofText && /OF\s*\d/i.test(ofText)) {
        const parseResult = parseScanInputLenient(bestText + ' ' + ofText);
        if (parseResult.success) {
          bestText = `${parseResult.data.articleCode} // ${parseResult.data.orderFab}`;
          bestConfidence = Math.max(bestConfidence, ofConf);
        }
      }
    } catch { /* opcional */ }
  }

  return { text: bestText, confidence: bestConfidence };
}

// ─────────────────────────────────────────────────────────────────────────────

const CameraOCRScanner: React.FC<CameraOCRScannerProps> = ({ onResult, onError, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const closedRef = useRef(false);
  const ocrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sharpnessRafRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>('starting');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [sharpness, setSharpness] = useState(0);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (sharpnessRafRef.current) {
      cancelAnimationFrame(sharpnessRafRef.current);
      sharpnessRafRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    closedRef.current = true;
    stopStream();
    onClose();
  }, [stopStream, onClose]);

  const startCamera = useCallback(async () => {
    setPhase('starting');
    setErrorMsg(null);
    setSharpness(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          focusMode: 'continuous',
        } as MediaTrackConstraints,
        audio: false,
      });
      if (closedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await waitForVideoReady(videoRef.current);
      }
      if (!closedRef.current) {
        setPhase('live');
        startSharpnessLoop();
      }
    } catch (err) {
      if (closedRef.current) return;
      const msg = err instanceof Error ? err.message : 'Error cámara';
      const friendly = msg.toLowerCase().includes('notallowed') || msg.toLowerCase().includes('permission')
        ? 'Cámara no permitida. Activa el acceso en los ajustes del navegador.'
        : msg.toLowerCase().includes('notfound')
        ? 'No se encontró cámara trasera.'
        : 'Error al iniciar cámara. Comprueba los permisos.';
      setErrorMsg(friendly);
      setPhase('error');
      onError?.(friendly);
    }
  }, [onError]);

  // ─── Bucle de nitidez en tiempo real ─────────────────────────────────────
  const startSharpnessLoop = useCallback(() => {
    let lastMeasure = 0;
    const INTERVAL = 200; // ms entre medidas

    const loop = (ts: number) => {
      if (closedRef.current) return;
      if (ts - lastMeasure >= INTERVAL && videoRef.current) {
        const score = measureSharpnessLive(videoRef.current);
        setSharpness(score);
        lastMeasure = ts;
      }
      sharpnessRafRef.current = requestAnimationFrame(loop);
    };
    sharpnessRafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    startCamera();
    ensureOcrWorker()
      .then(() => { if (!closedRef.current) setWorkerReady(true); })
      .catch(() => {});

    return () => {
      closedRef.current = true;
      if (ocrTimeoutRef.current) clearTimeout(ocrTimeoutRef.current);
      stopStream();
    };
  }, []);

  // ─── Capture + multi-strategy OCR ────────────────────────────────────────
  const captureAndOCR = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || phase !== 'live') return;

    if (sharpnessRafRef.current) {
      cancelAnimationFrame(sharpnessRafRef.current);
      sharpnessRafRef.current = null;
    }

    setPhase('processing');
    setProgress(0);
    setProgressLabel('Capturando imagen...');

    try {
      await waitForVideoReady(videoRef.current);

      // ── Capturar zona guía (80% × 40% central) ───────────────────────────
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      const cropX = Math.round(vw * 0.1);
      const cropY = Math.round(vh * 0.3);
      const cropW = Math.round(vw * 0.8);
      const cropH = Math.round(vh * 0.4);

      const crop = document.createElement('canvas');
      crop.width = cropW;
      crop.height = cropH;
      const cropCtx = crop.getContext('2d')!;
      cropCtx.drawImage(videoRef.current, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      // Calidad alta: Cloud Vision agradece resolución/detalle (impreso y manuscrito).
      const cropDataUrl = crop.toDataURL('image/jpeg', 0.95);
      setCapturedDataUrl(cropDataUrl);
      setProgress(15);

      let bestText = '';
      let bestConfidence = 0;
      let cloudOk = false;
      // Líneas en orden de lectura (sólo Cloud Vision las provee) — permiten
      // detectar la OF y el artículo de la línea inmediatamente inferior.
      let bestLines: string[] = [];

      // Timeout global de seguridad (incluye respaldo local).
      let timedOut = false;
      ocrTimeoutRef.current = setTimeout(() => { timedOut = true; }, 30000);

      // ── PRINCIPAL: Cloud Vision (impreso + manuscrito) ────────────────────
      try {
        setProgressLabel('Leyendo con Cloud Vision...');
        setProgress(45);
        const cloud = await recognizeImage(cropDataUrl);
        if (cloud.ok && cloud.text.trim()) {
          bestText = cloud.text.trim();
          bestConfidence = cloud.confidence || 80;
          bestLines = cloud.lines || [];
          cloudOk = true;
          setProgress(90);
        }
      } catch {
        // Cloud no disponible (Vision deshabilitada / sin red) → respaldo local.
        cloudOk = false;
      }

      // ── RESPALDO: Tesseract local (solo si la nube falló) ─────────────────
      if (!cloudOk && !closedRef.current && !timedOut) {
        const fallback = await runTesseractFallback(
          crop,
          (pct, label) => { setProgress(pct); setProgressLabel(label); },
          () => closedRef.current || timedOut,
        );
        bestText = fallback.text;
        bestConfidence = fallback.confidence;
      }

      if (ocrTimeoutRef.current) clearTimeout(ocrTimeoutRef.current);
      if (closedRef.current) return;

      if (timedOut && !bestText) {
        throw new Error('timeout');
      }

      // Parsear y formatear el texto reconocido antes de mostrarlo al usuario.
      // 1º: por líneas (OF + artículo de la línea inferior) — evita una 2ª foto.
      // 2º: parser lenient sobre el texto completo. 3º: texto crudo (foto manual).
      const lineParse = bestLines.length > 0 ? parseScanFromLines(bestLines) : null;
      const parseResult = lineParse && lineParse.success ? lineParse : parseScanInputLenient(bestText);
      const displayText = parseResult.success
        ? `${parseResult.data.articleCode} // ${parseResult.data.orderFab}`
        : bestText;

      setProgress(100);
      setOcrText(displayText);
      setOcrConfidence(Math.round(bestConfidence));
      setPhase('review');

    } catch (err) {
      if (closedRef.current) return;
      if (ocrTimeoutRef.current) clearTimeout(ocrTimeoutRef.current);
      _ocr.progressFn = () => {};

      const raw = err instanceof Error ? err.message : 'Error en OCR';
      const friendly = raw === 'timeout'
        ? 'La lectura tardó demasiado. Acerca la etiqueta, asegura buena luz y evita reflejos.'
        : raw.toLowerCase().includes('memory')
        ? 'Memoria insuficiente. Usa la pistola o código de barras.'
        : raw.toLowerCase().includes('cámara') || raw.toLowerCase().includes('camera')
        ? raw
        : 'No se pudo leer la etiqueta. Intenta de nuevo con mejor iluminación.';

      setErrorMsg(friendly);
      setPhase('error');
      onError?.(friendly);
    }
  }, [phase, onError]);

  const handleRetry = useCallback(() => {
    setCapturedDataUrl(null);
    setOcrText('');
    setErrorMsg(null);
    setOcrConfidence(0);
    startCamera();
  }, [startCamera]);

  const handleConfirm = useCallback(() => {
    const trimmed = ocrText.trim();
    if (!trimmed) return;
    stopStream();
    onResult(trimmed);
  }, [ocrText, stopStream, onResult]);

  // ─── Indicador de nitidez ─────────────────────────────────────────────────
  const sharpLabel = sharpness >= 55 ? { text: 'Nítido', color: 'text-emerald-400', dot: 'bg-emerald-400' }
    : sharpness >= 30 ? { text: 'Aceptable', color: 'text-amber-400', dot: 'bg-amber-400' }
    : { text: 'Borroso — acerca más', color: 'text-red-400', dot: 'bg-red-400' };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-safe-top py-3 bg-black/80">
        <div>
          {phase === 'starting' && <p className="text-slate-400 text-sm">Iniciando cámara...</p>}
          {phase === 'live' && (
            <div className="flex items-center gap-3">
              <p className="text-cyan-400 text-sm font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                Centra la etiqueta
                {!workerReady && <span className="text-slate-500 text-xs font-normal ml-1">(cargando...)</span>}
              </p>
              {/* Indicador de nitidez */}
              {sharpness > 0 && (
                <span className={`text-xs font-bold flex items-center gap-1 ${sharpLabel.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sharpLabel.dot}`} />
                  {sharpLabel.text}
                </span>
              )}
            </div>
          )}
          {phase === 'processing' && (
            <p className="text-amber-400 text-sm font-bold flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              {progressLabel || `Analizando... ${progress}%`}
            </p>
          )}
          {phase === 'review' && (
            <p className="text-emerald-400 text-sm font-bold">
              ✅ Texto detectado
              {ocrConfidence > 0 && (
                <span className={`ml-2 text-xs font-bold ${ocrConfidence >= CONFIDENCE_THRESHOLD ? 'text-emerald-400' : 'text-amber-400'}`}>
                  ({ocrConfidence}% confianza)
                </span>
              )}
            </p>
          )}
          {phase === 'error' && <p className="text-red-400 text-sm font-bold">❌ Error</p>}
        </div>
        <button
          onClick={handleClose}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors text-xl"
        >
          ×
        </button>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Live viewfinder */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: phase === 'live' ? 'block' : 'none' }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Guide overlay */}
        {phase === 'live' && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${window.innerWidth} ${window.innerHeight - 120}`} preserveAspectRatio="none">
              {(() => {
                const vw = window.innerWidth;
                const vh = Math.max(window.innerHeight - 120, 200);
                const gx = vw * 0.1, gy = vh * 0.3, gw = vw * 0.8, gh = vh * 0.4;
                const r = 8, arm = 28;
                // Color del marco según nitidez
                const frameColor = sharpness >= 55 ? '#34d399' : sharpness >= 30 ? '#fbbf24' : '#f87171';
                return (
                  <>
                    <path fillRule="evenodd" fill="rgba(0,0,0,0.55)"
                      d={`M0 0 H${vw} V${vh} H0 Z M${gx+r} ${gy} H${gx+gw-r} Q${gx+gw} ${gy} ${gx+gw} ${gy+r} V${gy+gh-r} Q${gx+gw} ${gy+gh} ${gx+gw-r} ${gy+gh} H${gx+r} Q${gx} ${gy+gh} ${gx} ${gy+gh-r} V${gy+r} Q${gx} ${gy} ${gx+r} ${gy} Z`} />
                    {/* Esquinas del marco — color dinámico según nitidez */}
                    <path d={`M${gx+r+arm} ${gy} H${gx+r} Q${gx} ${gy} ${gx} ${gy+r} V${gy+r+arm}`} fill="none" stroke={frameColor} strokeWidth="3.5" strokeLinecap="round" />
                    <path d={`M${gx+gw-r-arm} ${gy} H${gx+gw-r} Q${gx+gw} ${gy} ${gx+gw} ${gy+r} V${gy+r+arm}`} fill="none" stroke={frameColor} strokeWidth="3.5" strokeLinecap="round" />
                    <path d={`M${gx+r+arm} ${gy+gh} H${gx+r} Q${gx} ${gy+gh} ${gx} ${gy+gh-r} V${gy+gh-r-arm}`} fill="none" stroke={frameColor} strokeWidth="3.5" strokeLinecap="round" />
                    <path d={`M${gx+gw-r-arm} ${gy+gh} H${gx+gw-r} Q${gx+gw} ${gy+gh} ${gx+gw} ${gy+gh-r} V${gy+gh-r-arm}`} fill="none" stroke={frameColor} strokeWidth="3.5" strokeLinecap="round" />
                    {/* Línea de escaneo */}
                    <line x1={gx+8} x2={gx+gw-8} y1={gy+gh/2} y2={gy+gh/2} stroke={frameColor} strokeWidth="1.5" opacity="0.7">
                      <animate attributeName="y1" values={`${gy+6};${gy+gh-6};${gy+6}`} dur="2.5s" repeatCount="indefinite" />
                      <animate attributeName="y2" values={`${gy+6};${gy+gh-6};${gy+6}`} dur="2.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2.5s" repeatCount="indefinite" />
                    </line>
                    <text x={gx+gw/2} y={gy-10} textAnchor="middle" fontSize="13" fill="#94a3b8">Centra la etiqueta aquí</text>
                  </>
                );
              })()}
            </svg>
          </div>
        )}

        {/* Processing */}
        {phase === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20">
            {capturedDataUrl && (
              <img src={capturedDataUrl} alt="Captura"
                className="max-w-sm w-4/5 rounded-xl border border-slate-600 mb-6 opacity-60"
                style={{ maxHeight: '35vh', objectFit: 'contain' }}
              />
            )}
            <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-400 rounded-full animate-spin mb-4" />
            <p className="text-amber-400 font-bold text-lg mb-2">{progressLabel || 'Procesando...'}</p>
            <div className="w-56 bg-slate-700 rounded-full h-2 mt-1">
              <div className="bg-amber-400 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-slate-500 text-xs mt-2">{progress}%</p>
          </div>
        )}

        {/* Starting */}
        {phase === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
            <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Review */}
        {phase === 'review' && (
          <div className="absolute inset-0 flex flex-col bg-slate-950 z-20 overflow-y-auto">
            {capturedDataUrl && (
              <div className="flex-shrink-0 p-4">
                <p className="text-slate-400 text-xs mb-2 text-center uppercase tracking-widest">Imagen capturada</p>
                <img src={capturedDataUrl} alt="Captura"
                  className="w-full max-w-sm mx-auto rounded-xl border border-slate-600"
                  style={{ maxHeight: '28vh', objectFit: 'contain' }}
                />
              </div>
            )}
            <div className="flex-1 px-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400 text-xs uppercase tracking-widest">Texto reconocido — edita si es necesario</p>
                {ocrConfidence > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    ocrConfidence >= CONFIDENCE_THRESHOLD
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : ocrConfidence >= 45
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {ocrConfidence >= CONFIDENCE_THRESHOLD ? '✓' : '⚠'} {ocrConfidence}%
                  </span>
                )}
              </div>
              <textarea
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                rows={6}
                placeholder="(sin texto detectado)"
                className="w-full bg-slate-800 text-white text-base border border-slate-600 focus:border-cyan-500 focus:outline-none rounded-xl p-3 resize-none font-mono"
                autoFocus
                inputMode="text"
                enterKeyHint="done"
              />
              {!ocrText.trim() && (
                <p className="text-amber-400 text-xs mt-2">No se detectó texto. Intenta acercar la etiqueta y evitar reflejos.</p>
              )}
              {ocrText.trim() && ocrConfidence > 0 && ocrConfidence < 45 && (
                <p className="text-amber-400 text-xs mt-2">⚠ Confianza baja ({ocrConfidence}%) — verifica el texto antes de confirmar.</p>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 p-6">
            <p className="text-5xl mb-4">⚠️</p>
            <p className="text-red-400 font-bold text-lg mb-2 text-center">
              {errorMsg?.includes('cámara') || errorMsg?.includes('permisos') || errorMsg?.includes('permitida')
                ? 'Sin acceso a la cámara'
                : 'Error al leer la etiqueta'}
            </p>
            <p className="text-slate-400 text-sm text-center mb-6">{errorMsg}</p>
            <div className="flex gap-3">
              {!errorMsg?.includes('cámara') && !errorMsg?.includes('permisos') && !errorMsg?.includes('permitida') && (
                <button onClick={handleRetry} className="px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-500">
                  🔄 Reintentar
                </button>
              )}
              <button onClick={handleClose} className="px-6 py-3 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-600">Cerrar</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex-shrink-0 pb-safe-bottom px-6 py-4 bg-black/90 flex items-center justify-center gap-4">
        {phase === 'live' && (
          <>
            <button onClick={handleClose}
              className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors text-sm font-bold">
              Cerrar
            </button>
            <button
              onClick={captureAndOCR}
              disabled={!workerReady}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all ${
                workerReady
                  ? sharpness >= 55
                    ? 'bg-white shadow-white/20'
                    : sharpness >= 30
                    ? 'bg-amber-100 shadow-amber-200/30'
                    : 'bg-white/80'
                  : 'bg-white/30 cursor-not-allowed'
              }`}
              title="Capturar etiqueta"
            >
              <span className="text-3xl">📸</span>
            </button>
            <div className="w-14 h-14" />
          </>
        )}

        {phase === 'processing' && <p className="text-amber-400 text-sm">Multi-estrategia OCR activa...</p>}

        {phase === 'review' && (
          <>
            <button onClick={handleRetry}
              className="flex-1 max-w-[140px] py-3 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-600 transition-colors text-sm">
              🔄 Reintentar
            </button>
            <button onClick={handleConfirm} disabled={!ocrText.trim()}
              className={`flex-1 max-w-[200px] py-3 rounded-xl font-bold transition-colors text-sm ${
                ocrText.trim() ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}>
              ✅ Confirmar texto
            </button>
          </>
        )}

        {phase === 'starting' && <p className="text-slate-400 text-sm">Iniciando cámara...</p>}
      </div>

      {/* Tip — sólo en live */}
      {phase === 'live' && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none" style={{ zIndex: 15 }}>
          <div className="bg-black/70 px-4 py-1.5 rounded-full">
            <p className="text-slate-300 text-xs">
              {sharpness >= 55
                ? '✅ Buena nitidez — puedes capturar'
                : sharpness >= 30
                ? '📷 Acerca un poco más la etiqueta'
                : '⚠️ Imagen borrosa — mantén el móvil estable'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraOCRScanner;
