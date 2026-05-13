import type { WarehouseSection } from './sections';

export type PickupStatus = 'PENDING' | 'COMPLETED';

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
}

export type HistoryAction =
  | 'UBICAR'
  | 'RETIRAR'
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
