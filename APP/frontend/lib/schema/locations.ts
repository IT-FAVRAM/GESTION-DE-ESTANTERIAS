export interface LocationPhoto {
  /** UUID generado en cliente */
  id: string;
  /** URL de descarga de Firebase Storage */
  url: string;
  /** Ruta en Storage: locations/{shelfCode}/{position}/{uuid}.jpg */
  storagePath: string;
  /** operarioId de quien la subió */
  uploadedBy: string;
  /** displayName de quien la subió */
  uploadedByName: string;
  /** timestamp Unix (ms) */
  uploadedAt: number;
  /** Pie de foto opcional */
  caption?: string;
}

export interface LocationDoc {
  position: string;
  items: LocationItem[];
  isEmpty: boolean;
  nota?: string;
  /** Fotos asociadas a la UBICACIÓN (no al artículo). Solo sección SOLDADURA. */
  photos?: LocationPhoto[];
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
  /** true si se introdujo manualmente como texto libre (sin código de barras) */
  isFreeText?: boolean;
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
  photos?: LocationPhoto[];
}


