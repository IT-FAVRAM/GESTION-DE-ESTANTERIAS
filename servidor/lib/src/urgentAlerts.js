"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUrgentAlert = exports.resolveUrgentAlert = exports.createUrgentAlert = void 0;
const functions = require("firebase-functions");
const firestore_1 = require("firebase-admin/firestore");
const ALERT_ALLOWED_ROLES = new Set(['ADMIN', 'SUPERADMIN']);
const assertAlertAuth = async (uid) => {
    var _a, _b;
    const db = (0, firestore_1.getFirestore)();
    const userDoc = await db.collection('usuarios').doc(uid).get();
    const role = String(((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role) || '').toUpperCase();
    if (!ALERT_ALLOWED_ROLES.has(role)) {
        throw new functions.https.HttpsError('permission-denied', 'Solo ADMIN y SUPERADMIN pueden gestionar alertas de urgencia.');
    }
    return ((_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.displayName) || 'Unknown';
};
/**
 * createUrgentAlert — crea o actualiza una alerta de urgencia en `urgent_alerts/`.
 * Misma lógica de upsert por (articleCode + orderId) que el sistema anterior.
 * Solo ADMIN/SUPERADMIN.
 */
exports.createUrgentAlert = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const uid = context.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    const displayName = await assertAlertAuth(uid);
    if (!data.text || !data.articleCode || !data.orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'text, articleCode y orderId son obligatorios');
    }
    const existing = await db
        .collection('urgent_alerts')
        .where('articleCode', '==', data.articleCode)
        .where('orderId', '==', data.orderId)
        .where('resolved', '==', false)
        .get();
    const existingDoc = existing.docs[0];
    if (existingDoc) {
        await existingDoc.ref.update({
            text: data.text,
            articleName: data.articleName || null,
            orderNumber: data.orderNumber || null,
            createdBy: uid,
            createdByName: displayName,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { success: true, id: existingDoc.id, action: 'updated' };
    }
    const newRef = db.collection('urgent_alerts').doc();
    await newRef.set({
        text: data.text,
        articleCode: data.articleCode,
        articleName: data.articleName || null,
        orderId: data.orderId,
        orderNumber: data.orderNumber || null,
        createdBy: uid,
        createdByName: displayName,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        resolved: false,
        resolvedAt: null,
        resolvedBy: null,
        resolvedByName: null,
    });
    return { success: true, id: newRef.id, action: 'created' };
});
/**
 * resolveUrgentAlert — marca una alerta como resuelta.
 * Solo ADMIN/SUPERADMIN.
 */
exports.resolveUrgentAlert = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const uid = context.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    const displayName = await assertAlertAuth(uid);
    if (!data.alertId) {
        throw new functions.https.HttpsError('invalid-argument', 'alertId is required');
    }
    const alertRef = db.collection('urgent_alerts').doc(data.alertId);
    const alertDoc = await alertRef.get();
    if (!alertDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Alerta de urgencia no encontrada');
    }
    await alertRef.update({
        resolved: true,
        resolvedAt: firestore_1.FieldValue.serverTimestamp(),
        resolvedBy: uid,
        resolvedByName: displayName,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { success: true, id: data.alertId, action: 'resolved' };
});
/**
 * deleteUrgentAlert — elimina físicamente una alerta. Para limpieza de datos.
 * Solo ADMIN/SUPERADMIN.
 */
exports.deleteUrgentAlert = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const uid = context.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    await assertAlertAuth(uid);
    if (!data.alertId) {
        throw new functions.https.HttpsError('invalid-argument', 'alertId is required');
    }
    const alertRef = db.collection('urgent_alerts').doc(data.alertId);
    const alertDoc = await alertRef.get();
    if (!alertDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Alerta de urgencia no encontrada');
    }
    await alertRef.delete();
    return { success: true, id: data.alertId, action: 'deleted' };
});
//# sourceMappingURL=urgentAlerts.js.map