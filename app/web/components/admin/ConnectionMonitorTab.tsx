import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { DeviceConnectionStatus, ConnectionLogEntry } from '../../lib/schema/connectionStatus';

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatRelativeTime = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 30_000) return 'Ahora';
  if (ms < 3_600_000) return `Hace ${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `Hace ${h}h ${m}m`;
  }
  return `Hace ${Math.floor(ms / 86_400_000)}d`;
};

const formatDuration = (ms: number): string => {
  if (ms < 1_000) return '<1s';
  const s = Math.floor(ms / 1_000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const formatDurationShort = (ms: number): string => {
  if (ms < 60_000) return `${Math.floor(ms / 1_000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
};

const deviceTypeLabel: Record<string, string> = {
  KIOSK: 'Kiosko',
  CARRETILLERO: 'Carretillero',
  ADMIN: 'Admin',
  UNKNOWN: 'Desconocido',
};

const deviceTypeIcon: Record<string, string> = {
  KIOSK: '📟',
  CARRETILLERO: '🔧',
  ADMIN: '💻',
  UNKNOWN: '❓',
};

type OnlineStatus = 'online' | 'uncertain' | 'offline';

const getOnlineStatus = (device: DeviceConnectionStatus): OnlineStatus => {
  if (!device.isOnline) return 'offline';
  const msSinceSeen = Date.now() - new Date(device.lastSeen).getTime();
  if (msSinceSeen > 300_000) return 'offline'; // > 5 min = consider offline
  if (msSinceSeen > 120_000) return 'uncertain'; // > 2 min = uncertain
  return 'online';
};

// ── Timeline Types ───────────────────────────────────────────────────────────

interface TimeSegment {
  state: 'online' | 'offline';
  startMs: number;
  endMs: number;
  durationMs: number;
}

interface DeviceStats {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  uptimePct: number;
  disconnections: number;
  avgOfflineDurationMs: number;
  maxOfflineDurationMs: number;
  totalOfflineMs: number;
  segments: TimeSegment[];
}

const processLogs = (
  logs: ConnectionLogEntry[],
  startMs: number,
  endMs: number,
): TimeSegment[] => {
  const sorted = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const segments: TimeSegment[] = [];
  let state: 'online' | 'offline' = 'online';
  let segStart = startMs;

  for (const log of sorted) {
    const ts = new Date(log.timestamp).getTime();
    if (ts <= startMs || ts > endMs) continue;

    const dur = ts - segStart;
    if (dur > 0) segments.push({ state, startMs: segStart, endMs: ts, durationMs: dur });

    segStart = ts;
    state = log.event === 'DISCONNECTED' ? 'offline' : 'online';
  }

  const finalEnd = Math.min(endMs, Date.now());
  const finalDur = finalEnd - segStart;
  if (finalDur > 0) segments.push({ state, startMs: segStart, endMs: finalEnd, durationMs: finalDur });

  return segments;
};

const computeStats = (
  logs: ConnectionLogEntry[],
  deviceId: string,
  deviceName: string,
  deviceType: string,
  startMs: number,
  endMs: number,
): DeviceStats => {
  const deviceLogs = logs.filter((l) => l.deviceId === deviceId);
  const segments = processLogs(deviceLogs, startMs, endMs);
  const totalMs = Math.min(endMs, Date.now()) - startMs;

  const offlineSegs = segments.filter((s) => s.state === 'offline');
  const totalOfflineMs = offlineSegs.reduce((sum, s) => sum + s.durationMs, 0);
  const disconnections = offlineSegs.length;
  const avgOfflineDurationMs = disconnections > 0 ? totalOfflineMs / disconnections : 0;
  const maxOfflineDurationMs = offlineSegs.length > 0
    ? Math.max(...offlineSegs.map((s) => s.durationMs))
    : 0;
  const uptimePct = totalMs > 0 ? ((totalMs - totalOfflineMs) / totalMs) * 100 : 100;

  return { deviceId, deviceName, deviceType, uptimePct, disconnections, avgOfflineDurationMs, maxOfflineDurationMs, totalOfflineMs, segments };
};

// ── Sub-components ──────────────────────────────────────────────────────────

const StatusDot: React.FC<{ status: OnlineStatus }> = ({ status }) => {
  if (status === 'online') {
    return (
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
      </span>
    );
  }
  if (status === 'uncertain') {
    return (
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
      </span>
    );
  }
  return <span className="h-3 w-3 rounded-full bg-red-500" />;
};

const DeviceCard: React.FC<{ device: DeviceConnectionStatus }> = ({ device }) => {
  const status = getOnlineStatus(device);
  const offlineMs = device.lastDisconnectedAt
    ? Date.now() - new Date(device.lastDisconnectedAt).getTime()
    : 0;

  const borderColor = status === 'online'
    ? 'border-emerald-500/20 bg-emerald-500/5'
    : status === 'uncertain'
      ? 'border-amber-500/20 bg-amber-500/5'
      : 'border-red-500/20 bg-red-500/5';

  const statusLabel = status === 'online' ? 'En línea'
    : status === 'uncertain' ? 'Incierto'
    : 'Sin conexión';

  const statusColor = status === 'online' ? 'text-emerald-400'
    : status === 'uncertain' ? 'text-amber-400'
    : 'text-red-400';

  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${borderColor} bg-slate-900 transition-all`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{deviceTypeIcon[device.deviceType] || '❓'}</span>
          <div>
            <p className="font-bold text-white text-sm leading-tight">{device.deviceName}</p>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              {deviceTypeLabel[device.deviceType] || device.deviceType}
            </span>
          </div>
        </div>
        <StatusDot status={status} />
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold ${statusColor}`}>{statusLabel}</span>
        {status === 'offline' && device.lastDisconnectedAt && offlineMs > 5_000 && (
          <span className="text-xs text-red-400/70">· {formatDuration(offlineMs)}</span>
        )}
      </div>

      <div className="text-xs text-slate-500 space-y-1">
        <div className="flex justify-between">
          <span>Última vez</span>
          <span className="text-slate-400 font-medium">{formatRelativeTime(device.lastSeen)}</span>
        </div>
        {device.lastConnectedAt && (
          <div className="flex justify-between">
            <span>Conectado</span>
            <span className="text-slate-400 font-medium">{formatRelativeTime(device.lastConnectedAt)}</span>
          </div>
        )}
        {device.lastOfflineDurationMs !== undefined && device.lastOfflineDurationMs > 5_000 && (
          <div className="flex justify-between">
            <span>Última desconexión</span>
            <span className="text-amber-400/80 font-medium">{formatDuration(device.lastOfflineDurationMs)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Device ID</span>
          <span className="text-slate-600 font-mono text-[10px]">{device.deviceId.slice(-8)}</span>
        </div>
      </div>
    </div>
  );
};

const UptimeBadge: React.FC<{ pct: number }> = ({ pct }) => {
  const color = pct >= 99 ? 'text-emerald-400' : pct >= 95 ? 'text-amber-400' : 'text-red-400';
  return <span className={`font-bold text-sm ${color}`}>{pct.toFixed(1)}%</span>;
};

const TimelineBar: React.FC<{ segments: TimeSegment[]; totalMs: number }> = ({ segments, totalMs }) => {
  if (segments.length === 0) {
    return (
      <div className="h-3 rounded-full bg-slate-800 flex items-center justify-center">
        <span className="text-[10px] text-slate-600">Sin datos</span>
      </div>
    );
  }

  return (
    <div className="h-3 rounded-full overflow-hidden flex bg-slate-800" title="Verde=en línea · Rojo=sin conexión">
      {segments.map((seg, i) => {
        const widthPct = Math.max((seg.durationMs / totalMs) * 100, 0.15);
        return (
          <div
            key={i}
            className={seg.state === 'online' ? 'bg-emerald-500' : 'bg-red-500'}
            style={{ width: `${widthPct}%` }}
            title={`${seg.state === 'online' ? 'En línea' : 'Desconectado'}: ${formatDuration(seg.durationMs)}`}
          />
        );
      })}
    </div>
  );
};

// ── Date range options ───────────────────────────────────────────────────────

type DateRange = '1d' | '7d' | '30d';

const dateRangeMs: Record<DateRange, number> = {
  '1d': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
};

const dateRangeLabel: Record<DateRange, string> = {
  '1d': 'Últimas 24h',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
};

// ── Tick labels for timeline ─────────────────────────────────────────────────

const TimelineRuler: React.FC<{ range: DateRange; startMs: number }> = ({ range, startMs }) => {
  const ticks = range === '1d' ? 6 : range === '7d' ? 7 : 6;
  const totalMs = dateRangeMs[range];
  const stepMs = totalMs / ticks;

  return (
    <div className="flex justify-between mt-1">
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const tickMs = startMs + i * stepMs;
        const d = new Date(tickMs);
        const label = range === '1d'
          ? d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
        return (
          <span key={i} className="text-[10px] text-slate-600" style={{ width: `${100 / ticks}%`, textAlign: i === 0 ? 'left' : i === ticks ? 'right' : 'center' }}>
            {label}
          </span>
        );
      })}
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

type ViewMode = 'live' | 'analysis';

const ConnectionMonitorTab: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('live');
  const [devices, setDevices] = useState<DeviceConnectionStatus[]>([]);
  const [logs, setLogs] = useState<ConnectionLogEntry[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Force re-render every 30s to keep relative times fresh
  useEffect(() => {
    refreshTimer.current = setInterval(() => setLastRefresh(Date.now()), 30_000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, []);

  // Subscribe to live device status
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.CONNECTION_STATUS),
      (snap) => {
        const docs = snap.docs.map((d) => ({ ...(d.data() as DeviceConnectionStatus) }));
        // Sort: online first, then by last seen desc
        docs.sort((a, b) => {
          const sa = getOnlineStatus(a);
          const sb = getOnlineStatus(b);
          const order: Record<OnlineStatus, number> = { online: 0, uncertain: 1, offline: 2 };
          if (order[sa] !== order[sb]) return order[sa] - order[sb];
          return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
        });
        setDevices(docs);
      },
      (err) => console.error('[ConnectionMonitor] status subscription error', err),
    );
    return () => unsubscribe();
  }, []);

  // Load historical logs when date range changes or entering analysis mode
  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const startMs = Date.now() - dateRangeMs[dateRange];
      const startIso = new Date(startMs).toISOString();

      const q = query(
        collection(db, COLLECTIONS.CONNECTION_LOGS),
        where('timestamp', '>=', startIso),
        orderBy('timestamp', 'asc'),
        limit(2000),
      );
      const snap = await getDocs(q);
      setLogs(snap.docs.map((d) => d.data() as ConnectionLogEntry));
    } catch (err) {
      console.error('[ConnectionMonitor] log query error', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (viewMode === 'analysis') loadLogs();
  }, [viewMode, loadLogs]);

  // Derive stats per device for analysis view
  const devicesForAnalysis = useMemo(() => {
    const startMs = Date.now() - dateRangeMs[dateRange];
    const endMs = Date.now();

    // Collect unique device IDs from both live status and logs
    const deviceMap = new Map<string, { name: string; type: string }>();
    devices.forEach((d) => deviceMap.set(d.deviceId, { name: d.deviceName, type: d.deviceType }));
    logs.forEach((l) => {
      if (!deviceMap.has(l.deviceId)) {
        deviceMap.set(l.deviceId, { name: l.deviceName, type: l.deviceType });
      }
    });

    return Array.from(deviceMap.entries()).map(([deviceId, meta]) =>
      computeStats(logs, deviceId, meta.name, meta.type, startMs, endMs),
    ).sort((a, b) => b.uptimePct - a.uptimePct);
  }, [devices, logs, dateRange, lastRefresh]);

  // Summary counters
  const onlineCount = devices.filter((d) => getOnlineStatus(d) === 'online').length;
  const uncertainCount = devices.filter((d) => getOnlineStatus(d) === 'uncertain').length;
  const offlineCount = devices.filter((d) => getOnlineStatus(d) === 'offline').length;
  const total = devices.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Monitor de Conexiones</h2>
          <p className="text-sm text-slate-400 mt-0.5">Supervisión wifi en tiempo real de todos los dispositivos</p>
        </div>

        {/* Summary pills */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-bold text-emerald-400">{onlineCount} en línea</span>
          </div>
          {uncertainCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-sm font-bold text-amber-400">{uncertainCount} inciertos</span>
            </div>
          )}
          {offlineCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-sm font-bold text-red-400">{offlineCount} sin conexión</span>
            </div>
          )}
          {total === 0 && (
            <div className="text-sm text-slate-500 px-3 py-1.5">Sin dispositivos registrados</div>
          )}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-0">
        <button
          onClick={() => setViewMode('live')}
          className={`px-4 py-2 text-sm font-bold rounded-t-xl border-b-2 transition-colors ${
            viewMode === 'live'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          🔴 En vivo
        </button>
        <button
          onClick={() => setViewMode('analysis')}
          className={`px-4 py-2 text-sm font-bold rounded-t-xl border-b-2 transition-colors ${
            viewMode === 'analysis'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          📊 Análisis
        </button>
      </div>

      {/* ── LIVE VIEW ────────────────────────────────────────────────────── */}
      {viewMode === 'live' && (
        <>
          {total === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-12 text-center">
              <p className="text-4xl mb-4">📡</p>
              <h3 className="text-lg font-bold text-white mb-2">Sin dispositivos registrados</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                Los kioskos y dispositivos empezarán a aparecer aquí automáticamente cuando estén en uso.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {devices.map((device) => (
                <DeviceCard key={device.authUid} device={device} />
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              En línea (heartbeat &lt; 2 min)
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              </span>
              Incierto (heartbeat 2-5 min)
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              Sin conexión (&gt; 5 min o desconexión notificada)
            </div>
          </div>
        </>
      )}

      {/* ── ANALYSIS VIEW ────────────────────────────────────────────────── */}
      {viewMode === 'analysis' && (
        <div className="space-y-6">
          {/* Date range selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400 font-medium">Periodo:</span>
            {(['1d', '7d', '30d'] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                  dateRange === r
                    ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300'
                    : 'border border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
              >
                {dateRangeLabel[r]}
              </button>
            ))}
            <button
              onClick={loadLogs}
              className="ml-auto px-3 py-1.5 rounded-lg text-sm font-bold text-slate-400 border border-slate-700 hover:bg-slate-800 transition-colors"
              title="Recargar datos"
            >
              ↻ Actualizar
            </button>
          </div>

          {loadingLogs ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : devicesForAnalysis.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-12 text-center">
              <p className="text-4xl mb-4">📊</p>
              <h3 className="text-lg font-bold text-white mb-2">Sin datos históricos</h3>
              <p className="text-sm text-slate-400">
                Los registros aparecerán a medida que los dispositivos se conecten y desconecten.
              </p>
            </div>
          ) : (
            <>
              {/* Timeline section */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 space-y-4">
                <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">
                  Disponibilidad — {dateRangeLabel[dateRange]}
                </h3>
                <div className="space-y-4">
                  {devicesForAnalysis.map((stats) => (
                    <div key={stats.deviceId}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm">{deviceTypeIcon[stats.deviceType] || '❓'}</span>
                          <span className="text-sm font-bold text-white truncate">{stats.deviceName}</span>
                          <span className="text-[10px] text-slate-600 shrink-0">
                            {stats.deviceId.slice(-6)}
                          </span>
                        </div>
                        <UptimeBadge pct={stats.uptimePct} />
                      </div>
                      <TimelineBar
                        segments={stats.segments}
                        totalMs={dateRangeMs[dateRange]}
                      />
                    </div>
                  ))}
                </div>
                <TimelineRuler range={dateRange} startMs={Date.now() - dateRangeMs[dateRange]} />
              </div>

              {/* Stats table */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800">
                  <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">
                    Estadísticas detalladas
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Dispositivo</th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Uptime</th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Desconexiones</th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Duración media</th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Mayor caída</th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tiempo offline</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {devicesForAnalysis.map((stats) => (
                        <tr key={stats.deviceId} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span>{deviceTypeIcon[stats.deviceType] || '❓'}</span>
                              <div>
                                <p className="font-bold text-white">{stats.deviceName}</p>
                                <p className="text-[11px] text-slate-600">
                                  {deviceTypeLabel[stats.deviceType] || stats.deviceType}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <UptimeBadge pct={stats.uptimePct} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold ${stats.disconnections === 0 ? 'text-emerald-400' : stats.disconnections <= 3 ? 'text-amber-400' : 'text-red-400'}`}>
                              {stats.disconnections}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">
                            {stats.disconnections > 0 ? formatDurationShort(stats.avgOfflineDurationMs) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-mono text-xs ${stats.maxOfflineDurationMs > 300_000 ? 'text-red-400' : stats.maxOfflineDurationMs > 60_000 ? 'text-amber-400' : 'text-slate-400'}`}>
                              {stats.maxOfflineDurationMs > 0 ? formatDurationShort(stats.maxOfflineDurationMs) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500 font-mono text-xs">
                            {stats.totalOfflineMs > 0 ? formatDurationShort(stats.totalOfflineMs) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Incidents list — last 10 disconnections */}
              <IncidentLog logs={logs} />
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Incident Log ─────────────────────────────────────────────────────────────

const IncidentLog: React.FC<{ logs: ConnectionLogEntry[] }> = ({ logs }) => {
  const incidents = useMemo(() => {
    return [...logs]
      .filter((l) => l.event === 'DISCONNECTED')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);
  }, [logs]);

  if (incidents.length === 0) return null;

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">
          Últimas desconexiones
        </h3>
        <span className="text-xs text-slate-600">{incidents.length} eventos</span>
      </div>
      <div className="divide-y divide-slate-800/50">
        {incidents.map((log, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/20">
            <span className="text-red-400 text-sm">⚡</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white truncate">{log.deviceName}</span>
                <span className="text-[10px] text-slate-600 shrink-0">
                  {deviceTypeIcon[log.deviceType] || '❓'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {new Date(log.timestamp).toLocaleString('es', {
                  day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <span className="text-xs text-slate-500 font-medium shrink-0">
              {formatRelativeTime(log.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConnectionMonitorTab;
