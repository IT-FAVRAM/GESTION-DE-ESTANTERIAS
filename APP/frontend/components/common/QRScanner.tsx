/**
 * QRScanner — Lee QR codes que contienen ARTICULO | OF
 *
 * Formato esperado del QR:
 * "27894-05 | OF26-05315"
 *
 * Extrae y devuelve:
 * { articleCode: "27894-05", orderFab: "OF26-05315" }
 */

import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import type { ScanParseResult } from '../../lib/qrParser';

interface QRScannerProps {
  active: boolean;
  disabled: boolean;
  onScan: (result: ScanParseResult) => void;
  onClose?: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({
  active,
  disabled,
  onScan,
  onClose,
}) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Inicializar scanner cuando se activa
  useEffect(() => {
    if (!active) {
      // Detener scanner cuando se desactiva
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    // Iniciar scanner
    const scanner = new Html5QrcodeScanner(
      'qr-scanner-container',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      /* verbose= */ false
    );

    const handleScanSuccess = (decodedText: string) => {
      console.log(`[QRScanner] QR detectado: ${decodedText}`);

      // Evitar duplicados en el mismo segundo
      if (lastScan === decodedText) {
        return;
      }

      setLastScan(decodedText);
      setError(null);

      try {
        // Parsear formato: "ARTICULO | OF"
        const parts = decodedText.split('|').map((p) => p.trim());

        if (parts.length !== 2) {
          throw new Error('Formato inválido. Esperado: "ARTICULO | OF"');
        }

        const [articleCode, orderFab] = parts;

        // Validar que orderFab tiene formato correcto (OF26-XXXXX)
        if (!orderFab.match(/^OF26-\d{5}$/)) {
          throw new Error(`OF inválida: ${orderFab}. Esperado: OF26-XXXXX`);
        }

        // Validar que articleCode no está vacío
        if (!articleCode) {
          throw new Error('Artículo vacío');
        }

        console.log(`[QRScanner] ✓ Parseado: Articulo=${articleCode}, OF=${orderFab}`);

        // Detener scanner y procesar
        if (scannerRef.current) {
          scannerRef.current.clear().catch(() => {});
        }

        setScanning(false);

        // Enviar resultado al componente padre
        onScan({
          success: true,
          data: {
            articleCode: articleCode,
            orderFab: orderFab,
          },
        });
      } catch (err: any) {
        console.error('[QRScanner] Error parseando QR:', err.message);
        setError(err.message);
      }
    };

    const handleScanError = (error: any) => {
      // Ignorar errores de lectura (son normales mientras busca QR)
      // Solo loguear si es un error real
      if (error && error.message && !error.message.includes('NotFoundException')) {
        console.warn('[QRScanner] Error:', error.message);
      }
    };

    try {
      scanner.render(handleScanSuccess, handleScanError);
      scannerRef.current = scanner;
      setScanning(true);
      console.log('[QRScanner] Scanner iniciado');
    } catch (err: any) {
      console.error('[QRScanner] Error iniciando scanner:', err);
      setError('No se pudo iniciar cámara. Verifica permisos.');
      setScanning(false);
    }

    // Cleanup
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [active, lastScan, onScan]);

  if (!active) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50">
      <div className="px-4 py-4 space-y-3">
        {/* Barra informativa */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <p className="text-xs text-blue-900 font-bold">📱 Apunta el QR a la cámara</p>
          <p className="text-xs text-blue-700 mt-1">Formato: ARTICULO | OF26-XXXXX</p>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-xs text-red-700 font-bold">❌ {error}</p>
          </div>
        )}

        {/* Scanner */}
        <div className="bg-slate-900 rounded-lg overflow-hidden">
          <div
            id="qr-scanner-container"
            className="w-full"
            style={{ minHeight: '400px' }}
          />
        </div>

        {/* Status */}
        {scanning && (
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
            <p className="text-xs text-cyan-700">
              🔍 Buscando código QR...
            </p>
          </div>
        )}

        {/* Botón cerrar */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (scannerRef.current) {
                scannerRef.current.clear().catch(() => {});
                scannerRef.current = null;
              }
              setScanning(false);
              setError(null);
              setLastScan(null);
              onClose?.();
            }}
            disabled={disabled}
            className="w-full px-3 py-2 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold disabled:opacity-50 transition-colors"
          >
            ✕ Cerrar Scanner
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
