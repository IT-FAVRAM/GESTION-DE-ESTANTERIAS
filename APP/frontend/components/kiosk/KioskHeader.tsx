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
  /**
   * Nodo donde se monta (portal) el buscador en tablet horizontal. Si se pasa,
   * ocupa el centro de la cabecera en lugar de `actionButtons`.
   */
  searchSlotRef?: (el: HTMLDivElement | null) => void;
}

// Delega en la cabecera única compartida (AppHeader) para mantener una sola
// escala visual entre Kiosk / Calidad / Jefe / Punzonado / Carretillero.
const KioskHeader: React.FC<KioskHeaderProps> = ({
  shelfName,
  shelfCode,
  onLogout,
  onInfo,
  onHelp,
  actionButtons,
  searchSlotRef,
}) => (
  <AppHeader
    title={shelfName || shelfCode}
    center={searchSlotRef ? <div ref={searchSlotRef} className="w-full max-w-2xl px-2" /> : actionButtons}
    centerOverflowVisible={!!searchSlotRef}
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
