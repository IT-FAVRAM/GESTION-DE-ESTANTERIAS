/**
 * KioskoSetupPage — Página de setup automático para registrar kioskos
 *
 * Acceso: /?setup=REPASADO
 * Registra automáticamente el dispositivo y redirecciona a la app
 */

import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { getOrCreateDeviceId } from '../../domain/auth/authStorage';

interface KioskoSetupPageProps {
  section: string;
  onComplete?: () => void;
}

const KioskoSetupPage: React.FC<KioskoSetupPageProps> = ({ section, onComplete }) => {
  const [status, setStatus] = useState<'registering' | 'success' | 'error'>('registering');
  const [message, setMessage] = useState('');
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    const registerKiosk = async () => {
      try {
        const dId = getOrCreateDeviceId();
        setDeviceId(dId);
        setMessage(`Registrando dispositivo: ${dId}`);

        // Llamar Cloud Function para registrar el dispositivo
        const callable = httpsCallable(functions, 'adminOperate');
        const result = await callable({
          op: 'upsertDevice',
          payload: {
            deviceId: dId,
            type: 'KIOSK',
            name: `Kiosko ${section}`,
            assignedShelf: section === 'REPASADO' ? 'REP' : section === 'ZINCADO' ? 'ZIN' : section,
            active: true,
          },
        });

        if ((result.data as any)?.ok) {
          setStatus('success');
          setMessage(`✅ Kiosko ${section} registrado exitosamente`);
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        } else {
          throw new Error('Error en la respuesta del servidor');
        }
      } catch (error: any) {
        setStatus('error');
        setMessage(`❌ Error: ${error.message}`);
      }
    };

    registerKiosk();
  }, [section]);

  return (
    <div className="h-dvh w-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center space-y-6">
          {/* Logo */}
          <div className="text-6xl">
            {status === 'registering' && '⚙️'}
            {status === 'success' && '✅'}
            {status === 'error' && '❌'}
          </div>

          {/* Título */}
          <h1 className="text-3xl font-black text-slate-900">
            {status === 'registering' && 'Configurando Kiosko'}
            {status === 'success' && 'Kiosko Listo'}
            {status === 'error' && 'Error en Setup'}
          </h1>

          {/* Sección */}
          <div className="bg-sky-50 rounded-xl p-4">
            <p className="text-sm text-slate-500">Sección</p>
            <p className="text-2xl font-bold text-sky-600">{section}</p>
          </div>

          {/* Device ID */}
          {deviceId && (
            <div className="bg-slate-50 rounded-xl p-4 break-all">
              <p className="text-xs text-slate-500 mb-1">Device ID</p>
              <p className="font-mono text-sm text-slate-700">{deviceId}</p>
            </div>
          )}

          {/* Mensaje */}
          <p className={`text-sm font-medium ${
            status === 'registering' ? 'text-slate-600 animate-pulse' :
            status === 'success' ? 'text-emerald-600' :
            'text-red-600'
          }`}>
            {message}
          </p>

          {/* Loading spinner */}
          {status === 'registering' && (
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Info */}
          {status === 'success' && (
            <p className="text-xs text-slate-500">Redirigiendo a la aplicación...</p>
          )}

          {status === 'error' && (
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KioskoSetupPage;
