/**
 * LoginRouter — Pantalla inicial que detecta el modo del dispositivo
 * Gestor de Estanterías WMS v3.0
 * @deprecated Replaced by `UnifiedLogin` in active V3 routing.
 */

import React from 'react';
import { useAuth, type AuthMode } from '../../hooks/useAuth';
import KioskLogin from './KioskLogin';
import CarretilleroLogin from './CarretilleroLogin';
import AdminLogin from './AdminLogin';

const LoginRouter: React.FC = () => {
  const { deviceMode, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-slate-950">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-cyan-500/30 rounded-full" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-6 text-slate-400 font-medium animate-pulse">Cargando aplicación...</p>
      </div>
    );
  }

  switch (deviceMode) {
    case 'kiosk':
      return <KioskLogin />;
    case 'carretillero':
      return <CarretilleroLogin />;
    default:
      return <AdminLogin />;
  }
};

export default LoginRouter;


