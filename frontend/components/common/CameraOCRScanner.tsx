/**
 * CameraOCRScanner — Captura de etiquetas con OCR
 * Full-screen, guía visual, edición del resultado antes de confirmar.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import { preprocessCanvasForOcr, waitForVideoReady } from '../../lib/ocrPreprocess';

interface CameraOCRScannerProps {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  onClose: () => void;
  language?: 'spa' | 'eng' | 'fra' | 'deu';
}

type Phase = 'starting' | 'live' | 'processing' | 'review' | 'error';

const CameraOCRScanner: React.FC<CameraOCRScannerProps> = ({
  onResult,
  onError,
  onClose,
  language = 'spa',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [progress, setProgress] = useState(0);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const closedRef = useRef(false);

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
    startCamera();
    return () => {
      closedRef.current = true;
      if (ocrTimeoutRef.current) clearTimeout(ocrTimeoutRef.current);
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ocrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const captureAndOCR = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || phase !== 'live') return;
    setPhase('processing');
    setProgress(0);
    setErrorMsg(null);

    try {
      await waitForVideoReady(videoRef.current);
      setProgress(10); // Paso 1: captura completada

      const canvas = canvasRef.current;
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');

      // Crop to the central guide zone (80% width, ~40% height centered)
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

      // Show the raw captured crop as preview
      setCapturedDataUrl(crop.toDataURL('image/jpeg', 0.9));
      setProgress(20); // Paso 2: imagen capturada, preprocesando

      const imageData = preprocessCanvasForOcr(crop);
      setProgress(35); // Paso 3: imagen preprocesada, enviando a OCR

      // Timeout de 20s para OCR (en tablets lentos Tesseract puede colgarse)
      const result = await Promise.race([
        Tesseract.recognize(imageData, `${language}+eng`, {
          logger: (m: { status?: string; progress?: number }) => {
            if (m.status === 'recognizing text' && typeof m.progress === 'number') {
              setProgress(35 + Math.round(m.progress * 55));
            }
          },
        }),
        new Promise<never>((_, reject) => {
          ocrTimeoutRef.current = setTimeout(() => {
            reject(new Error('El OCR está tardando demasiado. Intenta con mejor iluminación o acerca la etiqueta.'));
          }, 20000);
        }),
      ]);

      if (ocrTimeoutRef.current) clearTimeout(ocrTimeoutRef.current);
      if (closedRef.current) return;

      setProgress(95); // Paso 4: texto reconocido
      const text = result.data.text.trim();
      setOcrText(text);
      setPhase('review');
    } catch (err) {
      if (closedRef.current) return;
      if (ocrTimeoutRef.current) clearTimeout(ocrTimeoutRef.current);
      const msg = err instanceof Error ? err.message : 'Error en OCR';
      setErrorMsg(msg);
      // Diferenciar errores para mejor diagnóstico
      if (msg.includes('tarda demasiado')) {
        setErrorMsg('Tiempo de espera agotado. Acerca la etiqueta, evita reflejos y asegura buena iluminación.');
      } else if (msg.includes('memory') || msg.includes('Memory')) {
        setErrorMsg('Memoria insuficiente para OCR. Usa la pistola o escaneo de código de barras.');
      } else if (msg.includes('cámara') || msg.includes('camara')) {
        setErrorMsg(msg);
      }
      setPhase('error');
      onError?.(msg);
    }
  }, [phase, language, onError]);

  const handleRetryCapture = useCallback(() => {
    // Reintentar la captura sin reiniciar la cámara (desde fase error)
    setCapturedDataUrl(null);
    setOcrText('');
    setErrorMsg(null);
    if (phase === 'error') {
      // Volver a live y reiniciar stream
      startCamera();
      setPhase('live');
    } else {
      startCamera();
    }
  }, [phase, startCamera]);

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
            <p className="text-red-400 text-sm font-bold">❌ Error de cámara</p>
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
            {/* Dark mask via SVG */}
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
                    {/* Corner brackets */}
                    <path d={`M${gx + r + arm} ${gy} H${gx + r} Q${gx} ${gy} ${gx} ${gy + r} V${gy + r + arm}`} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                    <path d={`M${gx + gw - r - arm} ${gy} H${gx + gw - r} Q${gx + gw} ${gy} ${gx + gw} ${gy + r} V${gy + r + arm}`} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                    <path d={`M${gx + r + arm} ${gy + gh} H${gx + r} Q${gx} ${gy + gh} ${gx} ${gy + gh - r} V${gy + gh - r - arm}`} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                    <path d={`M${gx + gw - r - arm} ${gy + gh} H${gx + gw - r} Q${gx + gw} ${gy + gh} ${gx + gw} ${gy + gh - r} V${gy + gh - r - arm}`} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                    {/* Animated scan line */}
                    <line x1={gx + 8} x2={gx + gw - 8} y1={gy + gh / 2} y2={gy + gh / 2} stroke="#22d3ee" strokeWidth="1.5" opacity="0.7">
                      <animate attributeName="y1" values={`${gy + 6};${gy + gh - 6};${gy + 6}`} dur="2.5s" repeatCount="indefinite" />
                      <animate attributeName="y2" values={`${gy + 6};${gy + gh - 6};${gy + 6}`} dur="2.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2.5s" repeatCount="indefinite" />
                    </line>
                    {/* Label hint inside zone */}
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
            {/* Aviso para tablets lentos */}
            {progress > 10 && progress < 60 && (
              <p className="text-slate-500 text-xs mt-2 max-w-xs text-center">
                Esto puede tardar unos segundos en tablets...
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
            {/* Captured image */}
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

            {/* OCR result editor */}
            <div className="flex-1 px-4 pb-4">
              <p className="text-slate-400 text-xs mb-2 uppercase tracking-widest">Texto reconocido — edita si es necesario</p>
              <textarea
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                rows={6}
                placeholder="(sin texto detectado)"
                className="w-full bg-slate-800 text-white text-base border border-slate-600 focus:border-cyan-500 focus:outline-none rounded-xl p-3 resize-none font-mono"
                autoFocus
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

            {/* Big capture button */}
            <button
              onClick={captureAndOCR}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg shadow-white/20 active:scale-95 transition-transform"
              title="Capturar etiqueta"
            >
              <span className="text-3xl">📸</span>
            </button>

            <div className="w-14 h-14" /> {/* spacer */}
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

      {/* Guide hint — only on live */}
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


