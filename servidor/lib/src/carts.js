"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cartsOperate = void 0;
const functions = require("firebase-functions");
const firebaseAdmin_1 = require("./firebaseAdmin");
const authz_1 = require("./authz");
exports.cartsOperate = functions.https.onCall(async (data, context) => {
    const actor = await (0, authz_1.resolveOperationalActor)(context, data === null || data === void 0 ? void 0 : data.session);
    if (!['CARRETILLERO', 'ADMIN', 'SUPERADMIN'].includes(actor.role)) {
        throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para gestionar carros.');
    }
    const op = String((data === null || data === void 0 ? void 0 : data.op) || '');
    const payload = (data === null || data === void 0 ? void 0 : data.payload) || {};
    const cartId = String((payload === null || payload === void 0 ? void 0 : payload.cartId) || '').trim();
    if (!cartId) {
        throw new functions.https.HttpsError('invalid-argument', 'cartId es requerido.');
    }
    const db = firebaseAdmin_1.admin.firestore();
    const now = new Date().toISOString();
    if (op === 'addItem') {
        const shelfId = String((payload === null || payload === void 0 ? void 0 : payload.shelfId) || '').trim();
        const type = String((payload === null || payload === void 0 ? void 0 : payload.type) || 'article').trim();
        const description = String((payload === null || payload === void 0 ? void 0 : payload.description) || '').trim();
        const barcode = String((payload === null || payload === void 0 ? void 0 : payload.barcode) || '').trim();
        const orderId = String((payload === null || payload === void 0 ? void 0 : payload.orderId) || '').trim();
        if (!shelfId || !description) {
            throw new functions.https.HttpsError('invalid-argument', 'shelfId y description son requeridos.');
        }
        const itemRef = db.collection('carts').doc(cartId).collection('items').doc();
        await itemRef.set({
            id: itemRef.id,
            shelfId,
            type,
            description,
            barcode: barcode || undefined,
            orderId: orderId || undefined,
            addedBy: actor.uid,
            createdAt: now,
        });
        return { ok: true, itemId: itemRef.id };
    }
    if (op === 'removeItems') {
        const itemIds = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.itemIds) ? payload.itemIds : [];
        if (itemIds.length === 0) {
            throw new functions.https.HttpsError('invalid-argument', 'itemIds array es requerido.');
        }
        const batch = db.batch();
        itemIds.forEach((id) => {
            const ref = db.collection('carts').doc(cartId).collection('items').doc(id);
            batch.delete(ref);
        });
        await batch.commit();
        return { ok: true, removed: itemIds.length };
    }
    if (op === 'moveItems') {
        const itemIds = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.itemIds) ? payload.itemIds : [];
        const targetShelfId = String((payload === null || payload === void 0 ? void 0 : payload.targetShelfId) || '').trim();
        if (itemIds.length === 0 || !targetShelfId) {
            throw new functions.https.HttpsError('invalid-argument', 'itemIds array y targetShelfId son requeridos.');
        }
        const batch = db.batch();
        itemIds.forEach((id) => {
            const ref = db.collection('carts').doc(cartId).collection('items').doc(id);
            batch.update(ref, { shelfId: targetShelfId });
        });
        await batch.commit();
        return { ok: true, moved: itemIds.length };
    }
    throw new functions.https.HttpsError('invalid-argument', `Operación desconocida: ${op}`);
});
//# sourceMappingURL=carts.js.map