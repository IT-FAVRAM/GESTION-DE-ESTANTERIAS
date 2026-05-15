import type { DeviceDoc } from '../../lib/firestoreSchema';

export type AdminTab = 'devices' | 'users' | 'shelves' | 'special' | 'chiefs' | 'reports' | 'messages';

export const ALL_TABS: Array<{ key: AdminTab; label: string; icon: string; superadminOnly?: boolean }> = [
  { key: 'devices', label: 'Dispositivos', icon: '📱', superadminOnly: true },
  { key: 'users', label: 'Usuarios', icon: '👥', superadminOnly: true },
  { key: 'shelves', label: 'Estanterias', icon: '🏭', superadminOnly: true },
  { key: 'special', label: 'Ubicaciones Esp.', icon: '🚨', superadminOnly: true },
  { key: 'chiefs', label: 'Jefes x Seccion', icon: '👷', superadminOnly: true },
  { key: 'reports', label: 'Informes', icon: '📊' },
  { key: 'messages', label: 'Mensajes', icon: '📢' },
];

export const linesToArray = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

export type CurrentDeviceDraft = {
  name: string;
  type: DeviceDoc['type'];
  shelf: string;
  active: boolean;
};
