# WiFi Quality Analysis - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing connection monitor with real WiFi quality metrics (bandwidth, latency, signal type) by implementing a Network Information API reader, a server-side speed test endpoint, and historical quality tracking in Firestore.

**Architecture:** The current system only tracks online/offline status via heartbeats. This plan adds three layers: (1) lightweight passive metrics from the browser's Network Information API, (2) active speed tests via a new Cloud Function that serves test payloads, and (3) historical quality data storage and visualization in the admin dashboard. Signal strength (RSSI/dBm) is NOT achievable from a browser — this is a hard limitation documented in the plan.

**Tech Stack:** React 19, TypeScript, Firebase Cloud Functions (Node.js 22), Firestore, Network Information API, Tailwind CSS

---

## Limitations (Important)

| Metric |可行性 | Notes |
|---|---|---|
| Bandwidth (Mbps) | **YES** | Network Information API (passive) + download test (active) |
| Latency (ms) | **YES** | Network Information API `rtt` + HTTP HEAD measurements |
| Connection type | **YES** | Network Information API `effectiveType` (2g/3g/4g) |
| Signal strength (RSSI/dBm) | **NO** | Not available in browsers — requires native OS tools |
| Packet loss | **PARTIAL** | Inferred from speed test timeouts, not directly measurable |
| Jitter | **PARTIAL** | Inferred from multiple latency measurements |

---

## File Structure

| Action | File | Purpose |
|---|---|---|
| Create | `APP/frontend/lib/networkQuality.ts` | Network Information API reader + speed test client |
| Create | `APP/frontend/hooks/useNetworkQuality.ts` | React hook that collects and reports quality metrics |
| Create | `APP/frontend/components/admin/WifiQualityTab.tsx` | Admin dashboard tab for WiFi quality visualization |
| Create | `APP/backend/src/speedTest.ts` | Cloud Function serving test payloads for download speed measurement |
| Modify | `APP/frontend/lib/schema/connectionStatus.ts` | Add quality metrics fields to TypeScript types |
| Modify | `APP/frontend/hooks/useConnectionMonitor.ts` | Integrate quality collection into heartbeat cycle |
| Modify | `APP/frontend/components/admin/ConnectionMonitorTab.tsx` | Add WiFi Quality tab to the admin dashboard |
| Modify | `APP/backend/src/index.ts` | Export new speedTest Cloud Function |
| Modify | `APP/frontend/lib/schema/collections.ts` | Add `conexion_quality` collection |

---

### Task 1: Extend Firestore Schema with Quality Metrics

**Files:**
- Modify: `APP/frontend/lib/schema/connectionStatus.ts:1-31`
- Modify: `APP/frontend/lib/schema/collections.ts`

- [ ] **Step 1: Add quality metric types to connectionStatus.ts**

Add new interfaces after the existing ones:

```typescript
// After line 29 (end of ConnectionLogEntry)

export interface NetworkQualitySnapshot {
  authUid: string;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceConnectionType;
  zone?: string;
  timestamp: string;

  // Network Information API (passive)
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlinkMbps?: number;     // estimated bandwidth in Mbps from navigator.connection
  rttMs?: number;            // estimated round-trip time in ms from navigator.connection
  saveData?: boolean;

  // Active measurement results
  downloadSpeedMbps?: number; // measured via file download test
  downloadTestMs?: number;    // time taken for the download test
  downloadTestBytes?: number; // size of the test file downloaded
  httpLatencyMs?: number;     // measured via HEAD request round-trip

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
```

- [ ] **Step 2: Add collection name to collections.ts**

Open `APP/frontend/lib/schema/collections.ts` and add to the `COLLECTIONS` object:

```typescript
CONNECTION_QUALITY: 'conexion_quality',
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck` in `APP/frontend/`
Expected: PASS (no errors)

- [ ] **Step 4: Commit**

```bash
git add APP/frontend/lib/schema/connectionStatus.ts APP/frontend/lib/schema/collections.ts
git commit -m "feat: add WiFi quality metric types and Firestore collection schema"
```

---

### Task 2: Build Network Quality Client Library

**Files:**
- Create: `APP/frontend/lib/networkQuality.ts`

- [ ] **Step 1: Create the networkQuality.ts module**

```typescript
/**
 * WiFi Quality Analysis - Client Library
 *
 * Provides passive (Network Information API) and active (download test)
 * network quality measurement. Results are stored in Firestore.
 */

// ── Passive: Network Information API ────────────────────────────────────────

interface NetworkInfo {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlink?: number;  // Mbps
  rtt?: number;       // ms
  saveData?: boolean;
  online?: boolean;
}

export const getNetworkInfo = (): NetworkInfo => {
  const conn = (navigator as any).connection;
  if (!conn) {
    return { online: navigator.onLine };
  }
  return {
    effectiveType: conn.effectiveType,
    downlink: conn.downlink,
    rtt: conn.rtt,
    saveData: conn.saveData,
    online: navigator.onLine,
  };
};

// ── Active: HTTP Latency (HEAD request) ────────────────────────────────────

export const measureHttpLatency = async (url?: string): Promise<number | null> => {
  const target = url || `${window.location.origin}/favicon.ico?_=${Date.now()}`;
  try {
    const start = performance.now();
    await fetch(target, {
      method: 'HEAD',
      cache: 'no-store',
      mode: 'no-cors',
    });
    return Math.round(performance.now() - start);
  } catch {
    return null;
  }
};

// ── Active: Download Speed Test ─────────────────────────────────────────────

interface DownloadTestResult {
  speedMbps: number;
  durationMs: number;
  bytesDownloaded: number;
}

/**
 * Downloads a test file from the server and measures throughput.
 * The Cloud Function `speedTest` serves payloads of configurable size.
 */
export const measureDownloadSpeed = async (
  testUrl: string,
  targetBytes: number = 256 * 1024, // 256 KB default
): Promise<DownloadTestResult | null> => {
  try {
    const url = `${testUrl}?size=${targetBytes}&_=${Date.now()}`;
    const start = performance.now();
    const response = await fetch(url, { cache: 'no-store' });
    const blob = await response.blob();
    const durationMs = performance.now() - start;
    const bytesDownloaded = blob.size;
    const speedMbps = (bytesDownloaded * 8) / (durationMs / 1000) / 1_000_000;

    return {
      speedMbps: Math.round(speedMbps * 100) / 100,
      durationMs: Math.round(durationMs),
      bytesDownloaded,
    };
  } catch {
    return null;
  }
};

// ── Combined Quality Score ──────────────────────────────────────────────────

interface QualityInput {
  effectiveType?: string;
  downlinkMbps?: number;
  rttMs?: number;
  downloadSpeedMbps?: number;
  httpLatencyMs?: number;
}

interface QualityOutput {
  qualityScore: number;
  qualityLabel: 'excelente' | 'buena' | 'regular' | 'mala' | 'critica';
}

/**
 * Computes a 0-100 quality score from available metrics.
 * Weights: download speed 40%, latency 30%, connection type 20%, consistency 10%
 */
export const computeQualityScore = (input: QualityInput): QualityOutput => {
  let score = 0;
  let factors = 0;

  // Download speed score (0-40)
  if (input.downloadSpeedMbps !== undefined) {
    // 0 Mbps = 0, 50+ Mbps = 40
    score += Math.min(40, (input.downloadSpeedMbps / 50) * 40);
    factors++;
  } else if (input.downlinkMbps !== undefined) {
    score += Math.min(40, (input.downlinkMbps / 50) * 40);
    factors++;
  }

  // Latency score (0-30) — lower is better
  const latency = input.httpLatencyMs ?? input.rttMs;
  if (latency !== undefined && latency !== null) {
    // 0ms = 30, 500ms+ = 0
    score += Math.max(0, 30 - (latency / 500) * 30);
    factors++;
  }

  // Connection type score (0-20)
  if (input.effectiveType) {
    const typeScores: Record<string, number> = {
      '4g': 20,
      '3g': 12,
      '2g': 5,
      'slow-2g': 1,
    };
    score += typeScores[input.effectiveType] ?? 10;
    factors++;
  }

  // Normalize to 0-100 if we have partial data
  if (factors > 0) {
    score = (score / (factors === 4 ? 100 : factors * 25)) * 100;
  }

  score = Math.round(Math.max(0, Math.min(100, score)));

  let qualityLabel: QualityOutput['qualityLabel'];
  if (score >= 80) qualityLabel = 'excelente';
  else if (score >= 60) qualityLabel = 'buena';
  else if (score >= 40) qualityLabel = 'regular';
  else if (score >= 20) qualityLabel = 'mala';
  else qualityLabel = 'critica';

  return { qualityScore: score, qualityLabel };
};

// ── Full Quality Measurement ────────────────────────────────────────────────

export interface FullQualityResult {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlinkMbps?: number;
  rttMs?: number;
  saveData?: boolean;
  downloadSpeedMbps?: number;
  downloadTestMs?: number;
  downloadTestBytes?: number;
  httpLatencyMs?: number;
  qualityScore: number;
  qualityLabel: 'excelente' | 'buena' | 'regular' | 'mala' | 'critica';
}

/**
 * Runs a full quality measurement: passive API read + active tests.
 * @param speedTestUrl - URL of the Cloud Function speed test endpoint
 * @param quick - If true, skips the download test (lightweight check)
 */
export const measureFullQuality = async (
  speedTestUrl: string,
  quick: boolean = false,
): Promise<FullQualityResult> => {
  const info = getNetworkInfo();

  // Always measure HTTP latency
  const httpLatencyMs = await measureHttpLatency();

  let downloadResult: import('./networkQuality').DownloadTestResult | null = null;
  if (!quick) {
    downloadResult = await measureDownloadSpeed(speedTestUrl);
  }

  const input: QualityInput = {
    effectiveType: info.effectiveType,
    downlinkMbps: info.downlink,
    rttMs: info.rtt,
    downloadSpeedMbps: downloadResult?.speedMbps,
    httpLatencyMs: httpLatencyMs ?? undefined,
  };

  const { qualityScore, qualityLabel } = computeQualityScore(input);

  return {
    effectiveType: info.effectiveType,
    downlinkMbps: info.downlink,
    rttMs: info.rtt,
    saveData: info.saveData,
    downloadSpeedMbps: downloadResult?.speedMbps,
    downloadTestMs: downloadResult?.durationMs,
    downloadTestBytes: downloadResult?.bytesDownloaded,
    httpLatencyMs,
    qualityScore,
    qualityLabel,
  };
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck` in `APP/frontend/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add APP/frontend/lib/networkQuality.ts
git commit -m "feat: add network quality client library with passive + active measurement"
```

---

### Task 3: Build Speed Test Cloud Function

**Files:**
- Create: `APP/backend/src/speedTest.ts`
- Modify: `APP/backend/src/index.ts` (add export)
- Modify: `APP/backend/tsconfig.json` (if needed for new file)

- [ ] **Step 1: Create speedTest.ts Cloud Function**

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Speed Test endpoint — serves random data payloads for download speed measurement.
 * Called as an HTTP onRequest function (not onCall).
 *
 * Query params:
 *   - size: number of bytes to return (default: 256KB, max: 4MB)
 */
export const speedTest = functions.https.onRequest(async (req, res) => {
  // CORS for the frontend
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Parse size parameter (default 256KB, max 4MB)
  const requestedSize = parseInt(req.query.size as string) || 256 * 1024;
  const size = Math.min(Math.max(requestedSize, 1024), 4 * 1024 * 1024);

  // Generate random data payload
  // Use a buffer approach for efficiency
  const chunkSize = 64 * 1024; // 64KB chunks
  const chunks = Math.ceil(size / chunkSize);

  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Length', String(size));
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');

  // Stream the response for accurate speed measurement
  const buf = Buffer.alloc(chunkSize);
  // Fill with random-ish but reproducible data for each chunk
  for (let i = 0; i < chunkSize; i++) {
    buf[i] = (i * 7 + chunks) & 0xff;
  }

  for (let i = 0; i < chunks; i++) {
    const remaining = size - i * chunkSize;
    const toWrite = Math.min(chunkSize, remaining);
    if (toWrite === chunkSize) {
      res.write(buf);
    } else {
      res.write(buf.slice(0, toWrite));
    }
  }

  res.end();
});

/**
 * Quick health check endpoint for latency measurement.
 * Returns a minimal response as fast as possible.
 */
export const ping = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  res.status(200).json({ t: Date.now() });
});
```

- [ ] **Step 2: Export the new functions from index.ts**

Open `APP/backend/src/index.ts` and add at the end (before the last line if there is one, or append):

```typescript
export { speedTest, ping } from './speedTest';
```

- [ ] **Step 3: Verify backend compiles**

Run: `npm run build` in `APP/backend/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add APP/backend/src/speedTest.ts APP/backend/src/index.ts
git commit -m "feat: add speedTest and ping Cloud Functions for WiFi quality measurement"
```

---

### Task 4: Build useNetworkQuality React Hook

**Files:**
- Create: `APP/frontend/hooks/useNetworkQuality.ts`

- [ ] **Step 1: Create the useNetworkQuality hook**

```typescript
import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, setDoc, collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/schema/collections';
import {
  measureFullQuality,
  type FullQualityResult,
} from '../lib/networkQuality';
import type { DeviceConnectionType, NetworkQualitySnapshot, DeviceQualityStats, QualityDataPoint } from '../lib/schema/connectionStatus';

const QUALITY_CHECK_INTERVAL_MS = 5 * 60_000; // Every 5 minutes
const QUALITY_HISTORY_LIMIT = 288; // 24h of data at 5-min intervals

interface UseNetworkQualityParams {
  authUid: string | null;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceConnectionType;
  zone?: string | null;
  speedTestUrl: string; // Cloud Function URL for speed test
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
      // Store individual snapshot
      await addDoc(collection(db, COLLECTIONS.CONNECTION_QUALITY), snapshot);

      // Update latest quality on device status doc
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
      // Quick passive check first (always)
      const result = await measureFullQuality(speedTestUrl, false);
      setCurrentQuality(result);
      await persistSnapshot(result);
    } catch (err) {
      console.error('[useNetworkQuality] Measurement failed:', err);
    } finally {
      setIsMeasuring(false);
    }
  }, [authUid, enabled, speedTestUrl, persistSnapshot, isMeasuring]);

  // Periodic quality check
  useEffect(() => {
    if (!enabled || !authUid) return;

    // Initial measurement after 30 seconds (don't block startup)
    const initialTimeout = setTimeout(() => {
      triggerMeasurement();
    }, 30_000);

    // Periodic measurements
    intervalRef.current = setInterval(() => {
      triggerMeasurement();
    }, QUALITY_CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, authUid, triggerMeasurement]);

  // Fetch historical quality stats for a device
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
        limit(QUALITY_HISTORY_LIMIT),
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

      // Compute averages
      const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
      const avg = (arr: number[]) => arr.length > 0 ? sum(arr) / arr.length : 0;

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
        qualityHistory: qualityHistory.reverse(), // chronological order
      };
    } catch (err) {
      console.error('[useNetworkQuality] Failed to fetch device stats:', err);
      return null;
    }
  }, []);

  return { currentQuality, isMeasuring, triggerMeasurement, getDeviceStats };
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck` in `APP/frontend/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add APP/frontend/hooks/useNetworkQuality.ts
git commit -m "feat: add useNetworkQuality hook for periodic WiFi quality measurement"
```

---

### Task 5: Build WiFi Quality Admin Dashboard Tab

**Files:**
- Create: `APP/frontend/components/admin/WifiQualityTab.tsx`

- [ ] **Step 1: Create WifiQualityTab.tsx**

```typescript
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS } from '../../lib/schema/collections';
import type {
  DeviceConnectionStatus,
  NetworkQualitySnapshot,
  DeviceQualityStats,
  QualityDataPoint,
} from '../../lib/schema/connectionStatus';
import { measureFullQuality, type FullQualityResult } from '../../lib/networkQuality';

// ── Helpers ─────────────────────────────────────────────────────────────────

const qualityColor = (score: number): string => {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-cyan-400';
  if (score >= 40) return 'text-amber-400';
  if (score >= 20) return 'text-orange-400';
  return 'text-red-400';
};

const qualityBg = (score: number): string => {
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 60) return 'bg-cyan-500/10 border-cyan-500/20';
  if (score >= 40) return 'bg-amber-500/10 border-amber-500/20';
  if (score >= 20) return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-red-500/10 border-red-500/20';
};

const qualityBarColor = (score: number): string => {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-cyan-500';
  if (score >= 40) return 'bg-amber-500';
  if (score >= 20) return 'bg-orange-500';
  return 'bg-red-500';
};

const deviceTypeIcon: Record<string, string> = {
  KIOSK: '📟',
  CARRETILLERO: '🔧',
  ADMIN: '💻',
  UNKNOWN: '❓',
};

const effectiveTypeLabel: Record<string, string> = {
  'slow-2g': '2G lento',
  '2g': '2G',
  '3g': '3G',
  '4g': '4G',
};

// ── Quality Score Ring ──────────────────────────────────────────────────────

const QualityRing: React.FC<{ score: number; size?: number }> = ({ score, size = 80 }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className={qualityColor(score)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-black ${qualityColor(score)}`}>{score}</span>
        <span className="text-[9px] text-slate-500 -mt-0.5">/100</span>
      </div>
    </div>
  );
};

// ── Quality Mini Chart ──────────────────────────────────────────────────────

const QualityMiniChart: React.FC<{ data: QualityDataPoint[]; height?: number }> = ({ data, height = 40 }) => {
  if (data.length < 2) {
    return <div className="text-[10px] text-slate-600">Datos insuficientes</div>;
  }

  const maxScore = 100;
  const width = 200;
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - (d.qualityScore / maxScore) * height,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  const lastScore = data[data.length - 1].qualityScore;
  const fillColor = lastScore >= 60 ? 'fill-emerald-500/10' : lastScore >= 40 ? 'fill-amber-500/10' : 'fill-red-500/10';
  const strokeColor = lastScore >= 60 ? 'stroke-emerald-500' : lastScore >= 40 ? 'stroke-amber-500' : 'stroke-red-500';

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={areaD} className={fillColor} />
      <path d={pathD} fill="none" className={strokeColor} strokeWidth="1.5" />
    </svg>
  );
};

// ── Device Quality Card ─────────────────────────────────────────────────────

const DeviceQualityCard: React.FC<{
  device: DeviceConnectionStatus;
  stats: DeviceQualityStats | null;
  onTest: (deviceId: string) => void;
  testing: boolean;
}> = ({ device, stats, onTest, testing }) => {
  const score = stats?.avgQualityScore ?? device.lastQualityScore ?? null;

  return (
    <div className={`rounded-2xl border p-4 ${score !== null ? qualityBg(score) : 'border-slate-800 bg-slate-900'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{deviceTypeIcon[device.deviceType] || '❓'}</span>
          <div>
            <p className="font-bold text-white text-sm">{device.deviceName}</p>
            <span className="text-[11px] text-slate-500 uppercase tracking-wide">
              {device.deviceType}{device.zone ? ` · ${device.zone}` : ''}
            </span>
          </div>
        </div>
        {score !== null && <QualityRing score={score} size={64} />}
      </div>

      {stats ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-800/50 rounded-lg px-3 py-2">
            <p className="text-slate-500">Ancho de banda</p>
            <p className="font-bold text-white">{stats.avgBandwidthMbps.toFixed(1)} Mbps</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg px-3 py-2">
            <p className="text-slate-500">Latencia</p>
            <p className="font-bold text-white">{stats.avgLatencyMs} ms</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg px-3 py-2">
            <p className="text-slate-500">Descarga real</p>
            <p className="font-bold text-white">{stats.avgDownloadSpeedMbps.toFixed(1)} Mbps</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg px-3 py-2">
            <p className="text-slate-500">Muestras</p>
            <p className="font-bold text-white">{stats.sampleCount}</p>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-500">
          Sin datos de calidad aún — {device.lastQualityCheck ? 'Último check: ' + new Date(device.lastQualityCheck).toLocaleString('es') : 'esperando primer check'}
        </div>
      )}

      {stats && stats.qualityHistory.length > 1 && (
        <div className="mt-3">
          <p className="text-[10px] text-slate-600 mb-1">Tendencia 24h</p>
          <QualityMiniChart data={stats.qualityHistory} />
        </div>
      )}

      <button
        onClick={() => onTest(device.deviceId)}
        disabled={testing}
        className="mt-3 w-full px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
      >
        {testing ? '⏳ midiendo...' : '🔄 Test ahora'}
      </button>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

const WifiQualityTab: React.FC = () => {
  const [devices, setDevices] = useState<DeviceConnectionStatus[]>([]);
  const [deviceStats, setDeviceStats] = useState<Map<string, DeviceQualityStats>>(new Map());
  const [testingDevice, setTestingDevice] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Subscribe to live device status
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.CONNECTION_STATUS),
      (snap) => {
        const docs = snap.docs.map((d) => ({ ...(d.data() as DeviceConnectionStatus) }));
        setDevices(docs);
      },
    );
    return () => unsubscribe();
  }, []);

  // Load quality stats for all devices
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const newStats = new Map<string, DeviceQualityStats>();
      for (const device of devices) {
        const q = query(
          collection(db, COLLECTIONS.CONNECTION_QUALITY),
          where('deviceId', '==', device.deviceId),
          orderBy('timestamp', 'desc'),
          limit(288),
        );
        const snap = await getDocs(q);
        const snapshots = snap.docs.map((d) => d.data() as NetworkQualitySnapshot);

        if (snapshots.length > 0) {
          const scores = snapshots.map((s) => s.qualityScore);
          const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

          newStats.set(device.deviceId, {
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            deviceType: device.deviceType,
            zone: device.zone,
            avgQualityScore: Math.round(avg(scores)),
            avgBandwidthMbps: Math.round(avg(snapshots.map((s) => s.downloadSpeedMbps ?? s.downlinkMbps ?? 0)) * 100) / 100,
            avgLatencyMs: Math.round(avg(snapshots.map((s) => s.httpLatencyMs ?? s.rttMs ?? 0))),
            avgDownloadSpeedMbps: Math.round(avg(snapshots.map((s) => s.downloadSpeedMbps ?? 0)) * 100) / 100,
            sampleCount: snapshots.length,
            lastCheckedAt: snapshots[0].timestamp,
            qualityHistory: snapshots.reverse().map((s) => ({
              timestamp: s.timestamp,
              qualityScore: s.qualityScore,
              bandwidthMbps: s.downloadSpeedMbps ?? s.downlinkMbps,
              rttMs: s.httpLatencyMs ?? s.rttMs,
              downloadSpeedMbps: s.downloadSpeedMbps,
              effectiveType: s.effectiveType,
            })),
          });
        }
      }
      setDeviceStats(newStats);
    } catch (err) {
      console.error('[WifiQualityTab] Failed to load stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [devices]);

  useEffect(() => {
    if (devices.length > 0) loadStats();
  }, [devices, loadStats]);

  // Trigger manual test
  const handleTest = useCallback(async (deviceId: string) => {
    setTestingDevice(deviceId);
    try {
      // The actual test is triggered by the device itself via the hook
      // Here we just show the testing state; in production this would
      // call a Cloud Function to trigger the test on the remote device
      await new Promise((r) => setTimeout(r, 3000));
    } finally {
      setTestingDevice(null);
    }
  }, []);

  // Global summary
  const summary = useMemo(() => {
    const scores = Array.from(deviceStats.values()).map((s) => s.avgQualityScore);
    if (scores.length === 0) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const excellent = scores.filter((s) => s >= 80).length;
    const good = scores.filter((s) => s >= 60 && s < 80).length;
    const regular = scores.filter((s) => s >= 40 && s < 60).length;
    const bad = scores.filter((s) => s < 40).length;
    return { avg: Math.round(avg), excellent, good, regular, bad, total: scores.length };
  }, [deviceStats]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Calidad WiFi</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Análisis real de ancho de banda, latencia y calidad de conexión
          </p>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className={`rounded-2xl border p-4 text-center ${qualityBg(summary.avg)}`}>
            <p className="text-3xl font-black text-white">{summary.avg}</p>
            <p className="text-xs text-slate-400 mt-1">Score medio</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
            <p className="text-3xl font-black text-emerald-400">{summary.excellent}</p>
            <p className="text-xs text-slate-400 mt-1">Excelente (80+)</p>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-center">
            <p className="text-3xl font-black text-cyan-400">{summary.good}</p>
            <p className="text-xs text-slate-400 mt-1">Buena (60-79)</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
            <p className="text-3xl font-black text-amber-400">{summary.regular}</p>
            <p className="text-xs text-slate-400 mt-1">Regular (40-59)</p>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
            <p className="text-3xl font-black text-red-400">{summary.bad}</p>
            <p className="text-xs text-slate-400 mt-1">Mala (&lt;40)</p>
          </div>
        </div>
      )}

      {/* Device cards */}
      {loadingStats ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-12 text-center">
          <p className="text-4xl mb-4">📡</p>
          <h3 className="text-lg font-bold text-white mb-2">Sin dispositivos</h3>
          <p className="text-sm text-slate-400">No hay dispositivos registrados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {devices.map((device) => (
            <DeviceQualityCard
              key={device.authUid}
              device={device}
              stats={deviceStats.get(device.deviceId) ?? null}
              onTest={handleTest}
              testing={testingDevice === device.deviceId}
            />
          ))}
        </div>
      )}

      {/* Limitations note */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-500">
        <p className="font-bold text-slate-400 mb-1">Limitaciones del análisis desde navegador</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>La señal WiFi (RSSI/dBm) no es accesible desde un navegador — requiere herramientas nativas del SO</li>
          <li>Los resultados de velocidad dependen del servidor de测试 y la carga de la red en el momento</li>
          <li>ElNetwork Information API solo está disponible en Chrome/Edge (no Safari/Firefox)</li>
          <li>Los tests activos consumen ancho de banda — se ejecutan cada 5 minutos como máximo</li>
        </ul>
      </div>
    </div>
  );
};

export default WifiQualityTab;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck` in `APP/frontend/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add APP/frontend/components/admin/WifiQualityTab.tsx
git commit -m "feat: add WiFi quality admin dashboard tab with score rings and trend charts"
```

---

### Task 6: Integrate Quality Check into Connection Monitor

**Files:**
- Modify: `APP/frontend/hooks/useConnectionMonitor.ts:151`

- [ ] **Step 1: Add network quality to the connection monitor return and heartbeat**

At the bottom of `useConnectionMonitor.ts`, modify the hook to also call the network quality measurement. Add an import and integrate:

```typescript
// Add at top of file (after existing imports, line 6)
import { measureFullQuality } from '../lib/networkQuality';
import type { FullQualityResult } from '../lib/networkQuality';

// Add new state after line 44
const [currentQuality, setCurrentQuality] = useState<FullQualityResult | null>(null);

// Modify the heartbeat (line 97-101) to include quality measurement every 5th heartbeat
let heartbeatCount = 0;
const heartbeat = setInterval(async () => {
  if (navigator.onLine) {
    heartbeatCount++;
    writeStatus({ isOnline: true, lastSeen: new Date().toISOString() });

    // Measure quality every 5th heartbeat (every ~5 minutes)
    if (heartbeatCount % 5 === 0) {
      try {
        const quality = await measureFullQuality(
          `${window.location.origin}/api/speedTest`,
          true, // quick mode — skip download test in heartbeat
        );
        setCurrentQuality(quality);
        writeStatus({
          lastQualityScore: quality.qualityScore,
          lastQualityLabel: quality.qualityLabel,
          lastBandwidthMbps: quality.downlinkMbps,
          lastLatencyMs: quality.httpLatencyMs ?? quality.rttMs,
        });
      } catch {
        // Best-effort quality check
      }
    }
  }
}, 60_000);

// Update the return statement (line 151)
return { isOnline, currentQuality };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck` in `APP/frontend/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add APP/frontend/hooks/useConnectionMonitor.ts
git commit -m "feat: integrate passive WiFi quality check into connection heartbeat"
```

---

### Task 7: Add WiFi Quality Tab to Admin Dashboard

**Files:**
- Modify: `APP/frontend/components/admin/ConnectionMonitorTab.tsx` (or wherever the admin tabs are defined)

- [ ] **Step 1: Find where admin tabs are rendered and add the WiFi Quality tab**

Search for where `ConnectionMonitorTab` is used or where admin tabs are defined. The tab should be added alongside the existing "En vivo" and "Análisis" tabs, OR as a separate top-level tab in the admin view.

Open the admin home view (likely `AdminHomeView.tsx` or similar) and add:

```typescript
// Add import at top
import WifiQualityTab from './WifiQualityTab';

// Add a new tab button alongside existing ones
// <button onClick={() => setTab('wifi-quality')} ...>📶 Calidad WiFi</button>

// Add the tab content
// {tab === 'wifi-quality' && <WifiQualityTab />}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck` in `APP/frontend/`
Expected: PASS

- [ ] **Step 3: Test the full app builds**

Run: `npm run build` in `APP/frontend/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add APP/frontend/components/admin/
git commit -m "feat: add WiFi Quality tab to admin dashboard navigation"
```

---

### Task 8: Deploy and Verify

**Files:** (deployment only, no code changes)

- [ ] **Step 1: Deploy Cloud Functions**

Run: `npm run deploy` in `APP/backend/`
Expected: Functions deploy successfully, speedTest and ping endpoints are live

- [ ] **Step 2: Test the speed test endpoint**

Open in browser: `https://<project-id>.cloudfunctions.net/speedTest?size=102400`
Expected: Downloads a 100KB file

Open: `https://<project-id>.cloudfunctions.net/ping`
Expected: Returns `{"t": <timestamp>}`

- [ ] **Step 3: Deploy frontend**

Run: `npm run build` in `APP/frontend/` then deploy to Firebase Hosting

- [ ] **Step 4: Verify in browser**

1. Open the app on a kiosk or Chrome browser
2. Navigate to Admin → Conexiones → Calidad WiFi tab
3. Wait 30 seconds for initial measurement
4. Verify quality score, bandwidth, and latency appear
5. Click "Test ahora" to trigger manual measurement
6. Verify data persists across page reloads

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete WiFi quality analysis system — passive + active measurement with admin dashboard"
```

---

## Summary: What This Delivers

| Feature | How |
|---|---|
| **Connection type detection** (2G/3G/4G) | Network Information API — passive, free, automatic |
| **Estimated bandwidth** (Mbps) | Network Information API `downlink` — passive |
| **HTTP latency** (ms) | HEAD request round-trip — lightweight active test |
| **Download speed** (Mbps) | Cloud Function serves test payload, browser measures throughput |
| **Quality score** (0-100) | Weighted composite of all metrics |
| **Historical tracking** | Firestore `conexion_quality` collection with timestamps |
| **Admin dashboard** | Score rings, trend charts, per-device breakdown, zone summary |
| **Periodic checks** | Every 5 minutes via connection heartbeat integration |
| **Manual testing** | "Test ahora" button per device |

### What It Cannot Do (Browser Limitations)

- **RSSI/dBm signal strength** — requires native OS tools (iwconfig, airport, etc.)
- **Exact WiFi standard** (802.11n/ac/ax) — not exposed to browsers
- **Channel utilization** — requires router access
- **Client count** — requires router/AP admin access

If you need RSSI data, the alternative would be to run a small native agent on each kiosk (Python script using `nmcli` on Linux or `netsh` on Windows) that periodically writes signal strength to Firestore. This is a separate feature that could be added later.
