"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removePinnedUrgency = exports.setPinnedUrgency = void 0;
const functions = require("firebase-functions");
const firestore_1 = require("firebase-admin/firestore");
const URGENCY_ALLOWED_ROLES = new Set(['ADMIN', 'SUPERADMIN']);
const assertUrgencyAuth = async (uid) => {
    var _a, _b;
    const db = (0, firestore_1.getFirestore)();
    const userDoc = await db.collection('usuarios').doc(uid).get();
    const role = String(((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role) || '').toUpperCase();
    if (!URGENCY_ALLOWED_ROLES.has(role)) {
        throw new functions.https.HttpsError('permission-denied', 'Solo ADMIN y SUPERADMIN pueden gestionar urgencias.');
    }
    return ((_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.displayName) || 'Unknown';
};
/**
 * Cloud Function: setPinnedUrgency
 * Crea o actualiza un aviso fijado.
 * Solo los 5 usuarios autorizados pueden hacerlo.
 * Validación: máximo uno por (articleCode + orderId).
 */
exports.setPinnedUrgency = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const uid = context.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    const displayName = await assertUrgencyAuth(uid);
    if (!data.text || !data.articleCode || !data.orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'text, articleCode y orderId son obligatorios');
    }
    // Buscar si ya existe un aviso para esta combinación (articleCode + orderId)
    const existingQuery = await db
        .collection('chat')
        .doc('general')
        .collection('pinned')
        .where('articleCode', '==', data.articleCode)
        .where('orderId', '==', data.orderId)
        .get();
    const existingDoc = existingQuery.docs[0];
    if (existingDoc) {
        // Actualizar
        await existingDoc.ref.update({
            text: data.text,
            articleName: data.articleName || null,
            orderNumber: data.orderNumber || null,
            pinnedBy: uid,
            pinnedByName: displayName,
            updatedAt: firestore_1.Timestamp.now(),
        });
        return { success: true, id: existingDoc.id, action: 'updated' };
    }
    else {
        // Crear nuevo
        const newDocRef = db
            .collection('chat')
            .doc('general')
            .collection('pinned')
            .doc(); // auto-generate id
        await newDocRef.set({
            text: data.text,
            articleCode: data.articleCode,
            articleName: data.articleName || null,
            orderId: data.orderId,
            orderNumber: data.orderNumber || null,
            pinnedBy: uid,
            pinnedByName: displayName,
            pinnedAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        });
        return { success: true, id: newDocRef.id, action: 'created' };
    }
});
/**
 * Cloud Function: removePinnedUrgency
 * Elimina un aviso fijado.
 * Solo el usuario que lo creó o los autorizados pueden eliminarlo.
 */
exports.removePinnedUrgency = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const uid = context.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    await assertUrgencyAuth(uid);
    if (!data.pinnedId) {
        throw new functions.https.HttpsError('invalid-argument', 'pinnedId is required');
    }
    // Obtener el documento
    const pinnedRef = db
        .collection('chat')
        .doc('general')
        .collection('pinned')
        .doc(data.pinnedId);
    const pinnedDoc = await pinnedRef.get();
    if (!pinnedDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Pinned urgency not found');
    }
    // Eliminar
    await pinnedRef.delete();
    return { success: true, id: data.pinnedId, action: 'deleted' };
});
//# sourceMappingURL=urgency.js.map