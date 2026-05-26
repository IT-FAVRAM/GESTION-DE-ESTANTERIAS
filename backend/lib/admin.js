"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceHeartbeat = exports.sendAdminMessage = exports.resolveDeviceConfig = exports.adminOperate = void 0;
const functions = require("firebase-functions");
const firebaseAdmin_1 = require("./firebaseAdmin");
const authz_1 = require("./authz");
const push_1 = require("./push");
const normalize = (value) => String(value || '').trim();
const normalizeRole = (value) => String(value || '').trim().toUpperCase();
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
        const kioskId = type === 'KIOSK' ? (normalize(payload === null || payload === void 0 ? void 0 : payload.kioskId) || null) : null;
        if (!deviceId) {
            throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
        }
        await db.collection('dispositivos').doc(deviceId).set({
            name,
            type,
            assignedShelf,
            kioskId,
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
        if ('kioskId' in payload) {
            const effectiveType = String(updatePayload.type || (payload === null || payload === void 0 ? void 0 : payload.type) || '').trim().toUpperCase();
            updatePayload.kioskId = effectiveType === 'KIOSK' ? (normalize(payload === null || payload === void 0 ? void 0 : payload.kioskId) || null) : null;
        }
        if (Object.keys(updatePayload).length === 0) {
            throw new functions.https.HttpsError('invalid-argument', 'No hay cambios validos para actualizar.');
        }
        await db.collection('dispositivos').doc(deviceId).set(Object.assign({}, updatePayload), { merge: true });
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
        const userRef = db.collection('usuarios').doc(userId);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Usuario no encontrado.');
        }
        await userRef.update({
            role,
            section: role === 'JEFE_SECCION' ? (section || null) : null,
        });
        return { ok: true };
    }
    throw new functions.https.HttpsError('invalid-argument', `Operacion desconocida: ${op}`);
});
exports.resolveDeviceConfig = functions.https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado.');
    }
    const deviceId = normalize(data === null || data === void 0 ? void 0 : data.deviceId);
    if (!deviceId) {
        throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
    }
    let deviceSnap = await firebaseAdmin_1.admin.firestore().collection('dispositivos').doc(deviceId).get();
    // Auto-registrar dispositivos desconocidos (ordenador desarrollo, móvil, etc.)
    // como tipo CARRETILLERO para que puedan operar sin estar pre-registrados.
    if (!deviceSnap.exists) {
        const now = new Date().toISOString();
        await firebaseAdmin_1.admin.firestore().collection('dispositivos').doc(deviceId).set({
            type: 'CARRETILLERO',
            name: `Auto-${deviceId.slice(-8)}`,
            active: true,
            assignedShelf: null,
            lastSeen: now,
        });
        // Re-read after creation
        deviceSnap = await firebaseAdmin_1.admin.firestore().collection('dispositivos').doc(deviceId).get();
    }
    const device = deviceSnap.data();
    const result = {
        exists: true,
        device: {
            type: device.type === 'CARRETILLERO' ? 'CARRETILLERO' : 'KIOSK',
            active: device.active !== false,
            assignedShelf: device.assignedShelf || null,
            name: normalize(device.name) || 'Dispositivo',
        },
        claimsUpdated: false,
    };
    // Set `validatedDevice: true` custom claim so Firestore security rules can
    // verify that this anonymous user operates a registered, active device.
    // The client must force-refresh its ID token after receiving claimsUpdated: true.
    if (context.auth && device.active !== false) {
        const provider = (_b = (_a = context.auth.token) === null || _a === void 0 ? void 0 : _a.firebase) === null || _b === void 0 ? void 0 : _b.sign_in_provider;
        if (provider === 'anonymous' && !context.auth.token.validatedDevice) {
            try {
                await firebaseAdmin_1.admin.auth().setCustomUserClaims(context.auth.uid, { validatedDevice: true });
                result.claimsUpdated = true;
            }
            catch (err) {
                // Non-fatal: writes go through Cloud Functions which validate separately.
                // The Firestore read rules will update on next token refresh (< 1 hour).
                console.warn('[resolveDeviceConfig] Could not set custom claims:', err);
            }
        }
    }
    return result;
});
const ALLOWED_MESSAGE_TARGETS = new Set(['ALL', 'JEFE_SECCION', 'CALIDAD', 'CARRETILLERO', 'ADMIN', 'SUPERADMIN']);
exports.sendAdminMessage = functions.https.onCall(async (data, context) => {
    const user = await (0, authz_1.requireAllowedRoles)(context, ['ADMIN', 'SUPERADMIN']);
    const title = String((data === null || data === void 0 ? void 0 : data.title) || '').trim();
    const body = String((data === null || data === void 0 ? void 0 : data.body) || '').trim();
    const targetRole = String((data === null || data === void 0 ? void 0 : data.targetRole) || 'ALL').trim().toUpperCase();
    if (!title || !body) {
        throw new functions.https.HttpsError('invalid-argument', 'Título y mensaje son obligatorios.');
    }
    if (!ALLOWED_MESSAGE_TARGETS.has(targetRole)) {
        throw new functions.https.HttpsError('invalid-argument', 'Destinatario no válido.');
    }
    const db = firebaseAdmin_1.admin.firestore();
    let userDocs;
    if (targetRole === 'ALL') {
        const snap = await db.collection('usuarios').get();
        userDocs = snap.docs;
    }
    else {
        userDocs = await (0, push_1.getUsersByRole)(targetRole);
    }
    const pushResult = await (0, push_1.sendPushToUsers)(userDocs, {
        title,
        body,
        data: { type: 'ADMIN_MESSAGE', targetRole, sentBy: user.email || user.uid },
    });
    await db.collection('adminMessages').add({
        title,
        body,
        targetRole,
        sentBy: user.email || user.uid,
        sentByRole: user.role,
        sentAt: new Date().toISOString(),
        successCount: pushResult.successCount,
        failureCount: pushResult.failureCount,
    });
    return { ok: true, successCount: pushResult.successCount, failureCount: pushResult.failureCount };
});
exports.deviceHeartbeat = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado.');
    }
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(String(context.auth.token.role || '').trim().toUpperCase());
    const isValidatedDevice = context.auth.token.validatedDevice === true;
    if (!isAdmin && !isValidatedDevice) {
        throw new functions.https.HttpsError('permission-denied', 'Solo dispositivos validados o admins pueden enviar heartbeat.');
    }
    const deviceId = String((data === null || data === void 0 ? void 0 : data.deviceId) || '').trim();
    if (!deviceId) {
        throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
    }
    const deviceRef = firebaseAdmin_1.admin.firestore().collection('dispositivos').doc(deviceId);
    const snap = await deviceRef.get();
    if (!snap.exists) {
        return { ok: true, exists: false };
    }
    await deviceRef.set({ lastSeen: new Date().toISOString() }, { merge: true });
    return { ok: true, exists: true };
});
//# sourceMappingURL=admin.js.map