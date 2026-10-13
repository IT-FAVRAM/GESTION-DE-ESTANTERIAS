const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function collectData() {
  const result = {};

  // 1. Get all device connection status
  console.log('Consultando conexion_estado...');
  const statusSnap = await db.collection('conexion_estado').get();
  result.devices = statusSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`  ${result.devices.length} dispositivos encontrados`);

  // 2. Get connection logs (last 30 days)
  console.log('Consultando conexion_logs (ultimos 30 dias)...');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const logsSnap = await db.collection('conexion_logs')
    .where('timestamp', '>=', thirtyDaysAgo)
    .orderBy('timestamp', 'asc')
    .limit(5000)
    .get();
  result.logs = logsSnap.docs.map(doc => doc.data());
  console.log(`  ${result.logs.length} logs encontrados`);

  // 3. Get quality data (if any)
  console.log('Consultando conexion_quality...');
  try {
    const qualitySnap = await db.collection('conexion_quality')
      .orderBy('timestamp', 'desc')
      .limit(500)
      .get();
    result.quality = qualitySnap.docs.map(doc => doc.data());
    console.log(`  ${result.quality.length} muestras de calidad encontradas`);
  } catch (e) {
    console.log('  Coleccion conexion_quality no disponible aun');
    result.quality = [];
  }

  // 4. Get devices collection
  console.log('Consultando dispositivos...');
  const devicesSnap = await db.collection('dispositivos').get();
  result.deviceDocs = devicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`  ${result.deviceDocs.length} documentos de dispositivo`);

  // 5. Compute stats
  console.log('Computando estadisticas...');
  
  // Per-device uptime stats
  const deviceStats = {};
  for (const log of result.logs) {
    const did = log.deviceId;
    if (!deviceStats[did]) {
      deviceStats[did] = {
        deviceId: did,
        deviceName: log.deviceName || did,
        deviceType: log.deviceType || 'UNKNOWN',
        zone: log.zone || null,
        connected: 0,
        disconnected: 0,
        totalOfflineMs: 0,
        events: [],
      };
    }
    const ds = deviceStats[did];
    if (log.event === 'CONNECTED') {
      ds.connected++;
      if (log.offlineDurationMs) ds.totalOfflineMs += log.offlineDurationMs;
    } else {
      ds.disconnected++;
    }
    ds.events.push({ event: log.event, timestamp: log.timestamp, offlineDurationMs: log.offlineDurationMs });
  }

  // Calculate uptime per device
  const periodMs = 30 * 24 * 3600_000;
  for (const did in deviceStats) {
    const ds = deviceStats[did];
    const totalOffline = ds.totalOfflineMs;
    ds.uptimePct = Math.max(0, Math.min(100, ((periodMs - totalOffline) / periodMs) * 100));
    ds.avgOfflineMs = ds.disconnected > 0 ? totalOffline / ds.disconnected : 0;
    ds.maxOfflineMs = Math.max(0, ...ds.events.filter(e => e.offlineDurationMs).map(e => e.offlineDurationMs));
  }

  result.deviceStats = Object.values(deviceStats);

  // Zone stats
  const zoneMap = {};
  for (const ds of result.deviceStats) {
    const z = ds.zone || 'Sin zona';
    if (!zoneMap[z]) zoneMap[z] = { zone: z, devices: 0, totalUptime: 0, totalDisconnections: 0 };
    zoneMap[z].devices++;
    zoneMap[z].totalUptime += ds.uptimePct;
    zoneMap[z].totalDisconnections += ds.disconnected;
  }
  for (const z of Object.values(zoneMap)) {
    z.avgUptime = z.devices > 0 ? z.totalUptime / z.devices : 0;
  }
  result.zoneStats = Object.values(zoneMap).sort((a, b) => a.avgUptime - b.avgUptime);

  // Quality stats
  if (result.quality.length > 0) {
    const qByDevice = {};
    for (const q of result.quality) {
      const did = q.deviceId;
      if (!qByDevice[did]) qByDevice[did] = { deviceId: did, deviceName: q.deviceName, scores: [], bandwidths: [], latencies: [], downloadSpeeds: [] };
      qByDevice[did].scores.push(q.qualityScore);
      if (q.downloadSpeedMbps) qByDevice[did].downloadSpeeds.push(q.downloadSpeedMbps);
      if (q.downlinkMbps) qByDevice[did].bandwidths.push(q.downlinkMbps);
      if (q.httpLatencyMs) qByDevice[did].latencies.push(q.httpLatencyMs);
    }
    for (const qd of Object.values(qByDevice)) {
      qd.avgScore = qd.scores.length > 0 ? Math.round(qd.scores.reduce((a,b)=>a+b,0) / qd.scores.length) : 0;
      qd.avgBandwidth = qd.bandwidths.length > 0 ? (qd.bandwidths.reduce((a,b)=>a+b,0) / qd.bandwidths.length) : 0;
      qd.avgLatency = qd.latencies.length > 0 ? Math.round(qd.latencies.reduce((a,b)=>a+b,0) / qd.latencies.length) : 0;
      qd.avgDownload = qd.downloadSpeeds.length > 0 ? (qd.downloadSpeeds.reduce((a,b)=>a+b,0) / qd.downloadSpeeds.length) : 0;
      qd.sampleCount = qd.scores.length;
    }
    result.qualityStats = Object.values(qByDevice);
  } else {
    result.qualityStats = [];
  }

  // Summary
  const allScores = result.qualityStats.flatMap(q => q.scores);
  result.summary = {
    totalDevices: result.devices.length,
    onlineDevices: result.devices.filter(d => d.isOnline).length,
    offlineDevices: result.devices.filter(d => !d.isOnline).length,
    totalLogs: result.logs.length,
    totalQualitySamples: result.quality.length,
    avgQualityScore: allScores.length > 0 ? Math.round(allScores.reduce((a,b)=>a+b,0) / allScores.length) : null,
    excellentCount: allScores.filter(s => s >= 80).length,
    goodCount: allScores.filter(s => s >= 60 && s < 80).length,
    regularCount: allScores.filter(s => s >= 40 && s < 60).length,
    badCount: allScores.filter(s => s < 40).length,
  };

  // Output
  const outputPath = process.argv[2] || 'firestore_data.json';
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nDatos guardados en: ${outputPath}`);
  console.log(`Resumen: ${result.summary.totalDevices} dispositivos, ${result.summary.totalLogs} logs, ${result.summary.totalQualitySamples} muestras calidad`);

  await admin.app().delete();
}

collectData().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
