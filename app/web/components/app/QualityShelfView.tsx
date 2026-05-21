import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useShelf, type ShelfLocationState } from '../../hooks/useShelf';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskCellDetailDrawer from '../kiosk/KioskCellDetailDrawer';

const QualityShelfView: React.FC = () => {
  const { assignedShelf, displayName, logout } = useAuth();
  const shelfCode = assignedShelf || 'CAL';
  const { locations, loading, shelfDef, totalArticles, totalOccupied, totalEmpty } = useShelf(shelfCode);
  const [selectedCell, setSelectedCell] = useState<ShelfLocationState | null>(null);

  const subtitle = useMemo(() => {
    if (!shelfDef) return 'Visual de calidad';
    return `Visual de ${shelfDef.name}`;
  }, [shelfDef]);

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-slate-950">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-400 font-medium">Cargando estanteria...</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(8,145,178,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#020617_100%)]">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300/70">Calidad</p>
            <h1 className="mt-1 text-2xl font-black text-white">{shelfDef?.name || 'Estanteria Calidad'}</h1>
            <p className="mt-1 text-sm font-medium text-slate-400">{subtitle}{displayName ? ` · ${displayName}` : ''}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-right">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Huecos</p>
              <p className="mt-1 text-sm font-bold text-white">{totalOccupied} ocupados · {totalEmpty} libres</p>
              <p className="text-xs text-slate-400">{totalArticles} articulos visibles</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-black text-slate-200 transition-colors hover:border-cyan-500/40 hover:text-white"
            >
              Cerrar sesion
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="rounded-[2rem] border border-slate-800/90 bg-slate-950/45 p-3 shadow-[0_24px_60px_rgba(2,6,23,0.45)] md:p-4 overflow-auto [scrollbar-width:thin] [scrollbar-color:rgba(30,41,59,0.8)_transparent]">
          <ShelfGrid
            locations={locations}
            shelfDef={shelfDef}
            onCellPress={(location) => {
              if (!location.isEmpty) setSelectedCell(location);
            }}
          />
        </div>
      </main>

      <KioskCellDetailDrawer selectedCell={selectedCell} onClose={() => setSelectedCell(null)} />
    </div>
  );
};

export default QualityShelfView;
