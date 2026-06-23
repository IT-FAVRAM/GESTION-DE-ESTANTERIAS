import React from 'react';
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
  actionButtons,
}) => (
  <AppHeader
    title={shelfName || shelfCode}
    subtitle={displayName || undefined}
    center={actionButtons}
    onInfo={onInfo}
    onLogout={() => onLogout()}
  />
);

export default KioskHeader;
