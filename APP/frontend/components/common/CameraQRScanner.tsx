/**
 * CameraQRScanner — Escáner de códigos de barras y QR con cámara
 * Gestor de Estanterías WMS v3.0
 *
 * Full-screen, animaciones de escaneo, soporte de linterna, feedback visual instantáneo.
 * Usa Html5Qrcode + BarcodeDetector nativo cuando está disponible.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Flashlight, FlashlightOff } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface CameraQRScannerProps {
  onScan: (qrCode: string) => void;
  onError?: (error: string) => void;
  onClose: () => void;
}

const SCANNER_ID = 'cqr-scanner-v2';

// Intenta activar/desactivar la linterna del dispositivo
async function toggleTorch(on: boolean): Promise<boolean> {
  try {
    const videoEl = document.querySelector(`#${SCANNER_ID} video`) as HTMLVideoElement | null;
    const stream = videoEl?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    if (!track) return false;
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}

const CameraQRScanner: React.FC<CameraQRScannerProps> = ({ onScan, onError, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [state, setState] = useState<'starting' | 'scanning' | 'success' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = useRef(false);

  const cleanup = useCallback(async () => {
    closedRef.current = true;
    if (successTimer.current) clearTimeout(successTimer.current);
    const s = scannerRef.current;
    if (s) {
      try {
        if (s.isScanning) await s.stop().catch(() => {});
        s.clear();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    cleanup().then(onClose);
  }, [cleanup, onClose]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const scanner = new Html5Qrcode(SCANNER_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.ITF,
          ],
          verbose: false,
        });
        scannerRef.current = scanner;

        // Caja de escaneo: rectangular para códigos 1D, proporcional a la pantalla
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const boxW = Math.min(vw * 0.85, 420);
        const boxH = Math.round(boxW * 0.35); // ~35% altura — ideal para códigos 1D

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 30, qrbox: { width: boxW, height: boxH }, disableFlip: false },
          (decoded) => {
            if (cancelled || closedRef.current) return;
            scanner.pause(true);
            setSuccessCode(decoded);
            setState('success');
            if (successTimer.current) clearTimeout(successTimer.current);
            successTimer.current = setTimeout(() => {
              if (!cancelled) {
                cleanup().then(() => onScan(decoded));
              }
            }, 700);
          },
          undefined,
        );

        if (!cancelled) {
          setState('scanning');
          // Comprobar si la linterna está disponible
          setTimeout(async () => {
            if (cancelled) return;
            const videoEl = document.querySelector(`#${SCANNER_ID} video`) as HTMLVideoElement | null;
            const stream = videoEl?.srcObject as MediaStream | null;
            const track = stream?.getVideoTracks()[0];
            if (track) {
              const caps = track.getCapabilities?.() as Record<string, unknown> | undefined;
              if (caps && 'torch' in caps) setTorchAvailable(true);
            }
          }, 800);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Error al inicializar cámara';
        const friendly = msg.toLowerCase().includes('notallowed') || msg.toLowerCase().includes('permission')
          ? 'Cámara no permitida. Activa el acceso en los ajustes del navegador.'
          : msg.toLowerCase().includes('notfound')
          ? 'No se encontró cámara trasera en este dispositivo.'
          : 'Error al iniciar cámara. Comprueba los permisos.';
        setErrorMsg(friendly);
        setState('error');
        onError?.(friendly);
      }
    };

    init();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTorch = useCallback(async () => {
    const next = !torchOn;
    const ok = await toggleTorch(next);
    if (ok) setTorchOn(next);
  }, [torchOn]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-safe-top py-3 bg-black/80">
        <div>
          {state === 'scanning' && (
            <p className="text-cyan-400 text-sm font-bold flex items-center gap-2">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              Apunta al código de barras
            </p>
          )}
          {state === 'starting' && (
            <p className="text-slate-400 text-sm">Iniciando cámara...</p>
          )}
          {state === 'success' && (
            <p className="text-emerald-400 text-sm font-bold flex items-center gap-2">
              Código detectado
            </p>
          )}
        </div>
        <button
          onClick={handleClose}
          className="w-9 h-9 rounded-full bg-rose-500/20 flex items-center justify-center text-white hover:bg-rose-500/30 transition-colors text-xl"
        >
          ×
        </button>
      </div>

      {/* Scanner area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Html5Qrcode container — fills the space, library injects video here */}
        <div
          id={SCANNER_ID}
          className="w-full h-full"
          style={{ minHeight: 200 }}
        />

        {/* Dark vignette overlay + corner frame */}
        {state !== 'error' && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {/* Animated scanner frame drawn with SVG */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox={`0 0 ${window.innerWidth} ${window.innerHeight - 120}`}
              preserveAspectRatio="none"
            >
              {(() => {
                const vw = window.innerWidth;
                const vh = Math.max(window.innerHeight - 120, 200);
                const bw = Math.min(vw * 0.85, 420);
                const bh = Math.round(bw * 0.35);
                const cx = vw / 2;
                const cy = vh / 2;
                const x = cx - bw / 2;
                const y = cy - bh / 2;
                const r = 8;
                const arm = 28;
                return (
                  <>
                    {/* Dark mask outside scan zone */}
                    <path
                      fillRule="evenodd"
                      fill="rgba(0,0,0,0.65)"
                      d={`M0 0 H${vw} V${vh} H0 Z M${x + r} ${y} H${x + bw - r} Q${x + bw} ${y} ${x + bw} ${y + r} V${y + bh - r} Q${x + bw} ${y + bh} ${x + bw - r} ${y + bh} H${x + r} Q${x} ${y + bh} ${x} ${y + bh - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`}
                    />
                    {/* Corner brackets */}
                    {state === 'success' ? (
                      <rect x={x} y={y} width={bw} height={bh} rx={r} fill="none" stroke="#22c55e" strokeWidth="2.5" />
                    ) : (
                      <>
                        {/* TL */}
                        <path d={`M${x + r + arm} ${y} H${x + r} Q${x} ${y} ${x} ${y + r} V${y + r + arm}`} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                        {/* TR */}
                        <path d={`M${x + bw - r - arm} ${y} H${x + bw - r} Q${x + bw} ${y} ${x + bw} ${y + r} V${y + r + arm}`} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                        {/* BL */}
                        <path d={`M${x + r + arm} ${y + bh} H${x + r} Q${x} ${y + bh} ${x} ${y + bh - r} V${y + bh - r - arm}`} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                        {/* BR */}
                        <path d={`M${x + bw - r - arm} ${y + bh} H${x + bw - r} Q${x + bw} ${y + bh} ${x + bw} ${y + bh - r} V${y + bh - r - arm}`} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                      </>
                    )}
                    {/* Animated scan line */}
                    {state === 'scanning' && (
                      <line x1={x + 8} x2={x + bw - 8} y1={cy} y2={cy} stroke="#22d3ee" strokeWidth="1.5" opacity="0.7">
                        <animate attributeName="y1" values={`${y + 6};${y + bh - 6};${y + 6}`} dur="2s" repeatCount="indefinite" />
                        <animate attributeName="y2" values={`${y + 6};${y + bh - 6};${y + 6}`} dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.7;0.3;0.7" dur="2s" repeatCount="indefinite" />
                      </line>
                    )}
                    {/* Success checkmark */}
                    {state === 'success' && (
                      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="32" fill="#22c55e">✓</text>
                    )}
                  </>
                );
              })()}
            </svg>
          </div>
        )}

        {/* Starting spinner overlay */}
        {state === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
            <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Error overlay */}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 p-6">
            <p className="text-red-400 font-bold text-lg mb-2 text-center">Sin acceso a la cámara</p>
            <p className="text-slate-400 text-sm text-center mb-6">{errorMsg}</p>
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-500"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex-shrink-0 pb-safe-bottom px-6 py-4 bg-black/80 flex items-center justify-between gap-4">
        {/* Torch button */}
        <button
          onClick={handleTorch}
          disabled={!torchAvailable || state !== 'scanning'}
          className={`
            w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all
            ${torchAvailable && state === 'scanning'
              ? torchOn
                ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/40'
                : 'bg-white/10 text-white hover:bg-white/20'
              : 'bg-white/5 text-white/20 cursor-not-allowed'}
          `}
          title={torchOn ? 'Apagar linterna' : 'Encender linterna'}
        >
          {torchOn ? <FlashlightOff className="w-6 h-6" aria-hidden /> : <Flashlight className="w-6 h-6" aria-hidden />}
        </button>

        {/* Hint text */}
        <p className="flex-1 text-center text-slate-400 text-xs">
          Code128 · EAN · QR · DataMatrix
        </p>

        {/* Cancel */}
        <button
          onClick={handleClose}
          className="w-14 h-14 rounded-full bg-rose-500/20 flex items-center justify-center text-white hover:bg-rose-500/30 transition-colors font-bold text-sm"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default CameraQRScanner;


