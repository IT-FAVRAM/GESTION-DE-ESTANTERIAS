import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface CameraQRScannerProps {
  onScan: (qrCode: string) => void;
  onError?: (error: string) => void;
  onClose: () => void;
}

const SCANNER_ID = 'cqr-reader';

const CameraQRScanner: React.FC<CameraQRScannerProps> = ({ onScan, onError, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const scanner = new Html5Qrcode(SCANNER_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
          verbose: false,
        });
        scannerRef.current = scanner;

        const boxW = Math.min(window.innerWidth * 0.82, 340);
        const boxH = Math.round(boxW * 0.38); // rectangular: optimized for 1D barcodes

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 20, qrbox: { width: boxW, height: boxH }, disableFlip: false },
          (decodedText) => {
            if (cancelled) return;
            scanner.pause();
            onScan(decodedText);
          },
          undefined
        );

        if (!cancelled) setIsScanning(true);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Error al inicializar cámara';
        const friendlyMsg =
          msg.toLowerCase().includes('notallowed') || msg.toLowerCase().includes('permission')
            ? 'Acceso a cámara denegado. Permite el acceso en los ajustes del navegador.'
            : msg.toLowerCase().includes('notfound')
            ? 'No se encontró cámara trasera en este dispositivo.'
            : `Error al iniciar cámara: ${msg}`;
        setError(friendlyMsg);
        onError?.(friendlyMsg);
      }
    };

    init();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        try {
          if (s.isScanning) {
            s.stop().then(() => s.clear()).catch(() => {});
          } else {
            s.clear();
          }
        } catch {
          // ignore cleanup errors
        }
        scannerRef.current = null;
      }
    };
  }, [onScan, onError]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
          <h3 className="font-bold text-white flex items-center gap-2">
            <span className="text-lg">📷</span>
            Escanear código de barras
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="bg-black p-4 relative">
          {/* Scanner siempre en DOM para que Html5Qrcode pueda inyectar el video */}
          <div
            id={SCANNER_ID}
            className="bg-slate-900 rounded-lg overflow-hidden"
            style={{ width: '100%', maxWidth: '400px', margin: '0 auto', display: error ? 'none' : 'block' }}
          />
          {error && (
            <div className="py-8 px-4 flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-400 text-3xl mb-3">❌</p>
                <p className="text-red-400 font-bold mb-2">Error de cámara</p>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-800 px-4 py-3 text-center border-t border-slate-700">
          {isScanning && !error ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
              <p className="text-cyan-400 text-sm font-medium">Cámara activa — apunta al código</p>
            </div>
          ) : !error ? (
            <p className="text-slate-400 text-sm">Iniciando cámara...</p>
          ) : null}
        </div>

        <div className="bg-slate-900/50 px-4 py-3 border-t border-slate-700">
          <p className="text-slate-300 text-xs text-center">
            Code128 · EAN · QR · DataMatrix • Mantén el código centrado y bien iluminado
          </p>
        </div>
      </div>
    </div>
  );
};

export default CameraQRScanner;
