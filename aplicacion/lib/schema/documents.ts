import type { WarehouseSection } from './sections';

export type PickupStatus = 'PENDING' | 'COMPLETED';
export type PickupRequestType = 'RECOGER' | 'TRAER' | 'RECEPCION' | 'BAJAR_MATERIAL';

export interface PickupRequestDoc {
  operarioId: string;
  operarioName: string;
  shelfSection: WarehouseSection;
  shelfCode: string;
  shelfName: string;
  status: PickupStatus;
  createdAt: string;
  completedAt: string | null;
  completedBy: string | null;
  requestType?: PickupRequestType;
  // ── Carretillero asignado (recibe popup + push; el resto lo ve en la cola) ──
  targetCarretilleroId?: string;
  targetCarretilleroName?: string;
  // ── Acuse de recibo del carretillero ("Recibido" en el popup bloqueante) ──
  acknowledged?: boolean;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  // Solo para requestType === 'TRAER':
  articleCode?: string;
  articleOrderFab?: string;
  articleShelfName?: string;
  articlePositions?: string[];
  /** Código real de la estantería de origen (las solicitudes antiguas no lo tienen). */
  articleShelfCode?: string;
  /** Ubicaciones reales de origen ("SOL-044"), para retirar al entregar. */
  articleLocationIds?: string[];
  // Solo para requestType === 'RECOGER' con detalles:
  articleToPickCode?: string;
  articleToPickOrderFab?: string;
  // ── Origen (dónde recoger) — RECOGER / SE LLEVE (artículo puede ser texto libre) ──
  pickupSection?: WarehouseSection;
  pickupShelfName?: string;
  pickupStation?: number | null;      // 1..18 si el origen es SOLDADURA (SOL)
  // ── Destino (explícito para RECOGER y TRAER) ──
  destinationShelfCode?: string;
  destinationShelfName?: string;
  destinationSection?: WarehouseSection;
  destinationStation?: number | null; // 1..18 si el destino es SOLDADURA (SOL)
}

export type HistoryAction =
  | 'UBICAR'
  | 'UBICAR_MULTI'
  | 'RETIRAR'
  | 'RETIRAR_DE_UBICACION'
  | 'MOVER'
  | 'AVISAR_CARRETILLERO'
  | 'ENVIAR_ALMACEN'
  /** Quitado por administración al poner al día una estantería (scripts/limpiar-estanteria.cjs). */
  | 'LIMPIEZA_INVENTARIO';

export interface HistoryEntryDoc {
  action: HistoryAction;
  articleCode: string;
  orderFab: string;
  fromLocation: string | null;
  toLocation: string | null;
  shelfCode: string;
  operarioId: string;
  operarioName: string;
  timestamp: string;
}

export interface CartLocationItem {
  description: string;
  editedBy: string;
  editedAt: string;
}


