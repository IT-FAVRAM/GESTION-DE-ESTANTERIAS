export interface LocationDoc {
  position: string;
  items: LocationItem[];
  isEmpty: boolean;
  nota?: string;
}

export interface LocationItem {
  presenceId?: string;
  articleCode: string;
  orderFab: string;
  locatedBy: string;
  locatedByName: string;
  locatedAt: string;
  /** Cantidad de piezas (solo para ubicaciones de reproceso CAL 001-022) */
  quantity?: number;
  /** Importe unitario en EUR (solo para ubicaciones de reproceso CAL 001-022) */
  unitCost?: number;
}

export interface ItemDoc {
  presenceId: string;
  aggregateKey: string;
  articleCode: string;
  orderFab: string;
  locationIds: string[];
  shelfCode: string;
  locatedBy: string;
  locatedByName: string;
  locatedAt: string;
  active: boolean;
  removedAt?: string;
  removedBy?: string;
  lastAlertAt?: string;
}

export interface ItemAggregateDoc {
  aggregateKey: string;
  articleCode: string;
  orderFab: string;
  activePresenceIds: string[];
  totalActivePresences: number;
  totalPlacements: number;
  updatedAt: string;
}

/** Genera la clave de agregacion: "articleCode__orderFab" */
export const getItemAggregateId = (articleCode: string, orderFab: string): string =>
  `${articleCode.trim().toUpperCase()}__${orderFab.trim().toUpperCase()}`;

/** Compat alias temporal para no romper imports existentes */
export const getItemDocId = getItemAggregateId;

// ── ShelfLocationState lives here so it can be used by
//    both useShelf.ts and shelfOptimisticUpdates.ts without circular deps ──

export interface ShelfLocationState {
  position: string;
  items: LocationItem[];
  isEmpty: boolean;
  locationId: string;
  nota?: string;
}


