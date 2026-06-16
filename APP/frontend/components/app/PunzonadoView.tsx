/**
 * PunzonadoView — Vista del jefe de sección de PUNZONADO.
 *
 * Punzonado NO tiene estantería propia (sus piezas viven físicamente en la
 * sección de PLEGADORA), así que este jefe no opera ningún grid. Su pantalla
 * son dos herramientas:
 *   1. 📐 Contar piezas (función principal): conteo por foto con Claude visión.
 *   2. 🔍 Buscador de artículos global: el mismo que tienen todos los usuarios,
 *      para localizar en qué estantería/posición está cualquier artículo.
 */

import React, { useState, lazy, Suspense } from 'react';
import { useAuth } from '../../hooks/useAuth';
import KioskSearchBar from '../kiosk/KioskSearchBar';

const ChaperoView = lazy(() => import('../chapero/ChaperoView'));

const PunzonadoView: React.FC<{ chatButton?: React.ReactNode }> = ({ chatButton }) => {
  const { displayName, operarioId, logout } = useAuth();
  const [showChapero, setShowChapero] = useState(false);

  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">🛠️</span>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none truncate">Punzonado</h1>
              <p className="text-[10px] text-slate-500 truncate leading-none mt-0.5">{displayName} · {operarioId}</p>
            </div>
          </div>
          {chatButton}
          <button
            onClick={logout}
            className="px-2 py-1 text-[11px] font-bold bg-slate-100 text-slate-700 rounded-lg whitespace-nowrap flex-shrink-0">
            Salir
          </button>
        </div>
      </header>

      {/* Cuerpo */}
      <main className="flex-1 min-h-0 w-full overflow-y-auto">
        {/* Buscador de artículos global */}
        <div className="px-1">
          <p className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
            Buscar artículo en la nave
          </p>
          <KioskSearchBar
            locations={[]}
            onHighlight={() => {}}
            global
            currentShelfCode=""
            placeholder="Buscar artículo o número de OF..."
          />
        </div>

        {/* Chapero */}
        <div className="p-4">
          <button
            onClick={() => setShowChapero(true)}
            className="w-full rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-[0.99] transition-all text-white shadow-lg p-5 flex flex-col items-center gap-2"
          >
            <span className="text-4xl">🔩</span>
            <span className="text-lg font-black">Chapero</span>
            <span className="text-xs font-medium text-slate-300">Ver y gestionar chapas por material y espesor</span>
          </button>
        </div>
      </main>

      {showChapero && (
        <div className="fixed inset-0 z-50">
          <Suspense fallback={<div className="flex items-center justify-center h-full bg-slate-50 text-slate-500">Cargando chapero…</div>}>
            <ChaperoView onClose={() => setShowChapero(false)} />
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default PunzonadoView;
