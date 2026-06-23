/**
 * PieceCounterCamera — Contador de piezas por imagen (sección PUNZONADO).
 *
 * Flujo calcado de CameraOCRScanner: cámara en vivo con indicador de nitidez,
 * captura, "procesando" y pantalla de revisión. En vez de OCR, envía la foto a
 * la Cloud Function `countPieces` (Claude Opus 4.8 visión) y muestra el conteo
 * con confianza, rango y avisos. El operario puede ajustar el número antes de
 * darlo por bueno.
 *
 * Dos modos:
 *  - Apiladas: requiere el espesor (mm) de cada pieza.
 *  - Sueltas: conteo de objetos, sin espesor.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { measureSharpnessLive, waitForVideoReady } from '../../lib/ocrPreprocess';
import { countPieces, type CountMode, type PieceCountResult } from '../../lib/api/pieceCounterApi';

interface PieceCounterCameraProps {
  onClose: () => void;
  /** Opcional: se invoca al confirmar con el conteo final (para futuras integraciones). */
  onConfirm?: (count: number, mode: CountMode) => void;
}

type Phase = 'starting' | 'live' | 'processing' | 'review' | 'error';

const THICKNESS_PRESETS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
const MAX_EDGE = 2000; // px lado largo enviado al modelo

const PieceCounterCamera: React.FC<PieceCounterCameraProps> = ({ onClose, onConfirm }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const closedRef = useRef(false);
  const sharpnessRafRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>('starting');
  const [mode, setMode] = useState<CountMode>('stacked');
  const [thickness, setThickness] = useState<string>('');
  const [sharpness, setSharpness] = useState(0);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PieceCountResult | null>(null);
  const [editableCount, setEditableCount] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const thicknessValid = mode === 'loose' || (Number(thickness) > 0);

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

  const startSharpnessLoop = useCallback(() => {
    let lastMeasure = 0;
    const INTERVAL = 200;
    const loop = (ts: number) => {
      if (closedRef.current) return;
      if (ts - lastMeasure >= INTERVAL && videoRef.current) {
        setSharpness(measureSharpnessLive(videoRef.current));
        lastMeasure = ts;
      }
      sharpnessRafRef.current = requestAnimationFrame(loop);
    };
    sharpnessRafRef.current = requestAnimationFrame(loop);
  }, []);

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
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      const friendly = msg.includes('notallowed') || msg.includes('permission')
        ? 'Cámara no permitida. Activa el acceso en los ajustes del navegador.'
        : msg.includes('notfound')
        ? 'No se encontró cámara trasera.'
        : 'Error al iniciar cámara. Comprueba los permisos.';
      setErrorMsg(friendly);
      setPhase('error');
    }
  }, [startSharpnessLoop]);

  useEffect(() => {
    closedRef.current = false;
    startCamera();
    return () => {
      closedRef.current = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureFrame = (video: HTMLVideoElement): string => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(video, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.9);
  };

  const captureAndCount = useCallback(async () => {
    if (!videoRef.current || phase !== 'live') return;
    if (mode === 'stacked' && !(Number(thickness) > 0)) {
      setErrorMsg('Indica el espesor de cada pieza antes de hacer la foto.');
      return;
    }
    if (sharpnessRafRef.current) {
      cancelAnimationFrame(sharpnessRafRef.current);
      sharpnessRafRef.current = null;
    }
    setPhase('processing');
    setErrorMsg(null);
    try {
      await waitForVideoReady(videoRef.current);
      const dataUrl = captureFrame(videoRef.current);
      setCapturedDataUrl(dataUrl);

      const res = await countPieces({
        imageBase64: dataUrl,
        mode,
        thicknessMm: mode === 'stacked' ? Number(thickness) : undefined,
      });
      if (closedRef.current) return;

      setResult(res);
      setEditableCount(res.count != null ? String(res.count) : '');
      setPhase('review');
    } catch (err: any) {
      if (closedRef.current) return;
      const raw = err?.message || '';
      const friendly = /api key|failed-precondition|no está configurada/i.test(raw)
        ? 'La función de conteo aún no tiene configurada la API key de Claude. Avisa al administrador.'
        : /too large|demasiado grande/i.test(raw)
        ? 'La imagen es demasiado grande. Aléjate un poco y repite.'
        : 'No se pudo contar. Repite la foto con buena luz y la pila bien encuadrada.';
      setErrorMsg(friendly);
      setPhase('error');
    }
  }, [phase, mode, thickness]);

  const handleRetry = useCallback(() => {
    setCapturedDataUrl(null);
    setResult(null);
    setEditableCount('');
    setErrorMsg(null);
    startCamera();
  }, [startCamera]);

  const handleConfirm = useCallback(() => {
    const n = Number(editableCount);
    if (Number.isFinite(n) && onConfirm) onConfirm(n, mode);
    handleClose();
  }, [editableCount, mode, onConfirm, handleClose]);

  const sharpLabel = sharpness >= 55
    ? { text: 'Nítido', color: 'text-emerald-400', dot: 'bg-emerald-400' }
    : sharpness >= 30
    ? { text: 'Aceptable', color: 'text-amber-400', dot: 'bg-amber-400' }
    : { text: 'Borroso — estabiliza', color: 'text-red-400', dot: 'bg-red-400' };

  const confColor = (pct: number) =>
    pct >= 75 ? 'bg-emerald-500/20 text-emerald-400'
      : pct >= 50 ? 'bg-amber-500/20 text-amber-400'
      : 'bg-red-500/20 text-red-400';

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-safe-top py-3 bg-black/80">
        <p className="text-cyan-400 text-sm font-bold flex items-center gap-1.5">
          <span className="text-lg">📐</span> Contar piezas
        </p>
        <button
          onClick={handleClose}
          className="w-9 h-9 rounded-full bg-rose-500/20 flex items-center justify-center text-white hover:bg-rose-500/30 text-xl"
        >×</button>
      </div>

      {/* Main */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: phase === 'live' ? 'block' : 'none' }}
        />

        {/* Controles en vivo (modo + espesor) */}
        {phase === 'live' && (
          <div className="absolute top-0 left-0 right-0 p-3 z-10 bg-gradient-to-b from-black/70 to-transparent">
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setMode('stacked')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                  mode === 'stacked' ? 'bg-cyan-600 text-white' : 'bg-slate-800/80 text-slate-300'
                }`}
              >📚 Apiladas</button>
              <button
                onClick={() => setMode('loose')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                  mode === 'loose' ? 'bg-cyan-600 text-white' : 'bg-slate-800/80 text-slate-300'
                }`}
              >🧩 Sueltas</button>
            </div>
            {mode === 'stacked' && (
              <div className="bg-slate-900/80 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 text-xs font-bold whitespace-nowrap">Espesor (mm):</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={thickness}
                    onChange={(e) => setThickness(e.target.value)}
                    placeholder="p.ej. 2"
                    className="flex-1 bg-slate-800 text-white text-base font-mono font-bold border border-slate-600 focus:border-cyan-500 focus:outline-none rounded-lg px-2 py-1 text-center"
                  />
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {THICKNESS_PRESETS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setThickness(String(t))}
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        Number(thickness) === t ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}
                    >{t}</button>
                  ))}
                </div>
              </div>
            )}
            {sharpness > 0 && (
              <div className="flex justify-center mt-2">
                <span className={`text-xs font-bold flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full ${sharpLabel.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sharpLabel.dot}`} />
                  {sharpLabel.text}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Starting */}
        {phase === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Processing */}
        {phase === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20 p-6">
            {capturedDataUrl && (
              <img src={capturedDataUrl} alt="Captura"
                className="max-w-sm w-4/5 rounded-xl border border-slate-600 mb-6 opacity-60"
                style={{ maxHeight: '40vh', objectFit: 'contain' }} />
            )}
            <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4" />
            <p className="text-cyan-400 font-bold text-lg">Contando con Claude…</p>
            <p className="text-slate-500 text-xs mt-2">Puede tardar unos segundos</p>
          </div>
        )}

        {/* Review */}
        {phase === 'review' && result && (
          <div className="absolute inset-0 flex flex-col bg-slate-950 z-20 overflow-y-auto">
            {capturedDataUrl && (
              <div className="flex-shrink-0 p-3">
                <img src={capturedDataUrl} alt="Captura"
                  className="w-full max-w-sm mx-auto rounded-xl border border-slate-700"
                  style={{ maxHeight: '26vh', objectFit: 'contain' }} />
              </div>
            )}
            <div className="flex-1 px-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400 text-xs uppercase tracking-widest">Conteo — ajusta si hace falta</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${confColor(result.confidencePct)}`}>
                  {result.confidencePct}% confianza
                </span>
              </div>

              <input
                type="number"
                inputMode="numeric"
                value={editableCount}
                onChange={(e) => setEditableCount(e.target.value)}
                className="w-full bg-slate-800 text-white text-5xl font-mono font-black tracking-wider border border-slate-600 focus:border-cyan-500 focus:outline-none rounded-xl p-4 text-center"
              />
              <p className="text-center text-slate-500 text-xs mt-1">piezas</p>

              {result.range && (
                <p className="text-center text-amber-300 text-sm mt-3">
                  Rango estimado: <span className="font-bold">{result.range.min}–{result.range.max}</span>
                </p>
              )}
              {result.reasoning && (
                <p className="text-slate-400 text-xs mt-3 leading-relaxed">{result.reasoning}</p>
              )}
              {result.warnings.length > 0 && (
                <div className="mt-3 space-y-1">
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-amber-400 text-xs flex gap-1.5"><span>⚠</span><span>{w}</span></p>
                  ))}
                </div>
              )}
              {result.confidencePct < 60 && (
                <p className="text-red-400 text-xs mt-3">
                  Confianza baja — revisa el número o repite la foto con mejor encuadre/luz.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 p-6">
            <p className="text-5xl mb-4">⚠️</p>
            <p className="text-slate-300 text-sm text-center mb-6">{errorMsg}</p>
            <div className="flex gap-3">
              <button onClick={handleRetry} className="px-6 py-3 bg-cyan-600 text-white rounded-xl font-bold hover:bg-cyan-500">🔄 Reintentar</button>
              <button onClick={handleClose} className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-500">Cerrar</button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex-shrink-0 pb-safe-bottom px-6 py-4 bg-black/90 flex items-center justify-center gap-4">
        {phase === 'live' && (
          <>
            <button onClick={handleClose}
              className="w-14 h-14 rounded-full bg-rose-500/20 text-white text-sm font-bold hover:bg-rose-500/30">
              Salir
            </button>
            <button
              onClick={captureAndCount}
              disabled={!thicknessValid}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all ${
                thicknessValid ? 'bg-white' : 'bg-white/30 cursor-not-allowed'
              }`}
              title="Hacer foto y contar"
            >
              <span className="text-3xl">📸</span>
            </button>
            <div className="w-14 h-14" />
          </>
        )}
        {phase === 'review' && (
          <>
            <button onClick={handleRetry}
              className="flex-1 max-w-[140px] py-3 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-600 text-sm">
              🔄 Otra foto
            </button>
            <button onClick={handleConfirm}
              className="flex-1 max-w-[200px] py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 text-sm">
              ✅ Hecho
            </button>
          </>
        )}
        {phase === 'live' && !thicknessValid && (
          <p className="absolute bottom-24 left-0 right-0 text-center text-amber-400 text-xs pointer-events-none">
            Indica el espesor para activar la foto
          </p>
        )}
      </div>
    </div>
  );
};

export default PieceCounterCamera;
