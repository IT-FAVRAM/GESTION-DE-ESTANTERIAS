/**
 * CameraQRScanner — Escaneo de QR por cámara del móvil
 * Compatible con Jefe de Sección, Admin, Carretillero
 * Versión mejorada con mejor soporte para móvil y HTTPS
 */

import React, { useEffect, useRef, useState } from 'react';

interface CameraQRScannerProps {
  onScan: (qrCode: string) => void;
  onError?: (error: string) => void;
  onClose: () => void;
}

const CameraQRScanner: React.FC<CameraQRScannerProps> = ({ onScan, onError, onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionRequested, setPermissionRequested] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode');
        if (cancelled) return;

        const config = {
          fps: 20,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          facingMode: 'environment',
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          zoom: { min: 1, max: 4, step: 1 },
          disableFlip: false,
        };

        const scanner = new Html5QrcodeScanner('qr-reader', config, false);

        const onScanSuccess = (decodedText: string) => {
          try {
            scanner.pause();
            onScan(decodedText);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Error al procesar QR';
            setError(errorMsg);
            onError?.(errorMsg);
          }
        };

        const onScanError = (error: string) => {
          console.debug('[QRScanner] Scan error (normal):', error);
        };

        try {
          await scanner.render(onScanSuccess, onScanError);
          scannerRef.current = scanner;
          setPermissionRequested(true);
          if (!cancelled) {
            setIsScanning(true);
            setError(null);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Error al inicializar cámara';
          console.error('[QRScanner] Init error:', errorMsg);
          if (!cancelled) {
            setError(errorMsg);
            onError?.(errorMsg);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error al cargar librería QR';
        console.error('[QRScanner] Import error:', errorMsg);
        if (!cancelled) {
          setError(errorMsg);
          onError?.(errorMsg);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {
          console.warn('[CameraQRScanner] Error stopping scanner:', e);
        }
        scannerRef.current = null;
      }
    };
  }, [onScan, onError]);

  const handleRetry = async () => {
    setError(null);

    if (scannerRef.current) {
      try {
        await scannerRef.current.resume();
        setIsScanning(true);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error al reanudar cámara';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
          <h3 className="font-bold text-white flex items-center gap-2">
            <span className="text-lg">📷</span>
            Escanear QR
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
                <p className="text-red-300 text-sm mb-4">{error}</p>
                {permissionRequested && (
                  <p className="text-red-200 text-xs mb-2">
                    Verifica que hayas permitido acceso a la cámara
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div
              id="qr-reader"
              className="bg-slate-900 rounded-lg overflow-hidden"
              style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}
            />
          )}
        </div>

        <div className="bg-slate-800 px-4 py-3 text-center border-t border-slate-700">
          {isScanning && !error && (
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
              <p className="text-cyan-400 text-sm font-medium">Cámara activa...</p>
            </div>
          )}
          {error && (
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-cyan-600 text-white rounded font-bold hover:bg-cyan-700 transition-colors"
            >
              Reintentar
            </button>
          )}
        </div>

        <div className="bg-slate-900/50 px-4 py-3 border-t border-slate-700">
          <p className="text-slate-300 text-xs text-center">
            Apunta la cámara al código QR • Asegúrate de buena iluminación
          </p>
        </div>
      </div>
    </div>
  );
};

export default CameraQRScanner;
