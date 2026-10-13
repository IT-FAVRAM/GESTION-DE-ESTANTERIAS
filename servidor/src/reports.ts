import * as functions from 'firebase-functions';
import { requireAllowedRoles, getWmsSectionForShelf, normalizeRole } from './authz';
import { admin } from './firebaseAdmin';

const normalize = (value?: string | null) => (value || '').trim().toUpperCase();

const toMillis = (value?: string | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

// Acciones que ABREN un ciclo (artículo entra/permanece en estantería) y que lo
// CIERRAN (artículo sale). Compartidas por el agregado y el dataset detallado para
// que KPIs y tabla provengan EXACTAMENTE de la misma fuente (historial real
// UBICAR/RETIRAR), no del módulo de producción (assigned/removed) que apenas se usa.
const OPEN_ACTIONS = new Set(['UBICAR', 'UBICAR_MULTI']);
const CLOSE_ACTIONS = new Set(['RETIRAR', 'RETIRAR_DE_UBICACION']);

export const leadTimeReporting = functions.https.onCall(async (_data: any, context: any) => {
  await requireAllowedRoles(context, ['ADMIN', 'SUPERADMIN', 'JEFE_SECCION']);
  const historySnapshot = await admin.firestore().collection('history').orderBy('timestamp', 'asc').limit(8000).get();
  const openCycles = new Map<string, { startedAt: number; shelfCode: string }>();
  const bySection = new Map<string, { totalDays: number; count: number }>();
  const byShelf = new Map<string, { totalDays: number; count: number }>();
  historySnapshot.docs.forEach((doc: any) => {
    const entry = doc.data() || {};
    const action = normalize(entry.action);
    const articleCode = normalize(entry.articleCode);
    const orderFab = normalize(entry.orderFab);
    const timestamp = toMillis(entry.timestamp);
    if (!articleCode || !orderFab || !timestamp) return;
    const key = `${articleCode}__${orderFab}`;
    if (OPEN_ACTIONS.has(action)) return void openCycles.set(key, { startedAt: timestamp, shelfCode: normalize(entry.shelfCode) });
    if (!CLOSE_ACTIONS.has(action)) return;
    const opened = openCycles.get(key);
    if (!opened || timestamp <= opened.startedAt) return;
    const diffDays = (timestamp - opened.startedAt) / (1000 * 60 * 60 * 24);
    const shelfCode = opened.shelfCode || normalize(entry.shelfCode);
    const section = getWmsSectionForShelf(shelfCode);
    bySection.set(section, { totalDays: (bySection.get(section)?.totalDays || 0) + diffDays, count: (bySection.get(section)?.count || 0) + 1 });
    byShelf.set(shelfCode, { totalDays: (byShelf.get(shelfCode)?.totalDays || 0) + diffDays, count: (byShelf.get(shelfCode)?.count || 0) + 1 });
    openCycles.delete(key);
    return;
  });
  const bySectionRows = Array.from(bySection.entries()).map(([section, stats]) => ({ section, completedCycles: stats.count, averageLeadTimeDays: Number((stats.totalDays / stats.count).toFixed(2)) })).sort((a, b) => b.averageLeadTimeDays - a.averageLeadTimeDays);
  const byShelfRows = Array.from(byShelf.entries()).map(([shelfCode, stats]) => ({ shelfCode, completedCycles: stats.count, averageLeadTimeDays: Number((stats.totalDays / stats.count).toFixed(2)) })).sort((a, b) => b.averageLeadTimeDays - a.averageLeadTimeDays);
  const completedCycles = bySectionRows.reduce((sum, row) => sum + row.completedCycles, 0);
  const totalLeadTimeDays = Array.from(bySection.values()).reduce((sum, stats) => sum + stats.totalDays, 0);
  return { generatedAt: new Date().toISOString(), totals: { completedCycles, averageLeadTimeDays: completedCycles > 0 ? Number((totalLeadTimeDays / completedCycles).toFixed(2)) : null }, bySection: bySectionRows, byShelf: byShelfRows };
});

export const leadTimeDataset = functions.https.onCall(async (data: any, context: any) => {
  // Autorización robusta: usa la ficha de `usuarios` como fallback. Antes leía
  // SOLO el claim `token.role`, que muchos admins (login por email) no tienen
  // seteado → permission-denied. Por eso "no funcionaba para admins".
  await requireAllowedRoles(context, ['ADMIN', 'SUPERADMIN', 'JEFE_SECCION']);

  const { dateFrom, dateTo } = data || {};
  if (!dateFrom || !dateTo) throw new functions.https.HttpsError('invalid-argument', 'Falta el rango de fechas.');
  const fromMs = toMillis(dateFrom);
  const toMs = toMillis(dateTo);
  if (fromMs === null || toMs === null) throw new functions.https.HttpsError('invalid-argument', 'Rango de fechas inválido.');

  // Cogemos los eventos MÁS RECIENTES hasta `dateTo` (desc + reverse a asc) para
  // capturar también el UBICAR de artículos colocados antes del rango pero que
  // salieron dentro de él. Acotado para no leer todo el historial.
  const snapshot = await admin.firestore().collection('history')
    .where('timestamp', '<=', dateTo)
    .orderBy('timestamp', 'desc')
    .limit(20000)
    .get();
  const docsAsc = snapshot.docs.slice().reverse();

  // Ciclo = UBICAR/UBICAR_MULTI (entrada) → RETIRAR/RETIRAR_DE_UBICACION (salida),
  // por artículo+OF. Misma lógica que el agregado leadTimeReporting.
  const openCycles = new Map<string, { startedAt: number; shelfCode: string }>();
  const rows: Array<{
    barcode: string; orderId: string; entryDate: string; exitDate: string;
    durationDays: number; shelfCode: string; section: string;
  }> = [];

  for (const doc of docsAsc) {
    const entry = doc.data() as any;
    const action = normalize(entry.action);
    const articleCode = normalize(entry.articleCode);
    const orderFab = normalize(entry.orderFab);
    const ts = toMillis(entry.timestamp);
    if (!articleCode || !orderFab || ts === null) continue;
    const key = `${articleCode}__${orderFab}`;

    if (OPEN_ACTIONS.has(action)) {
      openCycles.set(key, { startedAt: ts, shelfCode: normalize(entry.shelfCode) });
      continue;
    }
    if (!CLOSE_ACTIONS.has(action)) continue;

    const opened = openCycles.get(key);
    if (!opened || ts <= opened.startedAt) continue;
    openCycles.delete(key);
    // Solo filas cuya SALIDA cae dentro del rango solicitado.
    if (ts < fromMs || ts > toMs) continue;

    const shelfCode = opened.shelfCode || normalize(entry.shelfCode);
    rows.push({
      barcode: entry.articleCode || articleCode,
      orderId: entry.orderFab || orderFab,
      entryDate: new Date(opened.startedAt).toISOString(),
      exitDate: new Date(ts).toISOString(),
      durationDays: Number(((ts - opened.startedAt) / (1000 * 60 * 60 * 24)).toFixed(2)),
      shelfCode,
      section: getWmsSectionForShelf(shelfCode),
    });
  }

  rows.sort((a, b) => b.durationDays - a.durationDays);
  return { rows, generatedAt: new Date().toISOString() };
});

export const userPushReport = functions.https.onCall(async (_data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  const role = normalizeRole(context.auth.token.role as string);
  if (!['ADMIN', 'SUPERADMIN'].includes(role)) throw new functions.https.HttpsError('permission-denied', 'Only Admins can access this report.');
  
  const snapshot = await admin.firestore().collection('usuarios').get();
  
  if (snapshot.empty) {
    return { totalUsers: 0, activeUsers: 0, activeWithFcmTokens: 0, roleCounts: {} };
  }
  
  let totalUsers = 0;
  let activeUsers = 0;
  let activeWithFcmTokens = 0;
  const roleCounts: Record<string, number> = {};
  
  snapshot.forEach((doc) => {
    totalUsers++;
    const userData = doc.data();
    const userRole = userData.role || 'unknown';
    roleCounts[userRole] = (roleCounts[userRole] || 0) + 1;
    const isActive = userData.active !== false;
    if (isActive) {
      activeUsers++;
      const fcmTokens = userData.fcmTokens || [];
      if (Array.isArray(fcmTokens) && fcmTokens.length > 0) {
        activeWithFcmTokens++;
      }
    }
  });
  
  return {
    generatedAt: new Date().toISOString(),
    totalUsers,
    activeUsers,
    activeWithFcmTokens,
    activeWithoutFcmTokens: activeUsers - activeWithFcmTokens,
    roleCounts,
  };
});
