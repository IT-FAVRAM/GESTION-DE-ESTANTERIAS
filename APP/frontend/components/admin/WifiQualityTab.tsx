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

  const width = 200;
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - (d.qualityScore / 100) * height,
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
}> = ({ device, stats }) => {
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
          Sin datos de calidad — {device.lastQualityCheck
            ? `Último check: ${new Date(device.lastQualityCheck).toLocaleString('es')}`
            : 'esperando primer check'}
        </div>
      )}

      {stats && stats.qualityHistory.length > 1 && (
        <div className="mt-3">
          <p className="text-[10px] text-slate-600 mb-1">Tendencia 24h</p>
          <QualityMiniChart data={stats.qualityHistory} />
        </div>
      )}
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

const WifiQualityTab: React.FC = () => {
  const [devices, setDevices] = useState<DeviceConnectionStatus[]>([]);
  const [deviceStats, setDeviceStats] = useState<Map<string, DeviceQualityStats>>(new Map());
  const [loadingStats, setLoadingStats] = useState(true);

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

  const loadStats = useCallback(async () => {
    if (devices.length === 0) return;
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

          newStats.set(device.deviceId, {
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            deviceType: device.deviceType,
            zone: device.zone,
            avgQualityScore: Math.round(avg(scores)),
            avgBandwidthMbps: Math.round(avg(bandwidths) * 100) / 100,
            avgLatencyMs: Math.round(avg(latencies)),
            avgDownloadSpeedMbps: Math.round(avg(downloadSpeeds) * 100) / 100,
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
      <div>
        <h2 className="text-xl font-black text-white">Calidad WiFi</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Análisis real de ancho de banda, latencia y calidad de conexión
        </p>
      </div>

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
            />
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-500">
        <p className="font-bold text-slate-400 mb-1">Limitaciones del análisis desde navegador</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>La señal WiFi (RSSI/dBm) no es accesible desde un navegador</li>
          <li>Los resultados dependen del servidor de test y la carga de la red</li>
          <li>Network Information API solo disponible en Chrome/Edge</li>
          <li>Los tests activos consumen ancho de banda — ejecución cada 5 min máximo</li>
        </ul>
      </div>
    </div>
  );
};

export default WifiQualityTab;
