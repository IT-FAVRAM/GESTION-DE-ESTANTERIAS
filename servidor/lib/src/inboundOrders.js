"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inboundOrdersOperate = void 0;
const functions = require("firebase-functions");
const firebaseAdmin_1 = require("./firebaseAdmin");
const authz_1 = require("./authz");
exports.inboundOrdersOperate = functions.https.onCall(async (data, context) => {
    const actor = await (0, authz_1.resolveOperationalActor)(context, data === null || data === void 0 ? void 0 : data.session);
    if (!['ADMIN', 'SUPERADMIN'].includes(actor.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Solo administradores pueden gestionar pedidos.');
    }
    const op = String((data === null || data === void 0 ? void 0 : data.op) || '');
    const payload = (data === null || data === void 0 ? void 0 : data.payload) || {};
    const db = firebaseAdmin_1.admin.firestore();
    if (op === 'create') {
        const orderNumber = String((payload === null || payload === void 0 ? void 0 : payload.orderNumber) || '').trim();
        if (!orderNumber) {
            throw new functions.https.HttpsError('invalid-argument', 'orderNumber es requerido.');
        }
        await db.collection('inboundOrders').doc(orderNumber).set(Object.assign(Object.assign({}, payload), { orderNumber, updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(), createdAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp() }));
        return { ok: true };
    }
    if (op === 'update') {
        const orderId = String((payload === null || payload === void 0 ? void 0 : payload.orderId) || '').trim();
        if (!orderId) {
            throw new functions.https.HttpsError('invalid-argument', 'orderId es requerido.');
        }
        const { orderId: _id } = payload, updates = __rest(payload, ["orderId"]);
        await db.collection('inboundOrders').doc(orderId).update(Object.assign(Object.assign({}, updates), { updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp() }));
        return { ok: true };
    }
    if (op === 'delete') {
        const orderId = String((payload === null || payload === void 0 ? void 0 : payload.orderId) || '').trim();
        if (!orderId) {
            throw new functions.https.HttpsError('invalid-argument', 'orderId es requerido.');
        }
        await db.collection('inboundOrders').doc(orderId).delete();
        return { ok: true };
    }
    throw new functions.https.HttpsError('invalid-argument', `Operación desconocida: ${op}`);
});
//# sourceMappingURL=inboundOrders.js.map