import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, setDoc, collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/schema/collections';
import { measureFullQuality } from '../lib/networkQuality';
import type { FullQualityResult } from '../lib/networkQuality';
import type {
  DeviceConnectionType,
  NetworkQualitySnapshot,
  DeviceQualityStats,
  QualityDataPoint,
} from '../lib/schema/connectionStatus';

const QUALITY_CHECK_INTERVAL_MS = 5 * 60_000;

interface UseNetworkQualityParams {
  authUid: string | null;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceConnectionType;
  zone?: string | null;
  speedTestUrl: string;
  enabled?: boolean;
}

interface UseNetworkQualityReturn {
  currentQuality: FullQualityResult | null;
  isMeasuring: boolean;
  triggerMeasurement: () => Promise<void>;
  getDeviceStats: (deviceId: string, hours?: number) => Promise<DeviceQualityStats | null>;
}

export const useNetworkQuality = ({
  authUid,
  deviceId,
  deviceName,
  deviceType,
  zone,
  speedTestUrl,
  enabled = true,
}: UseNetworkQualityParams): UseNetworkQualityReturn => {
  const [currentQuality, setCurrentQuality] = useState<FullQualityResult | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const persistSnapshot = useCallback(async (result: FullQualityResult) => {
    if (!authUid) return;

    const snapshot: NetworkQualitySnapshot = {
      authUid,
      deviceId,
      deviceName,
      deviceType,
      ...(zone ? { zone } : {}),
      timestamp: new Date().toISOString(),
      effectiveType: result.effectiveType,
      downlinkMbps: result.downlinkMbps,
      rttMs: result.rttMs,
      saveData: result.saveData,
      downloadSpeedMbps: result.downloadSpeedMbps,
      downloadTestMs: result.downloadTestMs,
      downloadTestBytes: result.downloadTestBytes,
      httpLatencyMs: result.httpLatencyMs,
      qualityScore: result.qualityScore,
      qualityLabel: result.qualityLabel,
    };

    try {
      await addDoc(collection(db, COLLECTIONS.CONNECTION_QUALITY), snapshot);

      const statusRef = doc(db, COLLECTIONS.CONNECTION_STATUS, authUid);
      await setDoc(statusRef, {
        lastQualityScore: result.qualityScore,
        lastQualityLabel: result.qualityLabel,
        lastBandwidthMbps: result.downloadSpeedMbps ?? result.downlinkMbps,
        lastLatencyMs: result.httpLatencyMs ?? result.rttMs,
        lastQualityCheck: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.error('[useNetworkQuality] Failed to persist snapshot:', err);
    }
  }, [authUid, deviceId, deviceName, deviceType, zone]);

  const triggerMeasurement = useCallback(async () => {
    if (isMeasuring || !authUid || !enabled) return;

    setIsMeasuring(true);
    try {
      const result = await measureFullQuality(speedTestUrl, false);
      setCurrentQuality(result);
      await persistSnapshot(result);
    } catch (err) {
      console.error('[useNetworkQuality] Measurement failed:', err);
    } finally {
      setIsMeasuring(false);
    }
  }, [authUid, enabled, speedTestUrl, persistSnapshot, isMeasuring]);

  useEffect(() => {
    if (!enabled || !authUid) return;

    const initialTimeout = setTimeout(() => {
      triggerMeasurement();
    }, 30_000);

    intervalRef.current = setInterval(() => {
      triggerMeasurement();
    }, QUALITY_CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, authUid, triggerMeasurement]);

  const getDeviceStats = useCallback(async (
    targetDeviceId: string,
    hours: number = 24,
  ): Promise<DeviceQualityStats | null> => {
    try {
      const startMs = Date.now() - hours * 3600_000;
      const startIso = new Date(startMs).toISOString();

      const q = query(
        collection(db, COLLECTIONS.CONNECTION_QUALITY),
        where('deviceId', '==', targetDeviceId),
        where('timestamp', '>=', startIso),
        orderBy('timestamp', 'desc'),
        limit(288),
      );

      const snap = await getDocs(q);
      const snapshots = snap.docs.map((d) => d.data() as NetworkQualitySnapshot);

      if (snapshots.length === 0) return null;

      const latest = snapshots[0];
      const qualityHistory: QualityDataPoint[] = snapshots.map((s) => ({
        timestamp: s.timestamp,
        qualityScore: s.qualityScore,
        bandwidthMbps: s.downloadSpeedMbps ?? s.downlinkMbps,
        rttMs: s.httpLatencyMs ?? s.rttMs,
        downloadSpeedMbps: s.downloadSpeedMbps,
        effectiveType: s.effectiveType,
      }));

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      const scores = snapshots.map((s) => s.qualityScore);
      const bandwidths = snapshots
        .map((s) => s.downloadSpeedMbps ?? s.downlinkMbps)
        .filter((v): v is number => v !== undefined);
      const latencies = snapshots
        .map((s) => s.httpLatencyMs ?? s.rttMs)
        .filter((v): v is number => v !== undefined);
      const downloadSpeeds = snapshots
        .map((s) => s.downloadSpeedMbps)
        .filter((v): v is number => v !== undefined);

      return {
        deviceId: targetDeviceId,
        deviceName: latest.deviceName,
        deviceType: latest.deviceType,
        zone: latest.zone,
        avgQualityScore: Math.round(avg(scores)),
        avgBandwidthMbps: Math.round(avg(bandwidths) * 100) / 100,
        avgLatencyMs: Math.round(avg(latencies)),
        avgDownloadSpeedMbps: Math.round(avg(downloadSpeeds) * 100) / 100,
        sampleCount: snapshots.length,
        lastCheckedAt: latest.timestamp,
        qualityHistory: qualityHistory.reverse(),
      };
    } catch (err) {
      console.error('[useNetworkQuality] Failed to fetch device stats:', err);
      return null;
    }
  }, []);

  return { currentQuality, isMeasuring, triggerMeasurement, getDeviceStats };
};
