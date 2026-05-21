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
    <div className="h-dvh bg-sky-50 flex flex-col overflow-hidden">
      <header className="flex-shrink-0 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">Calidad</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">{shelfDef?.name || 'Estanteria Calidad'}</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}{displayName ? ` · ${displayName}` : ''}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-sky-50 px-4 py-3 text-right">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Huecos</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{totalOccupied} ocupados · {totalEmpty} libres</p>
              <p className="text-xs text-slate-500">{totalArticles} articulos visibles</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100"
            >
              Cerrar sesion
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-7xl p-4 md:p-6">
          <div className="rounded-[2rem] border border-slate-800/90 bg-slate-950/45 p-3 shadow-[0_24px_60px_rgba(2,6,23,0.45)] md:p-4">
            <ShelfGrid
              locations={locations}
              shelfDef={shelfDef}
              onCellPress={(location) => {
                if (!location.isEmpty) setSelectedCell(location);
              }}
            />
          </div>
        </div>
      </main>

      <KioskCellDetailDrawer selectedCell={selectedCell} onClose={() => setSelectedCell(null)} />
    </div>
  );
};

export default QualityShelfView;
