import React from 'react';

interface BlockedDeviceScreenProps {
  deviceId: string;
  error?: string | null;
  onCopyDeviceId: () => void;
  onAdminLogin: () => void;
}

const BlockedDeviceScreen: React.FC<BlockedDeviceScreenProps> = ({ deviceId, error, onCopyDeviceId, onAdminLogin }) => (
  <div className="min-h-dvh flex flex-col items-center justify-center bg-slate-950 px-6 text-center">
    <div className="max-w-md rounded-3xl border border-amber-500/20 bg-amber-500/10 p-8">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-4xl">⚠</div>
      <h1 className="text-2xl font-black text-white">Dispositivo bloqueado</h1>
      <p className="mt-3 text-sm text-slate-300">{error || 'Este dispositivo necesita configuracion previa en SuperAdmin antes de poder operar.'}</p>
      <p className="mt-4 text-xs text-slate-500">ID del navegador: <span className="font-mono">{deviceId}</span></p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button type="button" onClick={onCopyDeviceId} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-800">Copiar ID</button>
        <button type="button" onClick={onAdminLogin} className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-cyan-500">Entrar como admin</button>
      </div>
      <p className="mt-4 text-xs text-slate-500">Sin dispositivos fisicos: registra este navegador desde SuperAdmin y luego vuelve aqui.</p>
    </div>
  </div>
);

export default BlockedDeviceScreen;


