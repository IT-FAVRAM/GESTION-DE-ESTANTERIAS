/**
 * DeviceInfoModal — Muestra información del dispositivo (Device ID)
 * Para asociar tablets a kioscos
 */

import React, { useState } from 'react';

interface DeviceInfoModalProps {
  deviceId: string;
  onClose: () => void;
}

const DeviceInfoModal: React.FC<DeviceInfoModalProps> = ({ deviceId, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyDeviceId = () => {
    navigator.clipboard.writeText(deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 max-w-md w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>ℹ️</span> Información del Dispositivo
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Device ID Box */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
              Device ID (copia esto)
            </p>
            <p className="text-lg font-mono text-cyan-400 break-all mb-3">
              {deviceId}
            </p>
            <button
              onClick={handleCopyDeviceId}
              className={`w-full py-2 rounded font-bold transition-all ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-cyan-600 text-white hover:bg-cyan-700'
              }`}
            >
              {copied ? '✅ Copiado' : '📋 Copiar Device ID'}
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-300 mb-3 font-bold">📝 Para asociar esta tablet a un kiosko:</p>
            <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside">
              <li>Copia el Device ID (botón de arriba)</li>
              <li>Ve a Firebase Console</li>
              <li>Abre colección <code className="bg-slate-900 px-2 py-1 rounded">devices</code></li>
              <li>Busca documento con este ID</li>
              <li>Agrega campo: <code className="bg-slate-900 px-2 py-1 rounded">kioskId</code></li>
              <li>Escribe: <code className="bg-slate-900 px-2 py-1 rounded">kiosko-mecanizado</code></li>
              <li>¡Recarga la app!</li>
            </ol>
          </div>

          {/* QR Info */}
          <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/50">
            <p className="text-xs text-blue-300">
              💡 <strong>Tip:</strong> Si necesitas ayuda, muestra este Device ID al administrador.
            </p>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full mt-6 py-2 bg-slate-700 text-white rounded font-bold hover:bg-slate-600 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default DeviceInfoModal;


