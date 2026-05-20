/**
 * Kiosk Schema — Configuración de kioscos con múltiples estanterías
 */

export interface KioskDoc {
  id: string;
  name: string;
  shelves: string[]; // Array de códigos de estantería (ej: ["MEC", "PRE"])
  description?: string;
  location?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KioskShelf {
  code: string;
  name: string;
}
