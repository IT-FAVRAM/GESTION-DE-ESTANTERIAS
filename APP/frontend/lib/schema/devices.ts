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
  // Carros a excluir de la vista (ej: ['CRP'] para excluir Amada)
  excludedCarts?: string[];
  // Modo visual/solo lectura
  visualOnly?: boolean;
  // Estanterías permitidas (si no está definido, acceso a todas)
  allowedShelves?: string[];
}


