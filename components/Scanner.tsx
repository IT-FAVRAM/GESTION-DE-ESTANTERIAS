
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { CloseIcon, ErrorIcon, FlashIcon, CheckIcon, InfoIcon, CameraIcon, ScannerIcon } from './Icons';
import { useHaptic } from '../hooks/useHaptic';

export type ValidationResult = {
  isValid: boolean;
  message?: string;
  details?: string;
  type: 'success' | 'warning' | 'error' | 'info';
};

interface ScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  onValidate?: (code: string) => ValidationResult;
  onPhotoRequest?: () => void;
  instruction?: string; // New prop for guided flow
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onClose, onValidate, onPhotoRequest, instruction }) => {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const { triggerHaptic } = useHaptic();

  // State
  const [isContinuous, setIsContinuous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<{ title: string, subtitle?: string } | null>(null);

  // Refs for cooldown management to prevent re-renders
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);

  const handleScanSuccess = useCallback((decodedText: string) => {
    const now = Date.now();
    const timeDiff = now - lastScanTimeRef.current;
    const isSameCode = lastScannedCodeRef.current === decodedText;

    if (isProcessingRef.current) return;
    // Faster cooldown for different items
    if (isSameCode && timeDiff < 1500) return;
    if (!isSameCode && timeDiff < 500) return;

    isProcessingRef.current = true;
    lastScanTimeRef.current = now;
    lastScannedCodeRef.current = decodedText;

    let validation: ValidationResult = { isValid: true, type: 'success' };
    if (onValidate) {
      validation = onValidate(decodedText);
    }

    if (!validation.isValid || validation.type === 'error') {
      setScanStatus('error');
      triggerHaptic('error');
      setFeedbackMessage({ title: validation.message || 'Error', subtitle: validation.details || 'Código Inválido' });
    } else if (validation.type === 'warning') {
      setScanStatus('warning');
      triggerHaptic('warning');
      setFeedbackMessage({ title: validation.message || 'Aviso', subtitle: validation.details });
    } else {
      setScanStatus('success');
      triggerHaptic('success');
      setFeedbackMessage({ title: validation.message || decodedText, subtitle: validation.details || 'Detectado' });
    }

    if (validation.isValid) {
      // Small delay to show success state before closing/proceeding
      setTimeout(() => {
        onScan(decodedText);
      }, 300);
    }

    // Reset UI
    setTimeout(() => {
      setScanStatus('idle');
      setFeedbackMessage(null);
      isProcessingRef.current = false;
    }, 1200);

  }, [isContinuous, onScan, onClose, onValidate, instruction, triggerHaptic]);

  useEffect(() => {
    if (!scannerRef.current) return;
    if (html5QrCodeRef.current) return;

    const html5QrCode = new Html5Qrcode(scannerRef.current.id);
    html5QrCodeRef.current = html5QrCode;

    // Full screen calculation
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Use a larger box for easier scanning
    const qrboxSize = Math.min(width, height) * 0.85;

    const config = {
      fps: 30, // Higher FPS for smoother feel
      qrbox: { width: qrboxSize, height: qrboxSize * 0.6 }, // Rectangular for barcodes
      aspectRatio: width / height, // Match screen aspect ratio
      disableFlip: false,
    };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      handleScanSuccess,
      undefined
    ).catch(err => {
      console.error("Scanner start error:", err);
      if ((err as Error).name === 'NotAllowedError') {
        setError("Acceso a cámara denegado.");
      } else {
        setError("Error al iniciar cámara.");
      }
    });

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().then(() => {
          html5QrCodeRef.current?.clear();
        }).catch(err => console.error("Stop error", err));
      }
    };
  }, [handleScanSuccess]);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col h-dvh w-screen touch-none">
      {/* Camera Layer - Absolute Full Screen */}
      <div className="absolute inset-0 z-0 bg-black">
        {!error && <div id="scanner-container" ref={scannerRef} className="w-full h-full object-cover"></div>}
      </div>

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 z-10 flex flex-col justify-between pointer-events-none">

        {/* Top Bar */}
        <div className="p-4 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pointer-events-auto pb-12">
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <ScannerIcon className="h-5 w-5 text-cyan-400 animate-pulse" />
            <span className="text-white font-bold tracking-wider text-sm shadow-sm">SCANNER PRO</span>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/10 hover:bg-white/20 transition-all active:scale-95 shadow-lg"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Center Guide Area */}
        <div className="flex-grow relative flex items-center justify-center">
          {/* The "Hole" visual is handled by CSS/Overlay in libraries usually, we add a guide border here */}
          <div className={`w-[85vw] h-[50vw] md:w-[60vw] md:h-[40vw] max-w-lg border-2 rounded-2xl relative transition-all duration-300
                ${scanStatus === 'success' ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]' :
              scanStatus === 'error' ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' :
                'border-white/50 shadow-[0_0_20px_rgba(0,0,0,0.5)]'}
             `}>
            {/* Laser Scanline */}
            {scanStatus === 'idle' && (
              <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400/80 shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-scan-laser rounded-full"></div>
            )}

            {/* Corners */}
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg"></div>

            {/* Instruction centered below box */}
            <div className="absolute -bottom-16 left-0 right-0 text-center">
              <p className="text-white/90 font-bold text-shadow-md bg-black/30 backdrop-blur-sm inline-block px-4 py-1 rounded-lg border border-white/10">
                {instruction || "Encuadre el código"}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Area */}
        <div className="p-8 pb-12 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center pointer-events-auto min-h-[150px]">
          {error && (
            <div className="text-red-400 flex flex-col items-center justify-center p-4 text-center bg-black/80 rounded-2xl border border-red-500/30 mb-4">
              <ErrorIcon className="h-10 w-10 mb-2" />
              <p className="font-bold text-lg">Error de Cámara</p>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          )}

          {/* AI Photo Button */}
          {onPhotoRequest && !error && (
            <button
              onClick={onPhotoRequest}
              className="flex items-center gap-3 px-8 py-4 bg-white/10 backdrop-blur-md text-white font-bold rounded-2xl border border-white/20 hover:bg-white/20 active:scale-95 transition-all shadow-lg active:shadow-none"
            >
              <div className="p-2 bg-purple-500 rounded-xl shimmer">
                <CameraIcon className="h-6 w-6 text-white" />
              </div>
              <span>Foto IA</span>
            </button>
          )}

          {/* Feedback Toast */}
          {feedbackMessage && (
            <div className={`absolute bottom-32 left-1/2 -translate-x-1/2 w-[90%] max-w-md p-4 rounded-2xl backdrop-blur-xl border shadow-2xl animate-bounce-in flex items-center gap-4 z-50
                    ${scanStatus === 'success' ? 'bg-green-500/20 border-green-400/50' :
                scanStatus === 'warning' ? 'bg-yellow-500/20 border-yellow-400/50' :
                  'bg-red-500/20 border-red-400/50'
              }
                `}>
              <div className={`p-3 rounded-full shadow-lg ${scanStatus === 'success' ? 'bg-green-500' : scanStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`}>
                {scanStatus === 'success' ? <CheckIcon className="h-6 w-6 text-white" /> :
                  scanStatus === 'warning' ? <InfoIcon className="h-6 w-6 text-black" /> :
                    <ErrorIcon className="h-6 w-6 text-white" />}
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-tight drop-shadow-sm">{feedbackMessage.title}</p>
                {feedbackMessage.subtitle && (
                  <p className="text-white/80 text-sm mt-0.5 font-mono drop-shadow-sm">{feedbackMessage.subtitle}</p>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes scan-laser { 
            0% { top: 0%; opacity: 0; } 
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; } 
        }
        .animate-scan-laser { animation: scan-laser 2s ease-in-out infinite; }
        @keyframes bounce-in { 0% { transform: translate(-50%, 20px); opacity: 0; } 100% { transform: translate(-50%, 0); opacity: 1; } }
        .animate-bounce-in { animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .shimmer { text-shadow: 0 0 10px rgba(255,255,255,0.8); box-shadow: 0 0 15px rgba(168, 85, 247, 0.5); }
        #scanner-container video { object-fit: cover !important; width: 100% !important; height: 100% !important; border-radius: 0 !important; }
      `}</style>
    </div>
  );
};

export default Scanner;
