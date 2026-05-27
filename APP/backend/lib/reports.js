"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userPushReport = exports.leadTimeDataset = exports.leadTimeReporting = void 0;
const functions = require("firebase-functions");
const authz_1 = require("./authz");
const firebaseAdmin_1 = require("./firebaseAdmin");
const normalize = (value) => (value || '').trim().toUpperCase();
const toMillis = (value) => {
    if (!value)
        return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
};
exports.leadTimeReporting = functions.https.onCall(async (_data, context) => {
    await (0, authz_1.requireAllowedRoles)(context, ['ADMIN', 'SUPERADMIN']);
    const historySnapshot = await firebaseAdmin_1.admin.firestore().collection('history').orderBy('timestamp', 'asc').limit(5000).get();
    const openCycles = new Map();
    const bySection = new Map();
    const byShelf = new Map();
    historySnapshot.docs.forEach((doc) => {
        var _a, _b, _c, _d;
        const entry = doc.data() || {};
        const action = normalize(entry.action);
        const articleCode = normalize(entry.articleCode);
        const orderFab = normalize(entry.orderFab);
        const timestamp = toMillis(entry.timestamp);
        if (!articleCode || !orderFab || !timestamp)
            return;
        const key = `${articleCode}__${orderFab}`;
        if (action === 'UBICAR')
            return void openCycles.set(key, { startedAt: timestamp, shelfCode: normalize(entry.shelfCode) });
        if (action !== 'RETIRAR')
            return;
        const opened = openCycles.get(key);
        if (!opened || timestamp <= opened.startedAt)
            return;
        const diffDays = (timestamp - opened.startedAt) / (1000 * 60 * 60 * 24);
        const shelfCode = opened.shelfCode || normalize(entry.shelfCode);
        const section = (0, authz_1.getWmsSectionForShelf)(shelfCode);
        bySection.set(section, { totalDays: (((_a = bySection.get(section)) === null || _a === void 0 ? void 0 : _a.totalDays) || 0) + diffDays, count: (((_b = bySection.get(section)) === null || _b === void 0 ? void 0 : _b.count) || 0) + 1 });
        byShelf.set(shelfCode, { totalDays: (((_c = byShelf.get(shelfCode)) === null || _c === void 0 ? void 0 : _c.totalDays) || 0) + diffDays, count: (((_d = byShelf.get(shelfCode)) === null || _d === void 0 ? void 0 : _d.count) || 0) + 1 });
        openCycles.delete(key);
        return;
    });
    const bySectionRows = Array.from(bySection.entries()).map(([section, stats]) => ({ section, completedCycles: stats.count, averageLeadTimeDays: Number((stats.totalDays / stats.count).toFixed(2)) })).sort((a, b) => b.averageLeadTimeDays - a.averageLeadTimeDays);
    const byShelfRows = Array.from(byShelf.entries()).map(([shelfCode, stats]) => ({ shelfCode, completedCycles: stats.count, averageLeadTimeDays: Number((stats.totalDays / stats.count).toFixed(2)) })).sort((a, b) => b.averageLeadTimeDays - a.averageLeadTimeDays);
    const completedCycles = bySectionRows.reduce((sum, row) => sum + row.completedCycles, 0);
    const totalLeadTimeDays = Array.from(bySection.values()).reduce((sum, stats) => sum + stats.totalDays, 0);
    return { generatedAt: new Date().toISOString(), totals: { completedCycles, averageLeadTimeDays: completedCycles > 0 ? Number((totalLeadTimeDays / completedCycles).toFixed(2)) : null }, bySection: bySectionRows, byShelf: byShelfRows };
});
exports.leadTimeDataset = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const role = (0, authz_1.normalizeRole)(context.auth.token.role);
    if (!['ADMIN', 'JEFE_SECCION', 'SUPERADMIN'].includes(role))
        throw new functions.https.HttpsError('permission-denied', 'Only Admins/Jefes can access reports.');
    const { dateFrom, dateTo } = data;
    if (!dateFrom || !dateTo)
        throw new functions.https.HttpsError('invalid-argument', 'Missing date range.');
    const historyRef = firebaseAdmin_1.admin.firestore().collection('history');
    const snapshot = await historyRef.where('timestamp', '>=', dateFrom).where('timestamp', '<=', dateTo).orderBy('timestamp', 'asc').get();
    // Build in-memory maps keyed by barcode to avoid N+1 Firestore queries.
    // Track the most recent 'assigned' event per barcode seen so far, then close
    // the cycle when a 'removed'/'process_finished' event is encountered.
    const lastEntry = new Map();
    const rows = [];
    for (const doc of snapshot.docs) {
        const entry = doc.data();
        const { barcode, action, timestamp, orderId } = entry;
        if (!barcode || !timestamp)
            continue;
        if (action === 'assigned') {
            lastEntry.set(barcode, { timestamp, orderId: orderId || 'N/A' });
            continue;
        }
        if (action === 'removed' || action === 'process_finished') {
            const entryEvent = lastEntry.get(barcode);
            if (!entryEvent)
                continue;
            rows.push({
                barcode,
                orderId: orderId || entryEvent.orderId,
                entryDate: entryEvent.timestamp,
                exitDate: timestamp,
                durationDays: (new Date(timestamp).getTime() - new Date(entryEvent.timestamp).getTime()) / (1000 * 60 * 60 * 24),
            });
            lastEntry.delete(barcode);
            if (rows.length >= 500)
                break;
        }
    }
    return { rows };
});
exports.userPushReport = functions.https.onCall(async (_data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const role = (0, authz_1.normalizeRole)(context.auth.token.role);
    if (!['ADMIN', 'SUPERADMIN'].includes(role))
        throw new functions.https.HttpsError('permission-denied', 'Only Admins can access this report.');
    const snapshot = await firebaseAdmin_1.admin.firestore().collection('usuarios').get();
    if (snapshot.empty) {
        return { totalUsers: 0, activeUsers: 0, activeWithFcmTokens: 0, roleCounts: {} };
    }
    let totalUsers = 0;
    let activeUsers = 0;
    let activeWithFcmTokens = 0;
    const roleCounts = {};
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
//# sourceMappingURL=reports.js.map