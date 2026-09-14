import React from 'react';
import { CircleHelp } from 'lucide-react';
import AppHeader from '../common/AppHeader';

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
  /** Abre la ayuda "¿Cómo funciona?". */
  onHelp?: () => void;
  actionButtons?: React.ReactNode;
}

// Delega en la cabecera única compartida (AppHeader) para mantener una sola
// escala visual entre Kiosk / Calidad / Jefe / Punzonado / Carretillero.
const KioskHeader: React.FC<KioskHeaderProps> = ({
  shelfName,
  shelfCode,
  displayName,
  onLogout,
  onInfo,
  onHelp,
  actionButtons,
}) => (
  <AppHeader
    title={shelfName || shelfCode}
    center={actionButtons}
    right={onHelp && (
      <button
        onClick={onHelp}
        className="min-h-11 px-4 flex items-center gap-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-900 text-sm font-black whitespace-nowrap active:scale-95 transition-all touch-manipulation"
      >
        <CircleHelp className="w-5 h-5" strokeWidth={2.5} aria-hidden />
        ¿Cómo funciona?
      </button>
    )}
    onInfo={onInfo}
    onLogout={() => onLogout()}
  />
);

export default KioskHeader;
