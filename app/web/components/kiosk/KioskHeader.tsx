import React from 'react';

interface KioskHeaderProps {
  shelfName: string;
  shelfCode: string;
  totalOccupied: number;
  totalEmpty: number;
  totalArticles: number;
  displayName: string;
  operarioId: string | null;
  onLogout: () => Promise<void> | void;
}

const KioskHeader: React.FC<KioskHeaderProps> = ({ shelfName, shelfCode, totalOccupied, totalEmpty, totalArticles, displayName, operarioId, onLogout }) => (
  <header className="flex-shrink-0 border-b border-cyan-900/40 bg-slate-950/80 px-4 py-4 backdrop-blur-md">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-2xl shadow-lg shadow-cyan-950/40">🏭</div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-white md:text-2xl">{shelfName || shelfCode}</h1>
            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">Tablet Kiosko</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-black text-cyan-300">{displayName}</p>
          <p className="text-xs text-slate-500">Operario {operarioId}</p>
        </div>
        <button onClick={onLogout} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-300 transition-colors hover:bg-slate-800">Cambiar</button>
      </div>
    </div>
  </header>
);

export default KioskHeader;
