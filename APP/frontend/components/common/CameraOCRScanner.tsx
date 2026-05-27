/**
 * CameraOCRScanner — Captura de etiquetas con OCR
 * Full-screen, guía visual, edición del resultado antes de confirmar.
 *
 * Optimizaciones de velocidad:
 *  - Worker Tesseract pre-inicializado en paralelo con la cámara (no cold-start al pulsar 📸)
 *  - Sólo idioma 'eng' + whitelist de caracteres industriales → carga y reconocimiento ~2× más rápido
 *  - PSM 6 (bloque uniforme) → mejor para etiquetas de una o dos líneas
 *  - OEM 1 (LSTM) → más preciso que el motor legacy
 *  - Singleton: si el usuario abre OCR por segunda vez en la sesión, el worker ya está listo
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import { preprocessCanvasForOcr, waitForVideoReady } from '../../lib/ocrPreprocess';

interface CameraOCRScannerProps {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  onClose: () => void;
  language?: 'spa' | 'eng' | 'fra' | 'deu';
}

type Phase = 'starting' | 'live' | 'processing' | 'review' | 'error';

// ─── Worker singleton ────────────────────────────────────────────────────────
// Se inicializa la primera vez que se abre el scanner y se reutiliza en toda la sesión.
// Esto elimina el "cold-start" en capturas posteriores (~3-8s → <1s).

interface OcrWorkerState {
  promise: Promise<import('tesseract.js').Worker> | null;
  worker: import('tesseract.js').Worker | null;
  progressFn: (p: number) => void;
}

const _ocr: OcrWorkerState = {
  promise: null,
  worker: null,
  progressFn: () => {},
};

function ensureOcrWorker(): Promise<import('tesseract.js').Worker> {
  if (_ocr.promise) return _ocr.promise;

  _ocr.promise = createWorker('eng', 1, {
    // OEM 1 = LSTM_ONLY — más preciso, más rápido que el motor legacy
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        _ocr.progressFn(35 + Math.round(m.progress * 55));
      }
    },
  } as Parameters<typeof createWorker>[2])
    .then(async (w) => {
      await w.setParameters({
        // Whitelist: sólo caracteres que aparecen en etiquetas industriales
        // Elimina miles de glifos innecesarios → reconocimiento más rápido y preciso
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ/- .',
        // PSM 6: bloque de texto uniforme — ideal para etiquetas de 1-3 líneas
        tessedit_pageseg_mode: '6',
      } as Record<string, string>);
      _ocr.worker = w;
      return w;
    })
    .catch((err) => {
      // Si falla la inicialización, resetear para poder reintentar
      _ocr.promise = null;
      _ocr.worker = null;
      throw err;
    });

  return _ocr.promise;
}
// ────────────────────────────────────────────────────────────────────────────

const CameraOCRScanner: React.FC<CameraOCRScannerProps> = ({
  onResult,
  onError,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [progress, setProgress] = useState(0);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const closedRef = useRef(false);
  const ocrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (closedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await waitForVideoReady(videoRef.current);
      }
      if (!closedRef.current) setPhase('live');
    } catch (err) {
      if (closedRef.current) return;
      const msg = err instanceof Error ? err.message : 'Error al acceder a la cámara';
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

  useEffect(() => {
    // Inicia cámara Y worker en paralelo — cuando el usuario pulse 📸, ambos están listos
    startCamera();

    ensureOcrWorker()
      .then(() => { if (!closedRef.current) setWorkerReady(true); })
      .catch(() => { /* falla silenciosa — captureAndOCR tiene fallback */ });

    return () => {
      closedRef.current = true;
      if (ocrTimeoutRef.current) clearTimeout(ocrTimeoutRef.current);
      stopStream();
      // No terminamos el worker singleton — se reutiliza en la próxima apertura
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureAndOCR = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || phase !== 'live') return;
    setPhase('processing');
    setProgress(0);
    setErrorMsg(null);

    // Registrar el callback de progreso para este reconocimiento
    _ocr.progressFn = setProgress;

    try {
      await waitForVideoReady(videoRef.current);
      setProgress(10);

      // Capturar y recortar la zona guía central (80% ancho × 40% alto)
      const canvas = canvasRef.current;
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      canvas.width = vw;
      canvas.height = vh;

      const cropX = Math.round(vw * 0.1);
      const cropY = Math.round(vh * 0.3);
      const cropW = Math.round(vw * 0.8);
      const cropH = Math.round(vh * 0.4);

      const crop = document.createElement('canvas');
      crop.width = cropW;
      crop.height = cropH;
      const cropCtx = crop.getContext('2d');
      if (!cropCtx) throw new Error('No crop context');
      cropCtx.drawImage(videoRef.current, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      setCapturedDataUrl(crop.toDataURL('image/jpeg', 0.9));
      setProgress(20);

      // Preprocesado: grayscale + contraste + binarización Otsu + PNG lossless
      const imageData = preprocessCanvasForOcr(crop);
      setProgress(35);

      // Esperar a que el worker esté listo (debería estarlo ya — se inició en paralelo)
      const worker = await ensureOcrWorker();
      if (closedRef.current) return;

      // Timeout reducido a 12s — si tarda más, algo va mal (iluminación, imagen borrosa)
      const result = await Promise.race([
        worker.recognize(imageData),
        new Promise<never>((_, reject) => {
          ocrTimeoutRef.current = setTimeout(() => {
            reject(new Error('timeout'));
          }, 12000);
        }),
      ]);

      if (ocrTimeoutRef.current) clearTimeout(ocrTimeoutRef.current);
      if (closedRef.current) return;

      setProgress(95);
      const text = result.data.text.trim();
      setOcrText(text);
      setPhase('review');
    } catch (err) {
      if (closedRef.current) return;
      if (ocrTimeoutRef.current) clearTimeout(ocrTimeoutRef.current);
      _ocr.progressFn = () => {};

      const raw = err instanceof Error ? err.message : 'Error en OCR';
      let friendly: string;
      if (raw === 'timeout') {
        friendly = 'La lectura tardó demasiado. Acerca la etiqueta, asegura buena iluminación y evita reflejos.';
      } else if (raw.toLowerCase().includes('memory')) {
        friendly = 'Memoria insuficiente para OCR. Usa la pistola o escaneo de código de barras.';
      } else if (raw.toLowerCase().includes('cámara') || raw.toLowerCase().includes('camera')) {
        friendly = raw;
      } else {
        friendly = 'No se pudo leer la etiqueta. Intenta de nuevo con mejor iluminación.';
      }

      setErrorMsg(friendly);
      setPhase('error');
      onError?.(friendly);
    }
  }, [phase, onError]);

  const handleRetryCapture = useCallback(() => {
    setCapturedDataUrl(null);
    setOcrText('');
    setErrorMsg(null);
    startCamera();
  }, [startCamera]);

  const handleRetry = useCallback(() => {
    setCapturedDataUrl(null);
    setOcrText('');
    setErrorMsg(null);
    startCamera();
  }, [startCamera]);

  const handleConfirm = useCallback(() => {
    const trimmed = ocrText.trim();
    if (!trimmed) return;
    stopStream();
    onResult(trimmed);
  }, [ocrText, stopStream, onResult]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-safe-top py-3 bg-black/80">
        <div>
          {phase === 'starting' && <p className="text-slate-400 text-sm">Iniciando cámara...</p>}
          {phase === 'live' && (
            <p className="text-cyan-400 text-sm font-bold flex items-center gap-2">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              Centra la etiqueta en el recuadro
              {!workerReady && (
                <span className="text-slate-500 text-xs font-normal">(preparando OCR...)</span>
              )}
            </p>
          )}
          {phase === 'processing' && (
            <p className="text-amber-400 text-sm font-bold flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              Leyendo etiqueta... {progress > 0 ? `${progress}%` : ''}
            </p>
          )}
          {phase === 'review' && (
            <p className="text-emerald-400 text-sm font-bold flex items-center gap-2">
              ✅ Texto detectado — corrige si es necesario
            </p>
          )}
          {phase === 'error' && (
            <p className="text-red-400 text-sm font-bold">❌ Error</p>
          )}
        </div>
        <button
          onClick={handleClose}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors text-xl"
        >
          ×
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 relative overflow-hidden">

        {/* ── LIVE viewfinder ── */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: phase === 'live' ? 'block' : 'none' }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Guide overlay on live view */}
        {phase === 'live' && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${window.innerWidth} ${window.innerHeight - 120}`} preserveAspectRatio="none">
              {(() => {
                const vw = window.innerWidth;
                const vh = Math.max(window.innerHeight - 120, 200);
                const gx = vw * 0.1;
                const gy = vh * 0.3;
                const gw = vw * 0.8;
                const gh = vh * 0.4;
                const r = 8;
                const arm = 28;
                return (
                  <>
                    <path
                      fillRule="evenodd"
                      fill="rgba(0,0,0,0.60)"
                      d={`M0 0 H${vw} V${vh} H0 Z M${gx + r} ${gy} H${gx + gw - r} Q${gx + gw} ${gy} ${gx + gw} ${gy + r} V${gy + gh - r} Q${gx + gw} ${gy + gh} ${gx + gw - r} ${gy + gh} H${gx + r} Q${gx} ${gy + gh} ${gx} ${gy + gh - r} V${gy + r} Q${gx} ${gy} ${gx + r} ${gy} Z`}
                    />
                    <path d={`M${gx + r + arm} ${gy} H${gx + r} Q${gx} ${gy} ${gx} ${gy + r} V${gy + r + arm}`} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                    <path d={`M${gx + gw - r - arm} ${gy} H${gx + gw - r} Q${gx + gw} ${gy} ${gx + gw} ${gy + r} V${gy + r + arm}`} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                    <path d={`M${gx + r + arm} ${gy + gh} H${gx + r} Q${gx} ${gy + gh} ${gx} ${gy + gh - r} V${gy + gh - r - arm}`} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                    <path d={`M${gx + gw - r - arm} ${gy + gh} H${gx + gw - r} Q${gx + gw} ${gy + gh} ${gx + gw} ${gy + gh - r} V${gy + gh - r - arm}`} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                    <line x1={gx + 8} x2={gx + gw - 8} y1={gy + gh / 2} y2={gy + gh / 2} stroke="#22d3ee" strokeWidth="1.5" opacity="0.7">
                      <animate attributeName="y1" values={`${gy + 6};${gy + gh - 6};${gy + 6}`} dur="2.5s" repeatCount="indefinite" />
                      <animate attributeName="y2" values={`${gy + 6};${gy + gh - 6};${gy + 6}`} dur="2.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2.5s" repeatCount="indefinite" />
                    </line>
                    <text x={gx + gw / 2} y={gy - 10} textAnchor="middle" fontSize="13" fill="#94a3b8">Centra la etiqueta aquí</text>
                  </>
                );
              })()}
            </svg>
          </div>
        )}

        {/* ── PROCESSING overlay ── */}
        {phase === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20">
            {capturedDataUrl && (
              <img
                src={capturedDataUrl}
                alt="Captura"
                className="max-w-sm w-4/5 rounded-xl border border-slate-600 mb-6 opacity-60"
                style={{ maxHeight: '35vh', objectFit: 'contain' }}
              />
            )}
            <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-400 rounded-full animate-spin mb-4" />
            <p className="text-amber-400 font-bold text-lg mb-1">
              {progress < 20 ? 'Capturando imagen...' :
               progress < 35 ? 'Preparando imagen...' :
               'Leyendo etiqueta...'}
            </p>
            {progress > 0 && (
              <div className="w-48 bg-slate-700 rounded-full h-2 mt-2">
                <div
                  className="bg-amber-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {progress > 0 && (
              <p className="text-slate-400 text-sm mt-1">
                {progress < 20 ? 'Capturando imagen...' :
                 progress < 35 ? 'Preparando imagen...' :
                 progress < 90 ? `Analizando texto... ${progress}%` :
                 'Texto reconocido'}
              </p>
            )}
          </div>
        )}

        {/* ── STARTING overlay ── */}
        {phase === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
            <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        )}

        {/* ── REVIEW phase ── */}
        {phase === 'review' && (
          <div className="absolute inset-0 flex flex-col bg-slate-950 z-20 overflow-y-auto">
            {capturedDataUrl && (
              <div className="flex-shrink-0 p-4">
                <p className="text-slate-400 text-xs mb-2 text-center uppercase tracking-widest">Imagen capturada</p>
                <img
                  src={capturedDataUrl}
                  alt="Captura"
                  className="w-full max-w-sm mx-auto rounded-xl border border-slate-600"
                  style={{ maxHeight: '28vh', objectFit: 'contain' }}
                />
              </div>
            )}
            <div className="flex-1 px-4 pb-4">
              <p className="text-slate-400 text-xs mb-2 uppercase tracking-widest">Texto reconocido — edita si es necesario</p>
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
                <p className="text-amber-400 text-xs mt-2">
                  No se detectó texto. Intenta acercar la etiqueta y evitar reflejos.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── ERROR overlay ── */}
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
              {(!errorMsg?.includes('cámara') && !errorMsg?.includes('permisos') && !errorMsg?.includes('permitida')) && (
                <button
                  onClick={handleRetryCapture}
                  className="px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-500"
                >
                  🔄 Reintentar captura
                </button>
              )}
              <button
                onClick={handleClose}
                className="px-6 py-3 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-600"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex-shrink-0 pb-safe-bottom px-6 py-4 bg-black/90 flex items-center justify-center gap-4">
        {phase === 'live' && (
          <>
            <button
              onClick={handleClose}
              className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors text-sm font-bold"
            >
              Cerrar
            </button>

            <button
              onClick={captureAndOCR}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg shadow-white/20 active:scale-95 transition-transform"
              title="Capturar etiqueta"
            >
              <span className="text-3xl">📸</span>
            </button>

            <div className="w-14 h-14" />
          </>
        )}

        {phase === 'processing' && (
          <p className="text-amber-400 text-sm">Procesando con OCR...</p>
        )}

        {phase === 'review' && (
          <>
            <button
              onClick={handleRetry}
              className="flex-1 max-w-[140px] py-3 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-600 transition-colors text-sm"
            >
              🔄 Reintentar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!ocrText.trim()}
              className={`flex-1 max-w-[200px] py-3 rounded-xl font-bold transition-colors text-sm ${
                ocrText.trim()
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              ✅ Confirmar texto
            </button>
          </>
        )}

        {phase === 'starting' && (
          <p className="text-slate-400 text-sm">Iniciando cámara...</p>
        )}
      </div>

      {phase === 'live' && (
        <div
          className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none"
          style={{ zIndex: 15 }}
        >
          <div className="bg-black/60 px-4 py-1 rounded-full">
            <p className="text-slate-300 text-xs">Buena luz • sin reflejos • etiqueta horizontal</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraOCRScanner;
