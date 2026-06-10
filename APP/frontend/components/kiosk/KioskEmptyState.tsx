import React from 'react';
import { useAuth } from '../../hooks/useAuth';

const KioskEmptyState: React.FC = () => {
  const { logout } = useAuth();

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-950 px-6 text-center">
      <div className="max-w-md rounded-3xl border border-amber-500/20 bg-slate-900 p-8 flex flex-col items-center gap-6">
        <div className="text-5xl">⚠️</div>
        <div>
          <h2 className="text-2xl font-black text-white">Kiosko sin estanteria</h2>
          <p className="mt-3 text-sm text-slate-400">Este dispositivo no tiene una estanteria asignada. Contacte con SuperAdmin antes de operar.</p>
        </div>
        <button
          onClick={logout}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
        >
          Cerrar Sesión / Volver al Login
        </button>
      </div>
    </div>
  );
};

export default KioskEmptyState;


