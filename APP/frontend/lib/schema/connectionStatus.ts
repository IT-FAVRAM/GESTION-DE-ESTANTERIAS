export type DeviceConnectionType = 'KIOSK' | 'CARRETILLERO' | 'ADMIN' | 'UNKNOWN';

export interface DeviceConnectionStatus {
  authUid: string;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceConnectionType;
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
  event: 'CONNECTED' | 'DISCONNECTED';
  timestamp: string;
  sessionId: string;
  offlineDurationMs?: number;
}


