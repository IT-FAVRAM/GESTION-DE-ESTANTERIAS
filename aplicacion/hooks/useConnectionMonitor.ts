import { useEffect, useState } from 'react';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/schema/collections';
import type { DeviceConnectionType } from '../lib/schema/connectionStatus';
import { drainOfflineQueue } from '../lib/offline/offlineQueue';
import { getNetworkInfo, computeQualityScore } from '../lib/networkQuality';

const OFFLINE_START_KEY = 'wms-offline-start-v1';

const generateSessionId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const storeOfflineStart = (ts: number) => {
  try { localStorage.setItem(OFFLINE_START_KEY, String(ts)); } catch {}
};
const readOfflineStart = (): number | null => {
  try {
    const v = localStorage.getItem(OFFLINE_START_KEY);
    return v ? Number(v) : null;
  } catch { return null; }
};
const clearOfflineStart = () => {
  try { localStorage.removeItem(OFFLINE_START_KEY); } catch {}
};

interface ConnectionMonitorParams {
  authUid: string | null;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceConnectionType;
  /** Sección de la nave del dispositivo (p.ej. "Soldadura"), si tiene una fija. */
  zone?: string | null;
  enabled?: boolean;
}

export const useConnectionMonitor = ({
  authUid,
  deviceId,
  deviceName,
  deviceType,
  zone,
  enabled = true,
}: ConnectionMonitorParams) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (!authUid || !enabled) return;

    // Fresh session ID per effect run so each auth session gets a unique ID.
    const sessionId = generateSessionId();
    const statusRef = doc(db, COLLECTIONS.CONNECTION_STATUS, authUid);
    const logsRef = collection(db, COLLECTIONS.CONNECTION_LOGS);

    const base = { authUid, deviceId, deviceName, deviceType, sessionId, ...(zone ? { zone } : {}) };

    const writeStatus = async (fields: Record<string, unknown>) => {
      try {
        await setDoc(statusRef, { ...base, ...fields }, { merge: true });
      } catch {
        // Firestore offline persistence will queue the write
      }
    };

    const writeLog = async (event: 'CONNECTED' | 'DISCONNECTED', extra?: Record<string, unknown>) => {
      try {
        await addDoc(logsRef, {
          ...base,
          event,
          timestamp: new Date().toISOString(),
          ...extra,
        });
      } catch {
        // Best-effort; logs may be lost during disconnection
      }
    };

    // --- Initial connection report ---
    const now = new Date().toISOString();

    // Check if we were offline before this session started (stored from previous session)
    const prevOfflineStart = readOfflineStart();
    const prevOfflineDurationMs = prevOfflineStart
      ? Math.max(0, Date.now() - prevOfflineStart)
      : undefined;
    clearOfflineStart();

    writeStatus({
      isOnline: true,
      lastSeen: now,
      lastConnectedAt: now,
      ...(prevOfflineDurationMs !== undefined ? { lastOfflineDurationMs: prevOfflineDurationMs } : {}),
    });

    writeLog('CONNECTED', prevOfflineDurationMs !== undefined ? { offlineDurationMs: prevOfflineDurationMs } : {});

    // --- Heartbeat every 60 seconds ---
    let heartbeatCount = 0;
    const heartbeat = setInterval(() => {
      if (navigator.onLine) {
        heartbeatCount++;
        const statusFields: Record<string, unknown> = { isOnline: true, lastSeen: new Date().toISOString() };

        // Passive quality check every 5th heartbeat (~5 min)
        if (heartbeatCount % 5 === 0) {
          try {
            const info = getNetworkInfo();
            const quality = computeQualityScore({
              effectiveType: info.effectiveType,
              downlinkMbps: info.downlink,
              rttMs: info.rtt,
            });
            statusFields.lastQualityScore = quality.qualityScore;
            statusFields.lastQualityLabel = quality.qualityLabel;
            statusFields.lastBandwidthMbps = info.downlink;
            statusFields.lastLatencyMs = info.rtt;
            statusFields.lastQualityCheck = new Date().toISOString();
          } catch {
            // Best-effort quality check — never block heartbeat
          }
        }

        writeStatus(statusFields);
      }
    }, 60_000);

    // --- Online/Offline event handlers ---
    const handleOffline = () => {
      setIsOnline(false);
      storeOfflineStart(Date.now());
      writeStatus({ isOnline: false, lastDisconnectedAt: new Date().toISOString() });
      writeLog('DISCONNECTED');
    };

    const handleOnline = async () => {
      const offlineStart = readOfflineStart();
      const offlineDurationMs = offlineStart ? Math.max(0, Date.now() - offlineStart) : undefined;

      setIsOnline(true);

      // Write status BEFORE clearing the stored start time so the duration is
      // not lost if the write fails or the browser crashes mid-operation.
      await writeStatus({
        isOnline: true,
        lastSeen: new Date().toISOString(),
        lastConnectedAt: new Date().toISOString(),
        ...(offlineDurationMs !== undefined ? { lastOfflineDurationMs: offlineDurationMs } : {}),
      });
      clearOfflineStart();

      // Only log if offline was meaningful (> 5 seconds)
      if (!offlineDurationMs || offlineDurationMs > 5_000) {
        await writeLog('CONNECTED', offlineDurationMs !== undefined ? { offlineDurationMs } : {});
      }

      // Drain any queued offline operations now that we're back online
      try {
        await drainOfflineQueue();
      } catch (drainErr) {
        console.error('[useConnectionMonitor] Failed to drain offline queue on reconnect:', drainErr);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [authUid, deviceId, deviceName, deviceType, zone, enabled]);

  return { isOnline };
};


