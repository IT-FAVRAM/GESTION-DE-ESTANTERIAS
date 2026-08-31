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
  // WiFi quality (written by useNetworkQuality / useConnectionMonitor)
  lastQualityScore?: number;
  lastQualityLabel?: 'excelente' | 'buena' | 'regular' | 'mala' | 'critica';
  lastBandwidthMbps?: number;
  lastLatencyMs?: number;
  lastQualityCheck?: string;
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

// ── WiFi Quality Metrics ─────────────────────────────────────────────────────

export interface NetworkQualitySnapshot {
  authUid: string;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceConnectionType;
  zone?: string;
  timestamp: string;

  // Network Information API (passive)
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlinkMbps?: number;
  rttMs?: number;
  saveData?: boolean;

  // Active measurement results
  downloadSpeedMbps?: number;
  downloadTestMs?: number;
  downloadTestBytes?: number;
  httpLatencyMs?: number;

  // Quality score (0-100)
  qualityScore: number;
  qualityLabel: 'excelente' | 'buena' | 'regular' | 'mala' | 'critica';
}

export interface DeviceQualityStats {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  zone?: string;
  avgQualityScore: number;
  avgBandwidthMbps: number;
  avgLatencyMs: number;
  avgDownloadSpeedMbps: number;
  sampleCount: number;
  lastCheckedAt: string;
  qualityHistory: QualityDataPoint[];
}

export interface QualityDataPoint {
  timestamp: string;
  qualityScore: number;
  bandwidthMbps?: number;
  rttMs?: number;
  downloadSpeedMbps?: number;
  effectiveType?: string;
}


