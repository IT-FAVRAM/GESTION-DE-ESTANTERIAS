import type { WarehouseSection } from './sections';

export type PickupStatus = 'PENDING' | 'COMPLETED';
export type PickupRequestType = 'RECOGER' | 'TRAER';

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
  // Solo para requestType === 'TRAER':
  articleCode?: string;
  articleOrderFab?: string;
  articleShelfName?: string;
  articlePositions?: string[];
  // Solo para requestType === 'RECOGER' con detalles:
  articleToPickCode?: string;
  articleToPickOrderFab?: string;
  destinationShelfCode?: string;
  destinationShelfName?: string;
}

export type HistoryAction =
  | 'UBICAR'
  | 'UBICAR_MULTI'
  | 'RETIRAR'
  | 'RETIRAR_DE_UBICACION'
  | 'MOVER'
  | 'AVISAR_CARRETILLERO'
  | 'ENVIAR_ALMACEN';

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


