/**
 * CameraOCRScanner — Captura de imágenes y OCR
 * Usa Tesseract.js para reconocimiento óptico de caracteres
 * Válido para leer referencias, etiquetas, y números de serie
 */

import React, { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';

interface CameraOCRScannerProps {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  onClose: () => void;
  language?: 'spa' | 'eng' | 'fra' | 'deu';
}

const CameraOCRScanner: React.FC<CameraOCRScannerProps> = ({
  onResult,
  onError,
  onClose,
  language = 'spa',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setIsCapturing(true);
          setError(null);
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Error al acceder a la cámara';
        console.error('[CameraOCRScanner] Camera error:', errorMsg);
        if (!cancelled) {
          setError(errorMsg);
          onError?.(errorMsg);
        }
      }
    };

    initCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [onError]);

  const captureAndOCR = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      setError(null);

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) throw new Error('No canvas context');

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;

      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvasRef.current.toDataURL('image/jpeg', 0.8);

      const result = await Tesseract.recognize(imageData, language, {
        logger: (m: { progress: number }) => {
          setProgress(Math.round(m.progress * 100));
        },
      });

      const text = result.data.text.trim();

      if (!text) {
        setError('No se detectó texto en la imagen. Intenta de nuevo.');
        setIsProcessing(false);
        return;
      }

      onResult(text);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Error en OCR';
      console.error('[CameraOCRScanner] OCR error:', errorMsg);
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
          <h3 className="font-bold text-white flex items-center gap-2">
            <span className="text-lg">📸</span>
            Leer Texto (OCR)
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="bg-black p-4">
          {error ? (
            <div className="aspect-square bg-red-900/20 rounded-lg border border-red-500 flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-400 font-bold mb-2">❌ Error</p>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          ) : isProcessing ? (
            <div className="aspect-square bg-slate-800 rounded-lg border border-slate-600 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-cyan-400 font-bold mb-2">Procesando...</p>
                <p className="text-slate-400 text-sm">{progress}%</p>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg bg-slate-900"
              />
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}
        </div>

        <div className="bg-slate-800 px-4 py-3 border-t border-slate-700 flex gap-2">
          {isCapturing && !error && !isProcessing && (
            <button
              onClick={captureAndOCR}
              className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded font-bold hover:bg-cyan-700 transition-colors flex items-center justify-center gap-2"
            >
              <span>📸</span> Capturar y Leer
            </button>
          )}
          {error && (
            <button
              onClick={() => setError(null)}
              className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded font-bold hover:bg-cyan-700 transition-colors"
            >
              Reintentar
            </button>
          )}
        </div>

        <div className="bg-slate-900/50 px-4 py-3 border-t border-slate-700">
          <p className="text-slate-300 text-xs text-center">
            Apunta a la etiqueta o texto • Asegura buena iluminación
          </p>
        </div>
      </div>
    </div>
  );
};

export default CameraOCRScanner;
