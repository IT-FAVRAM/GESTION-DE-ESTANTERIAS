
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { CloseIcon, ErrorIcon } from './Icons';

interface LocationScannerProps {
  itemBarcode: string;
  onScan: (decodedText: string) => void;
  onClose: () => void;
  errorMessage: string | null;
}

const LocationScanner: React.FC<LocationScannerProps> = ({ itemBarcode, onScan, onClose, errorMessage }) => {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!scannerRef.current) return;

    const html5QrCode = new Html5Qrcode(scannerRef.current.id);
    html5QrCodeRef.current = html5QrCode;

    const qrCodeSuccessCallback = (decodedText: string) => {
      if (html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
        setScanSuccess(true); 
        onScan(decodedText);
        setTimeout(() => setScanSuccess(false), 500);
      }
    };

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      rememberLastUsedCamera: true,
      supportedScanTypes: [],
    };
    
    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback, undefined)
      .catch(err => {
        console.error("Unable to start scanning.", err);
        if ((err as Error).name === 'NotAllowedError') {
             setCameraError("Permiso de cámara denegado. Para escanear, necesita permitir el acceso a la cámara en los ajustes de su navegador. Busque el ícono de candado (🔒) en la barra de direcciones.");
        } else {
             setCameraError("No se pudo iniciar la cámara. Verifique que no esté siendo usada por otra aplicación y recargue la página.");
        }
      });

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(err => {
          console.error("Failed to stop scanner", err);
        });
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-slate-900 rounded-lg shadow-xl p-4 border border-slate-800">
        <button onClick={onClose} className="absolute top-2 right-2 p-2 text-slate-400 hover:text-white">
          <CloseIcon className="h-6 w-6" />
        </button>
        <h2 className="text-lg font-bold text-center mb-1">Escanear QR de Ubicación</h2>
        <p className="text-sm text-slate-400 text-center mb-2">Asignando artículo: <span className="font-mono text-cyan-400">{itemBarcode}</span></p>
        
        {cameraError ? (
          <div className="text-red-400 flex flex-col items-center justify-center h-64 text-center">
             <ErrorIcon className="h-12 w-12 mb-4"/>
            <p className="font-semibold">Error de Cámara</p>
            <p className="text-sm text-slate-400">{cameraError}</p>
          </div>
        ) : (
          <div className="relative w-full aspect-square overflow-hidden rounded-lg">
            <div id="qr-location-reader" ref={scannerRef} className="w-full h-full"></div>
            <div className={`absolute inset-0 border-8 transition-colors duration-300 ${errorMessage ? 'border-red-500' : (scanSuccess ? 'border-green-500' : 'border-transparent')} pointer-events-none`}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] border-2 border-dashed border-white/50"></div>
            </div>
            {errorMessage && (
                <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-900/90 text-white text-center rounded-md text-sm font-semibold border border-red-700">
                    {errorMessage}
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationScanner;
