"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOperationalActor = exports.requireAllowedRoles = exports.getUserContext = exports.getWmsSectionForShelf = exports.normalizeRole = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const normalize = (value) => (value || '').trim().toUpperCase();
const normalizeRole = (role) => {
    const normalized = normalize(role);
    if (normalized === 'JEFE') {
        return 'JEFE_SECCION';
    }
    return normalized;
};
exports.normalizeRole = normalizeRole;
const WMS_SHELF_SECTION = {
    MEC: 'MECANIZADO',
    PLE: 'PLEGADORA',
    SOL: 'SOLDADURA',
    RSO: 'SOLDADURA',
    SXP: 'SOLDADURA',
    REP: 'REPASADO',
    PIN: 'PINTURA',
    ZIN: 'REPASADO',
    CAL: 'CALIDAD',
    COM: 'OTROS',
    RPL: 'ROBOT_PLEGADO',
};
const getWmsSectionForShelf = (shelfCode) => {
    const code = normalize(shelfCode);
    return WMS_SHELF_SECTION[code] || 'OTROS';
};
exports.getWmsSectionForShelf = getWmsSectionForShelf;
const getUserContext = async (context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado.');
    }
    const uid = context.auth.uid;
    const claimedRole = typeof context.auth.token.role === 'string' ? context.auth.token.role : '';
    const claimedSection = typeof context.auth.token.section === 'string' ? context.auth.token.section : null;
    const email = typeof context.auth.token.email === 'string' ? context.auth.token.email : null;
    if (claimedRole) {
        return {
            uid,
            role: (0, exports.normalizeRole)(claimedRole),
            email,
            section: claimedSection,
        };
    }
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const role = typeof (userData === null || userData === void 0 ? void 0 : userData.role) === 'string' ? (0, exports.normalizeRole)(userData.role) : '';
    const section = typeof (userData === null || userData === void 0 ? void 0 : userData.section) === 'string' ? userData.section : null;
    const docEmail = typeof (userData === null || userData === void 0 ? void 0 : userData.email) === 'string' ? userData.email : email;
    return {
        uid,
        role,
        email: docEmail,
        section,
    };
};
exports.getUserContext = getUserContext;
const requireAllowedRoles = async (context, allowedRoles) => {
    const user = await (0, exports.getUserContext)(context);
    if (!allowedRoles.includes(user.role)) {
        throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para esta operacion.');
    }
    return user;
};
exports.requireAllowedRoles = requireAllowedRoles;
const resolveOperationalActor = async (context, session) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado.');
    }
    const provider = (_a = context.auth.token.firebase) === null || _a === void 0 ? void 0 : _a.sign_in_provider;
    if (provider !== 'anonymous') {
        return (0, exports.getUserContext)(context);
    }
    const role = (0, exports.normalizeRole)(session === null || session === void 0 ? void 0 : session.role);
    const deviceId = String((session === null || session === void 0 ? void 0 : session.deviceId) || '').trim();
    const operarioId = String((session === null || session === void 0 ? void 0 : session.operarioId) || '').trim();
    const operarioName = String((session === null || session === void 0 ? void 0 : session.operarioName) || '').trim();
    if (!['OPERARIO', 'CARRETILLERO'].includes(role) || !deviceId || !operarioId) {
        throw new functions.https.HttpsError('permission-denied', 'Sesion operativa anonima invalida.');
    }
    const deviceDoc = await admin.firestore().collection('dispositivos').doc(deviceId).get();
    if (!deviceDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Dispositivo no registrado.');
    }
    const device = deviceDoc.data();
    if (device.active === false) {
        throw new functions.https.HttpsError('permission-denied', 'Dispositivo desactivado.');
    }
    if (role === 'OPERARIO' && device.type !== 'KIOSK') {
        throw new functions.https.HttpsError('permission-denied', 'El dispositivo no es un kiosko.');
    }
    if (role === 'CARRETILLERO' && device.type !== 'CARRETILLERO') {
        throw new functions.https.HttpsError('permission-denied', 'El dispositivo no es de carretillero.');
    }
    return {
        uid: context.auth.uid,
        role,
        email: null,
        section: role === 'OPERARIO' ? (0, exports.getWmsSectionForShelf)(device.assignedShelf) : null,
        deviceId,
        assignedShelf: device.assignedShelf || null,
        operarioId,
        operarioName: operarioName || operarioId,
    };
};
exports.resolveOperationalActor = resolveOperationalActor;
//# sourceMappingURL=authz.js.map