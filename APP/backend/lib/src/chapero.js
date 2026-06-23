"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chaperoOperate = void 0;
const functions = require("firebase-functions");
const firebaseAdmin_1 = require("./firebaseAdmin");
const authz_1 = require("./authz");
const CHAPERO_ALLOWED_ROLES = ['CARRETILLERO', 'ADMIN', 'SUPERADMIN', 'JEFE_SECCION'];
const assertChaperoAccess = async (actor) => {
    var _a, _b;
    if (actor.role === 'JEFE_SECCION') {
        const section = (_b = (_a = actor.section) === null || _a === void 0 ? void 0 : _a.toUpperCase()) !== null && _b !== void 0 ? _b : '';
        if (section !== 'PUNZONADO') {
            throw new functions.https.HttpsError('permission-denied', 'Solo el jefe de PUNZONADO puede acceder al chapero.');
        }
        return;
    }
    if (!CHAPERO_ALLOWED_ROLES.includes(actor.role)) {
        throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para acceder al chapero.');
    }
};
const generateItemId = (uid) => `${uid}-${Date.now()}`;
exports.chaperoOperate = functions.https.onCall(async (data, context) => {
    const actor = await (0, authz_1.resolveOperationalActor)(context, data === null || data === void 0 ? void 0 : data.session);
    await assertChaperoAccess(actor);
    const op = String((data === null || data === void 0 ? void 0 : data.op) || '');
    const payload = (data === null || data === void 0 ? void 0 : data.payload) || {};
    const db = firebaseAdmin_1.admin.firestore();
    const now = new Date().toISOString();
    if (op === 'ubicar') {
        const positionId = String((payload === null || payload === void 0 ? void 0 : payload.positionId) || '').trim();
        const material = String((payload === null || payload === void 0 ? void 0 : payload.material) || '').trim().toUpperCase();
        const spec = typeof (payload === null || payload === void 0 ? void 0 : payload.spec) === 'string' ? payload.spec.trim().toUpperCase() : undefined;
        const espesor = String((payload === null || payload === void 0 ? void 0 : payload.espesor) || '').trim();
        const locatedByName = String((payload === null || payload === void 0 ? void 0 : payload.locatedByName) || actor.operarioName || actor.email || actor.uid).trim();
        if (!positionId)
            throw new functions.https.HttpsError('invalid-argument', 'positionId es requerido.');
        if (!material)
            throw new functions.https.HttpsError('invalid-argument', 'material es requerido.');
        if (!espesor)
            throw new functions.https.HttpsError('invalid-argument', 'espesor es requerido.');
        const itemId = generateItemId(actor.uid);
        const newItem = {
            id: itemId,
            material,
            espesor,
            locatedBy: actor.operarioId || actor.uid,
            locatedByName,
            locatedAt: now,
        };
        if (spec)
            newItem.spec = spec;
        const posRef = db.collection('chapero_positions').doc(positionId);
        await db.runTransaction(async (tx) => {
            var _a, _b, _c, _d;
            const snap = await tx.get(posRef);
            const existing = snap.exists ? ((_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.items) !== null && _b !== void 0 ? _b : []) : [];
            const updated = [...existing, newItem];
            tx.set(posRef, { positionId, items: updated, isEmpty: false }, { merge: true });
            const histRef = db.collection('history').doc();
            tx.set(histRef, {
                id: histRef.id,
                timestamp: now,
                uid: actor.uid,
                role: actor.role,
                user: (_d = (_c = actor.email) !== null && _c !== void 0 ? _c : actor.operarioId) !== null && _d !== void 0 ? _d : actor.uid,
                source: 'chaperoOperate',
                action: 'CHAPERO_UBICAR',
                positionId,
                material,
                espesor,
                spec: spec !== null && spec !== void 0 ? spec : null,
                locatedByName,
                itemId,
            });
        });
        return { ok: true, itemId };
    }
    if (op === 'retirar') {
        const positionId = String((payload === null || payload === void 0 ? void 0 : payload.positionId) || '').trim();
        const itemIds = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.itemIds) ? payload.itemIds : [];
        if (!positionId)
            throw new functions.https.HttpsError('invalid-argument', 'positionId es requerido.');
        if (itemIds.length === 0)
            throw new functions.https.HttpsError('invalid-argument', 'itemIds no puede estar vacío.');
        const posRef = db.collection('chapero_positions').doc(positionId);
        await db.runTransaction(async (tx) => {
            var _a, _b, _c, _d;
            const snap = await tx.get(posRef);
            if (!snap.exists)
                throw new functions.https.HttpsError('not-found', 'Posición no encontrada.');
            const existing = (_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.items) !== null && _b !== void 0 ? _b : [];
            const removed = existing.filter((it) => itemIds.includes(it.id));
            const remaining = existing.filter((it) => !itemIds.includes(it.id));
            tx.set(posRef, { items: remaining, isEmpty: remaining.length === 0 }, { merge: true });
            const histRef = db.collection('history').doc();
            tx.set(histRef, {
                id: histRef.id,
                timestamp: now,
                uid: actor.uid,
                role: actor.role,
                user: (_d = (_c = actor.email) !== null && _c !== void 0 ? _c : actor.operarioId) !== null && _d !== void 0 ? _d : actor.uid,
                source: 'chaperoOperate',
                action: 'CHAPERO_RETIRAR',
                positionId,
                removedItems: removed,
                removedBy: actor.operarioId || actor.uid,
                removedByName: actor.operarioName || actor.email || actor.uid,
            });
        });
        return { ok: true, removed: itemIds.length };
    }
    if (op === 'mover') {
        const fromId = String((payload === null || payload === void 0 ? void 0 : payload.fromPositionId) || '').trim();
        const toId = String((payload === null || payload === void 0 ? void 0 : payload.toPositionId) || '').trim();
        if (!fromId || !toId)
            throw new functions.https.HttpsError('invalid-argument', 'fromPositionId y toPositionId son requeridos.');
        if (fromId === toId)
            throw new functions.https.HttpsError('invalid-argument', 'Origen y destino no pueden ser la misma posición.');
        const fromRef = db.collection('chapero_positions').doc(fromId);
        const toRef = db.collection('chapero_positions').doc(toId);
        await db.runTransaction(async (tx) => {
            var _a, _b, _c, _d, _e, _f;
            const [fromSnap, toSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
            const fromItems = fromSnap.exists ? ((_b = (_a = fromSnap.data()) === null || _a === void 0 ? void 0 : _a.items) !== null && _b !== void 0 ? _b : []) : [];
            if (fromItems.length === 0)
                throw new functions.https.HttpsError('not-found', 'La posición origen está vacía.');
            const toItems = toSnap.exists ? ((_d = (_c = toSnap.data()) === null || _c === void 0 ? void 0 : _c.items) !== null && _d !== void 0 ? _d : []) : [];
            const merged = [...toItems, ...fromItems];
            tx.set(fromRef, { items: [], isEmpty: true }, { merge: true });
            tx.set(toRef, { positionId: toId, items: merged, isEmpty: false }, { merge: true });
            const histRef = db.collection('history').doc();
            tx.set(histRef, {
                id: histRef.id,
                timestamp: now,
                uid: actor.uid,
                role: actor.role,
                user: (_f = (_e = actor.email) !== null && _e !== void 0 ? _e : actor.operarioId) !== null && _f !== void 0 ? _f : actor.uid,
                source: 'chaperoOperate',
                action: 'CHAPERO_MOVER',
                fromPositionId: fromId,
                toPositionId: toId,
                movedItems: fromItems,
                movedByName: actor.operarioName || actor.email || actor.uid,
            });
        });
        return { ok: true };
    }
    throw new functions.https.HttpsError('invalid-argument', `Operación desconocida: ${op}`);
});
//# sourceMappingURL=chapero.js.map