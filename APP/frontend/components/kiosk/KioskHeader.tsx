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

// Tema claro, igual que las cabeceras de Calidad / Jefe de sección / Carretillero
const KioskHeader: React.FC<KioskHeaderProps> = ({ shelfName, shelfCode, displayName, operarioId, deviceId, onLogout, onInfo, actionButtons }) => (
  <header className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-shrink-0">
        <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none truncate">{shelfName || shelfCode}</h1>
        {displayName && <p className="text-[9px] text-slate-500 truncate leading-none mt-0.5">{displayName}</p>}
      </div>
      {actionButtons && (
        <div className="flex-1 flex items-center justify-center gap-1 overflow-hidden min-w-0">
          {actionButtons}
        </div>
      )}
      <div className="flex items-center gap-1 shrink-0">
        {onInfo && (
          <button onClick={onInfo} className="px-2 py-1 text-[10px] text-slate-500 hover:text-slate-900 transition-colors" title="Info">
            ℹ️
          </button>
        )}
        <button onClick={onLogout} className="px-2 py-1 text-[11px] font-bold bg-slate-100 text-slate-700 rounded-lg whitespace-nowrap transition-colors hover:bg-slate-200" title="Cambiar operario">
          Salir
        </button>
      </div>
    </div>
  </header>
);

export default KioskHeader;


