import type { DeviceDoc } from '../../lib/firestoreSchema';

export type AdminTab = 'team' | 'shelves' | 'special' | 'chiefs' | 'reports' | 'messages' | 'connections' | 'wifi-quality';

export const ALL_TABS: Array<{ key: AdminTab; label: string; superadminOnly?: boolean }> = [
  { key: 'team', label: 'Usuarios y Dispositivos', superadminOnly: true },
  { key: 'shelves', label: 'Estanterías', superadminOnly: true },
  { key: 'special', label: 'Ubicaciones Esp.', superadminOnly: true },
  { key: 'chiefs', label: 'Jefes por sección', superadminOnly: true },
  { key: 'connections', label: 'Conexiones' },
  { key: 'wifi-quality', label: 'Calidad WiFi' },
  { key: 'reports', label: 'Informes' },
  { key: 'messages', label: 'Mensajes' },
];

export const linesToArray = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

export type CurrentDeviceDraft = {
  name: string;
  type: DeviceDoc['type'];
  shelf: string;
  kioskId: string;
  active: boolean;
};


