export type DeviceType = 'KIOSK' | 'CARRETILLERO';

export interface DeviceDoc {
  type: DeviceType;
  assignedShelf?: string | null;
  name: string;
  lastSeen: string;
  active: boolean;
}
