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
  <header className="flex-shrink-0 bg-slate-900 border-b border-slate-700 px-3 py-1.5">
    <div className="flex items-center justify-between">
      <h1 className="text-sm font-bold text-white tracking-tight">{shelfName || shelfCode}</h1>
      <div className="flex items-center gap-1">
        {onInfo && (
          <button onClick={onInfo} className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-white transition-colors" title="Info">
            ℹ️
          </button>
        )}
        <button onClick={onLogout} className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-white transition-colors" title="Cambiar operario">
          🔄
        </button>
      </div>
    </div>
  </header>
);

export default KioskHeader;


