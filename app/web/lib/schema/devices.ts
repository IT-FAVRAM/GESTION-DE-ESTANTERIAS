export type DeviceType = 'KIOSK' | 'CARRETILLERO';

export interface DeviceDoc {
  type: DeviceType;
  name: string;
  lastSeen: string;
  active: boolean;
  // Configuración antigua (legacy, backward compatible)
  assignedShelf?: string | null;
  // Configuración nueva: asociar a un kiosko
  kioskId?: string | null;
}
