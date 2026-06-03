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
  actionButtons?: React.ReactNode;
}

const KioskHeader: React.FC<KioskHeaderProps> = ({ shelfName, shelfCode, displayName, operarioId, deviceId, onLogout, onInfo, actionButtons }) => (
  <header className="flex-shrink-0 bg-slate-900 border-b border-slate-700 px-3 py-1.5">
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-sm font-bold text-white tracking-tight shrink-0">{shelfName || shelfCode}</h1>
      {actionButtons && (
        <div className="flex-1 flex items-center justify-center gap-1 overflow-hidden min-w-0">
          {actionButtons}
        </div>
      )}
      <div className="flex items-center gap-1 shrink-0">
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


