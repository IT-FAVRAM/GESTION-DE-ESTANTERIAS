import React from 'react';

const AppLoadingScreen: React.FC = () => (
  <div className="min-h-dvh flex flex-col items-center justify-center bg-slate-950">
    <div className="relative">
      <div className="w-20 h-20 border-4 border-cyan-500/20 rounded-full" />
      <div className="absolute inset-0 w-20 h-20 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
    <h2 className="mt-6 text-xl font-black text-white tracking-tight">GESTOR ESTANTERIAS</h2>
    <p className="mt-2 text-slate-500 text-sm animate-pulse">Cargando...</p>
  </div>
);

export default AppLoadingScreen;


