"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickupQueueOperate = exports.notifyLongDisconnection = exports.notifyConnectionDisconnect = exports.notifyCarretilleroRequest = exports.notifySpecialLocationOccupancy = exports.notifyPickupQueueCreated = exports.checkStaleItems = void 0;
const functions = require("firebase-functions");
const firebaseAdmin_1 = require("./firebaseAdmin");
const authz_1 = require("./authz");
const push_1 = require("./push");
const normalize = (value) => (value || '').trim().toUpperCase();
const STALE_ITEM_THRESHOLD_DAYS = 5;
const STALE_ITEM_ALERT_INTERVAL_HOURS = 48;
const toMillis = (value) => {
    if (!value)
        return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
};
const parseLocationPosition = (position) => {
    const parsed = Number.parseInt(String(position || '').replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(parsed) ? null : parsed;
};
const getAddedLocationItems = (beforeData, afterData) => {
    const beforeItems = Array.isArray(beforeData === null || beforeData === void 0 ? void 0 : beforeData.items) ? beforeData.items : [];
    const afterItems = Array.isArray(afterData === null || afterData === void 0 ? void 0 : afterData.items) ? afterData.items : [];
    const beforeKeys = new Set(beforeItems.map((item) => `${normalize(item === null || item === void 0 ? void 0 : item.articleCode)}__${normalize(item === null || item === void 0 ? void 0 : item.orderFab)}__${normalize(item === null || item === void 0 ? void 0 : item.locatedAt)}`));
    return afterItems.filter((item) => !beforeKeys.has(`${normalize(item === null || item === void 0 ? void 0 : item.articleCode)}__${normalize(item === null || item === void 0 ? void 0 : item.orderFab)}__${normalize(item === null || item === void 0 ? void 0 : item.locatedAt)}`));
};
exports.checkStaleItems = functions.pubsub.schedule('every 24 hours').timeZone('Europe/Madrid').onRun(async () => {
    const itemsSnapshot = await firebaseAdmin_1.admin.firestore().collection('items').where('active', '==', true).get();
    const config = await (0, push_1.getAppConfig)();
    const chiefMapping = config.chiefMapping || {};
    const now = Date.now();
    const staleLimitMs = STALE_ITEM_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    const alertIntervalMs = STALE_ITEM_ALERT_INTERVAL_HOURS * 60 * 60 * 1000;
    let notifiedItems = 0;
    for (const itemDoc of itemsSnapshot.docs) {
        const item = itemDoc.data() || {};
        const locatedAtMs = toMillis(item.locatedAt);
        if (!locatedAtMs || now - locatedAtMs < staleLimitMs)
            continue;
        const lastAlertAtMs = toMillis(item.lastAlertAt);
        if (lastAlertAtMs && now - lastAlertAtMs < alertIntervalMs)
            continue;
        const shelfCode = normalize(item.shelfCode);
        const section = (0, authz_1.getWmsSectionForShelf)(shelfCode);
        const emails = Array.isArray(chiefMapping[section]) ? chiefMapping[section] : [];
        const userDocs = await (0, push_1.getUsersByEmails)(emails);
        const notificationResult = await (0, push_1.sendPushToUsers)(userDocs, {
            title: 'Articulo estancado en estanteria',
            body: `${item.articleCode || 'Articulo'} ${item.orderFab || ''} lleva ${Math.floor((now - locatedAtMs) / (1000 * 60 * 60 * 24))} dias en ${Array.isArray(item.locationIds) ? item.locationIds.join(', ') : shelfCode}`.trim(),
            data: { type: 'STALE_ITEM_ALERT', shelfCode, articleCode: String(item.articleCode || ''), orderFab: String(item.orderFab || '') },
        });
        if (notificationResult.successCount > 0 || userDocs.length === 0) {
            await itemDoc.ref.update({ lastAlertAt: new Date(now).toISOString() });
            notifiedItems += 1;
        }
    }
    return { notifiedItems };
});
exports.notifyPickupQueueCreated = functions.firestore
    .document('pickupQueue/{requestId}')
    .onCreate(async (snapshot, context) => {
    const data = snapshot.data() || {};
    const shelfSection = String(data.shelfSection || 'OTROS');
    const shelfName = String(data.shelfName || data.shelfCode || 'estanteria');
    const operarioId = String(data.operarioId || '---');
    await (0, push_1.notifyUsersByRole)('CARRETILLERO', {
        title: 'Nueva solicitud de recogida',
        body: `Operario ${operarioId} solicita recogida en ${shelfSection} (${shelfName}).`,
        data: { type: 'PICKUP_QUEUE_CREATED', requestId: String(context.params.requestId || ''), shelfCode: String(data.shelfCode || ''), shelfSection },
    });
    return null;
});
exports.notifySpecialLocationOccupancy = functions.firestore
    .document('shelves/{shelfCode}/locations/{position}')
    .onWrite(async (change, context) => {
    if (!change.after.exists)
        return null;
    const shelfCode = normalize(context.params.shelfCode);
    const position = parseLocationPosition(context.params.position);
    if (!position)
        return null;
    const config = await (0, push_1.getAppConfig)();
    const urgentLocations = Array.isArray(config.urgentLocations) ? config.urgentLocations : [];
    const techReviewLocations = Array.isArray(config.techReviewLocations) ? config.techReviewLocations : [];
    const locationId = `${shelfCode}-${String(context.params.position).padStart(3, '0')}`;
    const isUrgent = urgentLocations.includes(locationId);
    const isTechReview = techReviewLocations.includes(locationId);
    if (!isUrgent && !isTechReview)
        return null;
    const addedItems = getAddedLocationItems(change.before.data(), change.after.data());
    if (addedItems.length === 0)
        return null;
    const chiefMapping = config.chiefMapping || {};
    const qualityEmails = Array.isArray(config.qualityEmails) ? config.qualityEmails : [];
    const section = (0, authz_1.getWmsSectionForShelf)(shelfCode);
    const firstItem = addedItems[0] || {};
    const articleCode = String(firstItem.articleCode || 'Articulo');
    const orderFab = String(firstItem.orderFab || '');
    if (isTechReview) {
        await (0, push_1.notifyUsersByEmails)(qualityEmails, {
            title: 'Articulo pendiente de revision tecnica',
            body: `${articleCode} ${orderFab} ha sido ubicado en ${locationId}.`.trim(),
            data: { type: 'TECH_REVIEW_LOCATION', shelfCode, locationId, articleCode, orderFab },
        });
    }
    if (isUrgent) {
        const chiefEmails = Array.isArray(chiefMapping[section]) ? chiefMapping[section] : [];
        await Promise.all([
            (0, push_1.notifyUsersByEmails)(chiefEmails, {
                title: 'Articulo urgente ubicado',
                body: `${articleCode} ${orderFab} ha sido ubicado en ${locationId}.`.trim(),
                data: { type: 'URGENT_LOCATION', shelfCode, locationId, articleCode, orderFab },
            }),
            (0, push_1.notifyUsersByEmails)(qualityEmails, {
                title: 'Articulo urgente ubicado',
                body: `${articleCode} ${orderFab} ha sido ubicado en ${locationId}.`.trim(),
                data: { type: 'URGENT_LOCATION_QUALITY', shelfCode, locationId, articleCode, orderFab },
            }),
        ]);
    }
    return null;
});
exports.notifyCarretilleroRequest = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snapshot, context) => {
    var _a;
    const data = snapshot.data();
    if (!data || data.targetRole !== 'CARRETILLERO')
        return;
    let userDocs = await (0, push_1.getUsersByRole)('CARRETILLERO');
    if (userDocs.length === 0) {
        const legacySnapshot = await firebaseAdmin_1.admin.firestore().collection('users').where('user', '==', 'CARRETILLERO').get();
        userDocs = legacySnapshot.docs;
    }
    if (userDocs.length === 0)
        return;
    await (0, push_1.sendPushToUsers)(userDocs, {
        title: `Nueva Solicitud - ${data.title || 'Material'}`,
        body: data.message || 'Tienes una nueva solicitud pendiente.',
        data: { url: '/requests', requestId: String(context.params.notificationId || ''), priority: ((_a = data.metadata) === null || _a === void 0 ? void 0 : _a.priority) || 'normal' },
    });
});
// ── WiFi Connection Monitoring Notifications ───────────────────────────────────
exports.notifyConnectionDisconnect = functions.firestore
    .document('conexion_logs/{logId}')
    .onCreate(async (snapshot, context) => {
    const log = snapshot.data() || {};
    // Only notify on DISCONNECTED events
    if (log.event !== 'DISCONNECTED')
        return null;
    const deviceName = String(log.deviceName || 'Dispositivo desconocido');
    const deviceType = String(log.deviceType || 'UNKNOWN');
    const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }) : 'hace poco';
    // Notify ADMIN and SUPERADMIN roles
    await Promise.all([
        (0, push_1.notifyUsersByRole)('ADMIN', {
            title: '⚠️ Desconexión WiFi detectada',
            body: `${deviceName} se desconectó a las ${timestamp}`,
            data: {
                type: 'DEVICE_DISCONNECTED',
                deviceId: String(log.deviceId || ''),
                deviceName,
                deviceType,
                timestamp: log.timestamp || '',
            }
        }),
        (0, push_1.notifyUsersByRole)('SUPERADMIN', {
            title: '⚠️ Desconexión WiFi detectada',
            body: `${deviceName} se desconectó a las ${timestamp}`,
            data: {
                type: 'DEVICE_DISCONNECTED',
                deviceId: String(log.deviceId || ''),
                deviceName,
                deviceType,
                timestamp: log.timestamp || '',
            }
        })
    ]).catch((err) => {
        console.error('[notifyConnectionDisconnect] Error sending notifications:', err);
    });
    return null;
});
// Long offline detection (triggered when a device stays offline for 10+ minutes)
exports.notifyLongDisconnection = functions.pubsub
    .schedule('every 10 minutes')
    .timeZone('Europe/Madrid')
    .onRun(async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const statusSnapshot = await firebaseAdmin_1.admin.firestore()
        .collection('conexion_estado')
        .where('isOnline', '==', false)
        .where('lastDisconnectedAt', '<=', tenMinutesAgo)
        .get();
    const offlineDevices = statusSnapshot.docs.map((doc) => doc.data());
    if (offlineDevices.length === 0)
        return { checked: 0, critical: 0 };
    const criticalDevices = offlineDevices.filter((device) => {
        const disconnectTime = new Date(device.lastDisconnectedAt).getTime();
        const now = Date.now();
        return (now - disconnectTime) > 30 * 60 * 1000; // > 30 minutes offline
    });
    if (criticalDevices.length > 0) {
        const deviceList = criticalDevices
            .map((d) => `${d.deviceName} (${d.deviceType}) - ${Math.floor((Date.now() - new Date(d.lastDisconnectedAt).getTime()) / 60000)}m`)
            .join('\n');
        await Promise.all([
            (0, push_1.notifyUsersByRole)('SUPERADMIN', {
                title: '🔴 Dispositivos críticos sin conexión',
                body: `${criticalDevices.length} dispositivo(s) llevan más de 30 minutos sin conexión:\n${deviceList}`,
                data: {
                    type: 'CRITICAL_OFFLINE_ALERT',
                    deviceCount: String(criticalDevices.length),
                }
            })
        ]).catch((err) => {
            console.error('[notifyLongDisconnection] Error sending critical alert:', err);
        });
    }
    return { checked: offlineDevices.length, critical: criticalDevices.length };
});
exports.pickupQueueOperate = functions.https.onCall(async (data, context) => {
    const actor = await (0, authz_1.resolveOperationalActor)(context, data === null || data === void 0 ? void 0 : data.session);
    const op = String((data === null || data === void 0 ? void 0 : data.op) || '');
    const payload = (data === null || data === void 0 ? void 0 : data.payload) || {};
    if (op === 'create') {
        const shelfCode = String((payload === null || payload === void 0 ? void 0 : payload.shelfCode) || actor.assignedShelf || '').trim().toUpperCase();
        const operarioId = String((payload === null || payload === void 0 ? void 0 : payload.operarioId) || actor.operarioId || actor.uid).trim();
        const operarioName = String((payload === null || payload === void 0 ? void 0 : payload.operarioName) || actor.operarioName || actor.email || actor.uid).trim();
        const shelfName = String((payload === null || payload === void 0 ? void 0 : payload.shelfName) || shelfCode).trim() || shelfCode;
        if (!shelfCode || !operarioId) {
            throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para crear recogida.');
        }
        if (actor.role === 'OPERARIO' && actor.assignedShelf && actor.assignedShelf !== shelfCode) {
            throw new functions.https.HttpsError('permission-denied', 'El kiosko no puede crear recogidas en otra estanteria.');
        }
        const createdAt = new Date().toISOString();
        const queueRef = await firebaseAdmin_1.admin.firestore().collection('pickupQueue').add({
            operarioId,
            operarioName,
            shelfSection: (0, authz_1.getWmsSectionForShelf)(shelfCode),
            shelfCode,
            shelfName,
            status: 'PENDING',
            createdAt,
            completedAt: null,
            completedBy: null,
        });
        await firebaseAdmin_1.admin.firestore().collection('history').add({
            action: 'AVISAR_CARRETILLERO',
            articleCode: '',
            orderFab: '',
            fromLocation: null,
            toLocation: null,
            shelfCode,
            operarioId,
            operarioName,
            timestamp: createdAt,
            uid: actor.uid,
            role: actor.role,
            user: operarioName,
            source: 'pickupQueueOperate',
        });
        return { ok: true, requestId: queueRef.id };
    }
    if (op === 'complete') {
        if (!['CARRETILLERO', 'ADMIN', 'SUPERADMIN'].includes(actor.role)) {
            throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para completar solicitudes.');
        }
        const requestId = String((payload === null || payload === void 0 ? void 0 : payload.requestId) || '').trim();
        if (!requestId) {
            throw new functions.https.HttpsError('invalid-argument', 'requestId requerido.');
        }
        await firebaseAdmin_1.admin.firestore().collection('pickupQueue').doc(requestId).update({
            status: 'COMPLETED',
            completedAt: new Date().toISOString(),
            completedBy: actor.uid,
        });
        return { ok: true };
    }
    throw new functions.https.HttpsError('invalid-argument', `Operacion desconocida: ${op}`);
});
//# sourceMappingURL=notifications.js.map