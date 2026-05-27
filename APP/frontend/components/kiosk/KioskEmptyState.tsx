import React from 'react';

const KioskEmptyState: React.FC = () => (
  <div className="min-h-dvh flex items-center justify-center bg-slate-950 px-6 text-center">
    <div className="max-w-md rounded-3xl border border-amber-500/20 bg-slate-900 p-8">
      <div className="text-5xl">⚠️</div>
      <h2 className="mt-4 text-2xl font-black text-white">Kiosko sin estanteria</h2>
      <p className="mt-3 text-sm text-slate-400">Este dispositivo no tiene una estanteria asignada. Contacte con SuperAdmin antes de operar.</p>
    </div>
  </div>
);

export default KioskEmptyState;


