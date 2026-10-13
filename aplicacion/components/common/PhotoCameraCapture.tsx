/**
 * PhotoCameraCapture — Cámara en vivo para hacer una foto en el momento
 * (en vez de depender del selector de archivos del sistema, que en kioskos/
 * escritorio no abre la cámara). Flujo calcado de PieceCounterCamera pero
 * sin OCR/conteo: vivo → captura → revisar → usar/repetir.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { waitForVideoReady } from '../../lib/ocrPreprocess';

interface PhotoCameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

type Phase = 'starting' | 'live' | 'review' | 'error';

const MAX_EDGE = 1600; // px lado largo de la foto capturada

const dataUrlToFile = (dataUrl: string): File => {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)![1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], `foto-${Date.now()}.jpg`, { type: mime });
};

const PhotoCameraCapture: React.FC<PhotoCameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const closedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('starting');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
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
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      const friendly = msg.includes('notallowed') || msg.includes('permission')
        ? 'Cámara no permitida. Activa el acceso en los ajustes del navegador.'
        : msg.includes('notfound')
        ? 'No se encontró ninguna cámara.'
        : 'Error al iniciar la cámara.';
      setErrorMsg(friendly);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    closedRef.current = false;
    startCamera();
    return () => {
      closedRef.current = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || phase !== 'live') return;
    const video = videoRef.current;
    await waitForVideoReady(video);
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(video, 0, 0, w, h);
    setCapturedDataUrl(c.toDataURL('image/jpeg', 0.9));
    setPhase('review');
  }, [phase]);

  const handleRetry = useCallback(() => {
    setCapturedDataUrl(null);
    setErrorMsg(null);
    startCamera();
  }, [startCamera]);

  const handleUse = useCallback(() => {
    if (!capturedDataUrl) return;
    const file = dataUrlToFile(capturedDataUrl);
    stopStream();
    onCapture(file);
  }, [capturedDataUrl, onCapture, stopStream]);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-safe-top py-3 bg-black/80">
        <p className="text-violet-400 text-sm font-bold flex items-center gap-1.5">
          <Camera className="w-4 h-4" aria-hidden /> Hacer foto
        </p>
        <button
          onClick={handleClose}
          className="w-9 h-9 rounded-full bg-rose-500/20 flex items-center justify-center text-white hover:bg-rose-500/30 text-xl"
        >×</button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: phase === 'live' ? 'block' : 'none' }}
        />

        {phase === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        )}

        {phase === 'review' && capturedDataUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-20 p-3">
            <img
              src={capturedDataUrl}
              alt="Captura"
              className="max-w-full max-h-full rounded-xl object-contain"
            />
          </div>
        )}

        {phase === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 p-6">
            <p className="text-slate-300 text-sm text-center mb-6">{errorMsg}</p>
            <div className="flex gap-3">
              <button onClick={handleRetry} className="px-6 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-500">Reintentar</button>
              <button onClick={handleClose} className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-500">Cerrar</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 pb-safe-bottom px-6 py-4 bg-black/90 flex items-center justify-center gap-4">
        {phase === 'live' && (
          <>
            <button onClick={handleClose}
              className="w-14 h-14 rounded-full bg-rose-500/20 text-white text-sm font-bold hover:bg-rose-500/30">
              Salir
            </button>
            <button
              onClick={handleCapture}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 transition-all"
              title="Hacer foto"
              aria-label="Hacer foto"
            >
              <Camera className="w-8 h-8 text-slate-900" aria-hidden />
            </button>
            <div className="w-14 h-14" />
          </>
        )}
        {phase === 'review' && (
          <>
            <button onClick={handleRetry}
              className="flex-1 max-w-[140px] py-3 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-600 text-sm">
              Repetir
            </button>
            <button onClick={handleUse}
              className="flex-1 max-w-[200px] py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 text-sm">
              Usar foto
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PhotoCameraCapture;
