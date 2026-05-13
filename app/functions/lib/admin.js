"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceHeartbeat = exports.resolveDeviceConfig = exports.adminOperate = void 0;
const functions = require("firebase-functions");
const firebaseAdmin_1 = require("./firebaseAdmin");
const authz_1 = require("./authz");
const normalize = (value) => (value || '').trim();
const normalizeRole = (value) => (value || '').trim().toUpperCase();
const ALLOWED_ROLES = new Set(['OPERARIO', 'CARRETILLERO', 'JEFE_SECCION', 'CALIDAD', 'ADMIN', 'SUPERADMIN']);
const ALLOWED_SECTIONS = new Set(['MECANIZADO', 'PLEGADORA', 'PRENSAS', 'SOLDADURA', 'ROBOT_PLEGADO', 'REPASADO', 'PINTURA', 'LASER', 'CALIDAD', 'OTROS']);
exports.adminOperate = functions.https.onCall(async (data, context) => {
    await (0, authz_1.requireAllowedRoles)(context, ['SUPERADMIN']);
    const op = String((data === null || data === void 0 ? void 0 : data.op) || '');
    const payload = (data === null || data === void 0 ? void 0 : data.payload) || {};
    const db = firebaseAdmin_1.admin.firestore();
    if (op === 'saveConfig') {
        await db.collection('config').doc('app').set(payload, { merge: true });
        return { ok: true };
    }
    if (op === 'upsertDevice') {
        const deviceId = normalize(payload === null || payload === void 0 ? void 0 : payload.deviceId);
        const name = normalize(payload === null || payload === void 0 ? void 0 : payload.name) || 'Dispositivo';
        const type = (payload === null || payload === void 0 ? void 0 : payload.type) === 'CARRETILLERO' ? 'CARRETILLERO' : 'KIOSK';
        const assignedShelf = type === 'KIOSK' ? (normalize(payload === null || payload === void 0 ? void 0 : payload.assignedShelf) || null) : null;
        if (!deviceId) {
            throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
        }
        await db.collection('devices').doc(deviceId).set({
            name,
            type,
            assignedShelf,
            active: (payload === null || payload === void 0 ? void 0 : payload.active) !== false,
            lastSeen: new Date().toISOString(),
        }, { merge: true });
        return { ok: true };
    }
    if (op === 'updateDevice') {
        const deviceId = normalize(payload === null || payload === void 0 ? void 0 : payload.deviceId);
        if (!deviceId) {
            throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
        }
        const updatePayload = {};
        if (typeof (payload === null || payload === void 0 ? void 0 : payload.name) === 'string') {
            updatePayload.name = normalize(payload.name) || 'Dispositivo';
        }
        if (typeof (payload === null || payload === void 0 ? void 0 : payload.active) === 'boolean') {
            updatePayload.active = payload.active;
        }
        if (typeof (payload === null || payload === void 0 ? void 0 : payload.type) === 'string') {
            updatePayload.type = payload.type === 'CARRETILLERO' ? 'CARRETILLERO' : 'KIOSK';
        }
        if ('assignedShelf' in payload || updatePayload.type === 'KIOSK') {
            const effectiveType = String(updatePayload.type || (payload === null || payload === void 0 ? void 0 : payload.type) || '').trim().toUpperCase();
            updatePayload.assignedShelf = effectiveType === 'CARRETILLERO' ? null : (normalize(payload === null || payload === void 0 ? void 0 : payload.assignedShelf) || null);
        }
        if (Object.keys(updatePayload).length === 0) {
            throw new functions.https.HttpsError('invalid-argument', 'No hay cambios validos para actualizar.');
        }
        await db.collection('devices').doc(deviceId).set(Object.assign({}, updatePayload), { merge: true });
        return { ok: true };
    }
    if (op === 'updateUser') {
        const userId = normalize(payload === null || payload === void 0 ? void 0 : payload.userId);
        const role = normalizeRole(payload === null || payload === void 0 ? void 0 : payload.role);
        const section = normalizeRole(payload === null || payload === void 0 ? void 0 : payload.section);
        if (!userId) {
            throw new functions.https.HttpsError('invalid-argument', 'userId requerido.');
        }
        if (!ALLOWED_ROLES.has(role)) {
            throw new functions.https.HttpsError('invalid-argument', 'Rol no valido.');
        }
        if (section && !ALLOWED_SECTIONS.has(section)) {
            throw new functions.https.HttpsError('invalid-argument', 'Seccion no valida.');
        }
        await db.collection('users').doc(userId).set({
            role,
            section: role === 'JEFE_SECCION' ? (section || null) : null,
        }, { merge: true });
        return { ok: true };
    }
    throw new functions.https.HttpsError('invalid-argument', `Operacion desconocida: ${op}`);
});
exports.resolveDeviceConfig = functions.https.onCall(async (data) => {
    const deviceId = normalize(data === null || data === void 0 ? void 0 : data.deviceId);
    if (!deviceId) {
        throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
    }
    const deviceSnap = await firebaseAdmin_1.admin.firestore().collection('devices').doc(deviceId).get();
    if (!deviceSnap.exists) {
        return { exists: false };
    }
    const device = deviceSnap.data();
    return {
        exists: true,
        device: {
            type: device.type === 'CARRETILLERO' ? 'CARRETILLERO' : 'KIOSK',
            active: device.active !== false,
            assignedShelf: device.assignedShelf || null,
            name: normalize(device.name) || 'Dispositivo',
        },
    };
});
exports.deviceHeartbeat = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado.');
    }
    const deviceId = String((data === null || data === void 0 ? void 0 : data.deviceId) || '').trim();
    if (!deviceId) {
        throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
    }
    const deviceRef = firebaseAdmin_1.admin.firestore().collection('devices').doc(deviceId);
    const snap = await deviceRef.get();
    if (!snap.exists) {
        return { ok: true, exists: false };
    }
    await deviceRef.set({ lastSeen: new Date().toISOString() }, { merge: true });
    return { ok: true, exists: true };
});
//# sourceMappingURL=admin.js.map