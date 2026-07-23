export type DeviceConnectionType = 'KIOSK' | 'CARRETILLERO' | 'ADMIN' | 'UNKNOWN';

export interface DeviceConnectionStatus {
  authUid: string;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceConnectionType;
  /** Sección de la nave (p.ej. "Soldadura"), cuando el dispositivo tiene una fija. */
  zone?: string;
  isOnline: boolean;
  lastSeen: string;
  lastConnectedAt: string;
  lastDisconnectedAt?: string;
  sessionId: string;
  lastOfflineDurationMs?: number;
}

export interface ConnectionLogEntry {
  authUid: string;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceConnectionType;
  /** Sección de la nave (p.ej. "Soldadura"), cuando el dispositivo tiene una fija. */
  zone?: string;
  event: 'CONNECTED' | 'DISCONNECTED';
  timestamp: string;
  sessionId: string;
  offlineDurationMs?: number;
}


