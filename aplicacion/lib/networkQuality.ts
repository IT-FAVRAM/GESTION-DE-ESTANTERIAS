/**
 * WiFi Quality Analysis — Client Library
 *
 * Provides passive (Network Information API) and active (download test)
 * network quality measurement.
 */

// ── Passive: Network Information API ────────────────────────────────────────

interface NetworkInfo {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlink?: number;
  rtt?: number;
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

export interface DownloadTestResult {
  speedMbps: number;
  durationMs: number;
  bytesDownloaded: number;
}

export const measureDownloadSpeed = async (
  testUrl: string,
  targetBytes: number = 256 * 1024,
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

export const computeQualityScore = (input: QualityInput): QualityOutput => {
  let score = 0;
  let factors = 0;

  // Download speed score (0-40)
  if (input.downloadSpeedMbps !== undefined) {
    score += Math.min(40, (input.downloadSpeedMbps / 50) * 40);
    factors++;
  } else if (input.downlinkMbps !== undefined) {
    score += Math.min(40, (input.downlinkMbps / 50) * 40);
    factors++;
  }

  // Latency score (0-30) — lower is better
  const latency = input.httpLatencyMs ?? input.rttMs;
  if (latency !== undefined && latency !== null) {
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

  // Normalize if partial data
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

export const measureFullQuality = async (
  speedTestUrl: string,
  quick: boolean = false,
): Promise<FullQualityResult> => {
  const info = getNetworkInfo();

  const httpLatencyMs = await measureHttpLatency();

  let downloadResult: DownloadTestResult | null = null;
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
