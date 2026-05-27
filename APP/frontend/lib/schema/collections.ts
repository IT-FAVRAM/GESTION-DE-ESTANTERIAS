export const COLLECTIONS = {
  CONFIG: 'configuracion',
  SHELVES: 'shelves',       // Backend shelfOperate escribe en 'shelves/{shelfCode}/locations/'
  LOCATIONS: 'locations',   // Subcollección bajo SHELVES — debe coincidir con backend
  ITEMS: 'piezas',
  ITEM_AGGREGATES: 'resumen_piezas',
  USERS: 'usuarios',
  DEVICES: 'dispositivos',
  KIOSKS: 'kiosks',
  PICKUP_QUEUE: 'cola_recogida',
  HISTORY: 'historial',
  CONNECTION_STATUS: 'conexion_estado',
  CONNECTION_LOGS: 'conexion_logs',
} as const;

export const CONFIG_DOC_ID = 'app';


