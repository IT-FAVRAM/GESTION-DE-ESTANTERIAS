

// Default constants serve as fallback, but the app now supports dynamic strings
// CSO, CXP, CRP removed

export const DEFAULT_WAREHOUSES = ['MEC', 'PRE', 'PLE', 'SOL', 'RSO', 'REP', 'PIN', 'SXP', 'COM', 'RPL', 'CAL', 'ZIN'] as const;

export const DEFAULT_WAREHOUSE_NAMES: Record<string, string> = {
  'MEC': 'Mecanizado',
  'PRE': 'Prensas',
  'PLE': 'Plegado',
  'SOL': 'Soldadura',
  'RSO': 'Robot Soldadura',
  'REP': 'Repasado',
  'PIN': 'Pintura',
  'SXP': 'Soldadura Puntos',
  'COM': 'Comodín',
  'RPL': 'Autoplegadora',
  'CAL': 'Calidad',
  'ZIN': 'Zincado'
};

export const DEFAULT_SHELVES = [1, 2, 3];
export const DEFAULT_RACKS = [1, 2, 3];
export const DEFAULT_POSITIONS = ['IZQ', 'CENTRO', 'DRCH'];
export const HISTORY_LIMIT = 100;

// Types are now strings/numbers to allow dynamic user input
export type WarehouseCode = string;
export type ShelfNumber = number;
export type RackNumber = number;
export type Position = string;

// LocationId format remains the same conceptually but types are looser
export type LocationId = `${string}-E${number}-B${number}-${string}`;

export type ItemStatus = 'UBICADO' | 'EN_TRABAJO' | 'FINALIZADO';
export type PackageType = 'PALLET' | 'CAJA_GRANDE' | 'CAJA_PEQUENA';

export interface AssignmentItem {
  barcode: string; // The article code
  orderId: string; // The Manufacturing Order (OF)
  timestamp: string; // Last modification timestamp (used by UI for sorting/display)

  // New explicit timestamps for tracking
  assignedAt?: string; // When it was first introduced to the system/location
  movedAt?: string;    // When it was moved to the current location
  // removedAt is tracked in HistoryEntry, as the item is deleted from Assignments

  // Phase 2: Production Tracking
  status?: ItemStatus;
  packageType?: PackageType;
  itemKey?: string; // Normalized key: ${barcode}__${orderId}
  quantity?: number;
  amount?: number; // Value in EUR for reprocesses/quality tracking
  containerId?: string;
  notes?: string;
}

export interface WorkingItem extends Omit<AssignmentItem, 'status'> {
  status: 'EN_TRABAJO';
  section: string;
  fromLocationId: LocationId;
  withdrawnAt: string;
  withdrawnBy?: string;
}

export interface FinishedItem {
  id: string; // itemKey
  barcode: string;
  orderId: string;
  timestamp: string; // When it was finished
  finishedAt: string;
  finishedBy?: string;
  status: 'FINALIZADO';
  previousStatus?: ItemStatus;
  packageType?: PackageType;
}

// --- NEW: INBOUND LEAD TIME ---
export type InboundStatus = 'BORRADOR' | 'SOLICITADO' | 'EN_TRANSITO' | 'EN_MUELLE' | 'PARCIAL' | 'DISPONIBLE' | 'CANCELADO';

export interface InboundOrder {
  orderNumber: string; // The ID of the document
  supplierId: string;
  supplierName: string;
  status: InboundStatus;

  // Timestamps (ISO strings)
  fecha_solicitud: string; // T0 (Required)
  fecha_prometida?: string; // T1
  fecha_recepcion_muelle?: string; // T2
  fecha_disponible_estanteria?: string; // T3

  // Metadata
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;

  // Optional Items (if we want to track line completion)
  // lines?: { article: string, qty: number, status: 'PENDING'|'DONE' }[] 
}

export interface LeadTimeMetrics {
  orderNumber: string;
  supplierName: string;

  // Durations in Days (float)
  leadTimeTotalDays: number | null; // T3 - T0
  leadTimeExternalDays: number | null; // T2 - T0
  leadTimeInternalDays: number | null; // T3 - T2
  deviationDays: number | null; // T2 - T1

  // Flags
  isLate: boolean;
  isBottleneckInternal: boolean;
}

export type Assignments = Record<LocationId, AssignmentItem[]>;

export type ActionType = 'assigned' | 'removed' | 'relocated' | 'copied' | 'requested' | 'process_finished' | 'admin_cleared' | 'moved_to_working' | 'ENVIAR_ALMACEN' | 'REUBICAR';

export interface HistoryEntry {
  id: string;
  barcode: string;
  orderId?: string; // Added for history tracking
  action: ActionType;
  fromLocation?: LocationId;
  toLocation?: LocationId;
  timestamp: string;
  user?: string; // User who performed the action
  details?: string;
}

// Re-export constants for backward compatibility in non-updated files (if any)
export const WAREHOUSES = DEFAULT_WAREHOUSES;
export const WAREHOUSE_NAMES = DEFAULT_WAREHOUSE_NAMES;
export const SHELVES = DEFAULT_SHELVES;
export const RACKS = DEFAULT_RACKS;
export const POSITIONS = DEFAULT_POSITIONS;

// --- SECTIONS LOGIC ---
export type WarehouseSection = "PLEGADORA" | "PRENSAS_MECANIZADO" | "LASER" | "REPASADO" | "SOLDADURA" | "AUTOPLEGADORA" | "PINTURA" | "ROBOT_PLEGADO" | "CALIDAD" | "OTROS";

// Mapa de prefijos de ubicación a secciones
export const WAREHOUSE_TO_SECTION: Record<string, WarehouseSection> = {
  MEC: "PRENSAS_MECANIZADO",
  PRE: "PRENSAS_MECANIZADO",
  PLE: "PLEGADORA",
  RPL: "AUTOPLEGADORA", // Autoplegadora
  SOL: "SOLDADURA",
  RSO: "SOLDADURA",
  SXP: "SOLDADURA",
  REP: "REPASADO",
  PIN: "REPASADO", // Pintura asimilado a repasado/acabados
  ZIN: "REPASADO", // Zincado asimilado a acabados
  CAL: "OTROS",    // Calidad es transversal
  COM: "OTROS"     // Comodín
};

/**
 * Obtiene la sección organizativa basada en el ID de la ubicación.
 */
export const getSectionFromLocation = (locationId: string): WarehouseSection | null => {
  if (!locationId) return null;
  const upper = locationId.toUpperCase();

  // Robust check based on content rather than strict prefix
  if (upper.includes("ROB.PLE") || upper.includes("RPL-")) return "AUTOPLEGADORA";
  if (upper.includes("PLE")) return "PLEGADORA";
  if (upper.includes("MEC") || upper.includes("PRE")) return "PRENSAS_MECANIZADO";
  if (upper.includes("SOL") || upper.includes("SXP") || upper.includes("RSO") || upper.includes("ROB.SOL")) return "SOLDADURA";
  if (upper.includes("REP") || upper.includes("PIN") || upper.includes("ZIN")) return "REPASADO";
  if (upper.includes("LAS")) return "LASER";

  const prefix = locationId.split("-")[0];
  return WAREHOUSE_TO_SECTION[prefix] || "OTROS";
};

/**
 * Formats a location ID into a human-readable, simplified string.
 * Example: "MEC-E-URGENTE-B1-MEC 001" -> "MEC 001"
 */
export const formatLocation = (id: string): string => {
  if (!id) return '';

  // Standard structured locations (Warehouse + Code)
  if (id.includes('MEC') && id.includes('MEC ')) return id.split('-').pop()!;
  if (id.includes('PRE') && id.includes('PRE ')) return id.split('-').pop()!;
  if (id.includes('PLE') && id.includes('PLE ')) return id.split('-').pop()!;
  if (id.includes('SOL') && id.includes('SOL ')) return id.split('-').pop()!;
  if (id.includes('SXP') && id.includes('SXP ')) return id.split('-').pop()!;
  if (id.includes('PIN') && id.includes('PIN ')) return id.split('-').pop()!;
  if (id.includes('CAL') && id.includes('CAL ')) return id.split('-').pop()!;
  if (id.includes('REP') && id.includes('REP ')) return id.split('-').pop()!;
  if (id.includes('ROB.SOL') || id.includes('RSO')) return id.split('-').pop()!;
  if (id.includes('RPL')) return id.split('-').pop()!;
  if (id.includes('COM') && id.includes('COM ')) return id.split('-').pop()!;

  if (id.startsWith('ZIN-')) {
    const parts = id.split('-');
    const rackNum = parts[2]?.replace('B', '') || '1';
    return `Zincado Balda ${rackNum}`;
  }

  // Fallback
  return id;
};



