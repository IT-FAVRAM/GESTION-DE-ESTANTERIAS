
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { CloseIcon, ErrorIcon, FlashIcon, CheckIcon, InfoIcon, CameraIcon, ScannerIcon } from './Icons';

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
  
  // State
  const [isContinuous, setIsContinuous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<{ title: string, subtitle?: string } | null>(null);
  
  // Refs for cooldown management to prevent re-renders
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);

  const triggerHaptic = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

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
      triggerHaptic([50, 50, 50]); 
      setFeedbackMessage({ title: validation.message || 'Error', subtitle: validation.details || 'Código Inválido' });
    } else if (validation.type === 'warning') {
        setScanStatus('warning');
        triggerHaptic(100);
        setFeedbackMessage({ title: validation.message || 'Aviso', subtitle: validation.details });
    } else {
      setScanStatus('success');
      triggerHaptic(50); 
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

  }, [isContinuous, onScan, onClose, onValidate, instruction]);

  useEffect(() => {
    if (!scannerRef.current) return;
    if (html5QrCodeRef.current) return;

    const html5QrCode = new Html5Qrcode(scannerRef.current.id);
    html5QrCodeRef.current = html5QrCode;

    // Calculate optimal box size based on window
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.7;

    const config = {
      fps: 15, 
      qrbox: { width: size, height: size * 0.6 }, // Rectangular for barcodes
      aspectRatio: 1.0,
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
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Top Bar */}
      <div className="relative z-20 p-4 flex justify-between items-center bg-black/40 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-3">
            <ScannerIcon className="h-6 w-6 text-cyan-400 animate-pulse" />
            <span className="text-white font-bold tracking-wider text-sm">SCANNER PRO</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
          <CloseIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Main Camera Area */}
      <div className="flex-grow relative flex items-center justify-center overflow-hidden bg-black">
        {error ? (
          <div className="text-red-400 flex flex-col items-center justify-center p-8 text-center z-30">
             <ErrorIcon className="h-16 w-16 mb-4"/>
            <p className="font-bold text-xl mb-2">Error de Cámara</p>
            <p className="text-slate-400">{error}</p>
            <button onClick={onClose} className="mt-6 px-6 py-2 bg-slate-800 rounded-lg text-white">Cerrar</button>
          </div>
        ) : (
            <>
                <div id="scanner-container" ref={scannerRef} className="w-full h-full object-cover opacity-80"></div>
                
                {/* Dark Overlay with Cutout */}
                <div className="absolute inset-0 border-[50px] md:border-[100px] border-black/60 z-10 pointer-events-none transition-all duration-300"
                     style={{ borderColor: scanStatus === 'success' ? 'rgba(34, 197, 94, 0.2)' : scanStatus === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.6)' }}>
                </div>

                {/* Instruction Banner */}
                <div className="absolute top-24 left-0 right-0 flex justify-center z-20">
                    <div className="bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full border border-white/20 shadow-lg flex items-center gap-3">
                        <InfoIcon className="h-5 w-5 text-cyan-400" />
                        <p className="font-bold text-lg">{instruction || "Enfoque el código"}</p>
                    </div>
                </div>

                {/* Scanning Frame & Laser */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[40%] z-20 pointer-events-none">
                    {/* Corners */}
                    <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 transition-colors duration-300 ${scanStatus === 'success' ? 'border-green-500' : 'border-cyan-500'}`}></div>
                    <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 transition-colors duration-300 ${scanStatus === 'success' ? 'border-green-500' : 'border-cyan-500'}`}></div>
                    <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 transition-colors duration-300 ${scanStatus === 'success' ? 'border-green-500' : 'border-cyan-500'}`}></div>
                    <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 transition-colors duration-300 ${scanStatus === 'success' ? 'border-green-500' : 'border-cyan-500'}`}></div>
                    
                    {/* Laser Line */}
                    {scanStatus === 'idle' && (
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-scan-laser"></div>
                    )}
                </div>

                {/* Feedback Message */}
                {feedbackMessage && (
                    <div className={`absolute bottom-32 left-1/2 -translate-x-1/2 w-[90%] max-w-sm p-4 rounded-xl backdrop-blur-md border shadow-2xl animate-bounce-in z-30
                        ${scanStatus === 'success' ? 'bg-green-900/90 border-green-500' : 
                          scanStatus === 'warning' ? 'bg-slate-900/90 border-yellow-500' :
                          'bg-red-900/90 border-red-500'
                        }
                    `}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${scanStatus === 'success' ? 'bg-green-500' : scanStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                {scanStatus === 'success' ? <CheckIcon className="h-6 w-6 text-white" /> : 
                                 scanStatus === 'warning' ? <InfoIcon className="h-6 w-6 text-black" /> :
                                 <ErrorIcon className="h-6 w-6 text-white" />}
                            </div>
                            <div>
                                <p className="text-white font-bold text-lg leading-tight">{feedbackMessage.title}</p>
                                {feedbackMessage.subtitle && (
                                    <p className="text-white/80 text-sm mt-0.5 font-mono">{feedbackMessage.subtitle}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                
                {onPhotoRequest && (
                    <button
                        onClick={onPhotoRequest}
                        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-bold rounded-full shadow-lg border border-purple-400 hover:bg-purple-500 active:scale-95 transition-all z-30"
                    >
                        <CameraIcon className="h-5 w-5" />
                        <span>Foto IA</span>
                    </button>
                )}
            </>
        )}
      </div>
      <style>{`
        @keyframes scan-laser { 
            0% { top: 0%; opacity: 0.8; } 
            50% { top: 100%; opacity: 0.8; } 
            100% { top: 0%; opacity: 0.8; } 
        }
        .animate-scan-laser { animation: scan-laser 3s linear infinite; }
        @keyframes bounce-in { 0% { transform: translate(-50%, 20px); opacity: 0; } 100% { transform: translate(-50%, 0); opacity: 1; } }
        .animate-bounce-in { animation: bounce-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Scanner;
