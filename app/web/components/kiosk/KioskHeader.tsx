import React from 'react';

interface KioskHeaderProps {
  shelfName: string;
  shelfCode: string;
  totalOccupied: number;
  totalEmpty: number;
  totalArticles: number;
  displayName: string;
  operarioId: string | null;
  deviceId: string;
  onLogout: () => Promise<void> | void;
  onInfo?: () => void;
}

const KioskHeader: React.FC<KioskHeaderProps> = ({ shelfName, shelfCode, displayName, operarioId, deviceId, onLogout, onInfo }) => (
  <header className="flex-shrink-0 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm">
    <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-xl sm:text-2xl shrink-0">🏭</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 truncate">{shelfName || shelfCode}</h1>
            <span className="hidden sm:inline rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Kiosko</span>
          </div>
          <p className="text-xs font-bold text-sky-700 truncate">{displayName}</p>
          <p className="text-[10px] text-slate-500 truncate">Op. {operarioId} · {deviceId}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {onInfo && (
          <button
            onClick={onInfo}
            className="rounded-lg border border-sky-300 bg-sky-50 px-2 py-1.5 sm:px-3 sm:py-2 text-xs font-black text-sky-700 transition-colors hover:bg-sky-100"
            title="Ver información del dispositivo (Device ID)"
          >
            ℹ️
          </button>
        )}
        <button
          onClick={onLogout}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 sm:px-3 sm:py-2 text-xs font-black text-slate-700 transition-colors hover:bg-slate-100"
          title="Cambiar operario"
        >
          🔄
        </button>
      </div>
    </div>
  </header>
);

export default KioskHeader;
