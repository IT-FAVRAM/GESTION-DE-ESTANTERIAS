import * as functions from 'firebase-functions';
import { requireAllowedRoles, getWmsSectionForShelf, normalizeRole } from './authz';
import { admin } from './firebaseAdmin';

const normalize = (value?: string | null) => (value || '').trim().toUpperCase();

const toMillis = (value?: string | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

export const leadTimeReporting = functions.https.onCall(async (_data: any, context: any) => {
  await requireAllowedRoles(context, ['ADMIN', 'SUPERADMIN']);
  const historySnapshot = await admin.firestore().collection('history').orderBy('timestamp', 'asc').limit(5000).get();
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
    if (action === 'UBICAR') return void openCycles.set(key, { startedAt: timestamp, shelfCode: normalize(entry.shelfCode) });
    if (action !== 'RETIRAR') return;
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
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  const role = normalizeRole(context.auth.token.role as string);
  if (!['ADMIN', 'JEFE_SECCION', 'SUPERADMIN'].includes(role)) throw new functions.https.HttpsError('permission-denied', 'Only Admins/Jefes can access reports.');
  const { dateFrom, dateTo } = data;
  if (!dateFrom || !dateTo) throw new functions.https.HttpsError('invalid-argument', 'Missing date range.');
  const historyRef = admin.firestore().collection('history');
  const snapshot = await historyRef.where('timestamp', '>=', dateFrom).where('timestamp', '<=', dateTo).orderBy('timestamp', 'asc').get();

  // Build in-memory maps keyed by barcode to avoid N+1 Firestore queries.
  // Track the most recent 'assigned' event per barcode seen so far, then close
  // the cycle when a 'removed'/'process_finished' event is encountered.
  const lastEntry = new Map<string, { timestamp: string; orderId: string }>();
  const rows = [];

  for (const doc of snapshot.docs) {
    const entry = doc.data() as any;
    const { barcode, action, timestamp, orderId } = entry;
    if (!barcode || !timestamp) continue;

    if (action === 'assigned') {
      lastEntry.set(barcode, { timestamp, orderId: orderId || 'N/A' });
      continue;
    }

    if (action === 'removed' || action === 'process_finished') {
      const entryEvent = lastEntry.get(barcode);
      if (!entryEvent) continue;
      rows.push({
        barcode,
        orderId: orderId || entryEvent.orderId,
        entryDate: entryEvent.timestamp,
        exitDate: timestamp,
        durationDays: (new Date(timestamp).getTime() - new Date(entryEvent.timestamp).getTime()) / (1000 * 60 * 60 * 24),
      });
      lastEntry.delete(barcode);
      if (rows.length >= 500) break;
    }
  }

  return { rows };
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
