"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOperationalActor = exports.requireAllowedRoles = exports.getUserContext = exports.assertActorMayOperateShelf = exports.getWmsSectionForShelf = exports.normalizeRole = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const normalize = (value) => (value || '').trim().toUpperCase();
/**
 * Estanterías que comparten ubicación física y se operan como una sola vista
 * combinada. PRE (Prensas), MEC (Mecanizado) y PME (código heredado) son la
 * MISMA estantería: el frontend las canonicaliza a 'PRE'. El backend debe
 * replicar esa equivalencia o la retirada/ubicación de un item físico de MEC
 * desde el kiosko de Prensas (o viceversa) se rechaza con permission-denied.
 */
const COMBINED_SHELF_ALIASES = { MEC: 'PRE', PME: 'PRE' };
/** Normaliza un código de estantería a su vista combinada canónica. */
const canonicalizeShelf = (code) => {
    var _a;
    const c = normalize(code);
    return (_a = COMBINED_SHELF_ALIASES[c]) !== null && _a !== void 0 ? _a : c;
};
/** Normaliza valores de sección legacy al nombre unificado */
const normalizeLegacySection = (section) => {
    if (!section)
        return null;
    const normalized = normalize(section);
    if (normalized === 'MECANIZADO' || normalized === 'PRENSAS') {
        return 'PRENSAS_MECANIZADO';
    }
    return normalized;
};
const normalizeRole = (role) => {
    const normalized = normalize(role);
    if (normalized === 'JEFE') {
        return 'JEFE_SECCION';
    }
    return normalized;
};
exports.normalizeRole = normalizeRole;
const WMS_SHELF_SECTION = {
    MEC: 'PRENSAS_MECANIZADO',
    PRE: 'PRENSAS_MECANIZADO',
    PME: 'PRENSAS_MECANIZADO',
    PLE: 'PLEGADORA',
    CP1: 'PLEGADORA',
    CP2: 'PLEGADORA',
    SOL: 'SOLDADURA',
    CS: 'SOLDADURA',
    RSO: 'SOLDADURA',
    UTS: 'SOLDADURA',
    SXP: 'SXP',
    REP: 'REPASADO',
    PIN: 'PINTURA',
    ZIN: 'ZINCADO',
    CAL: 'CALIDAD',
    COM: 'OTROS',
    RPL: 'AUTOPLEGADORA',
    ARO: 'AUTOPLEGADORA',
    CAM: 'AUTOPLEGADORA',
    CRP: 'AUTOPLEGADORA',
    LASER: 'LASER',
};
/**
 * Secciones que pueden tener acceso adicional a otras secciones.
 * Usado para jefes que necesitan acceder a múltiples secciones.
 * Ej: Jefe de PLEGADORA también accede a AUTOPLEGADORA.
 */
const CROSS_SECTION_ACCESS = {
    // PLEGADORA ↔ AUTOPLEGADORA: acceso bidireccional (secciones contiguas que se
    // operan en conjunto). Cada jefe puede operar estanterías y carros de la otra.
    'PLEGADORA': ['AUTOPLEGADORA'],
    'AUTOPLEGADORA': ['PLEGADORA'],
    // El jefe de SOLDADURA conserva acceso a Soldadura Puntos (SXP), ahora sección
    // propia con jefe dedicado (H / Mario). El jefe de SXP opera solo SXP.
    'SOLDADURA': ['SXP'],
};
/**
 * Estanterías de kiosk que pueden operar en estanterías adicionales.
 * Ej: Kiosk 'PLE' también puede operar en CP1, CP2 (carros PLEGADORA) y CRP, RPL (AUTOPLEGADORA).
 */
const KIOSK_ADDITIONAL_SHELVES = {
    'PLE': ['CP1', 'CP2', 'CAM', 'CRP', 'RPL', 'ARO'],
};
const getWmsSectionForShelf = (shelfCode) => {
    const code = normalize(shelfCode);
    return WMS_SHELF_SECTION[code] || 'OTROS';
};
exports.getWmsSectionForShelf = getWmsSectionForShelf;
/**
 * Resuelve las secciones accesibles para una sección primaria.
 * Incluye la sección primaria + cualquier sección adicional del mapa.
 */
function getAccessibleSections(primarySection) {
    const accessible = [normalize(primarySection)];
    const additional = CROSS_SECTION_ACCESS[normalize(primarySection)];
    if (additional) {
        accessible.push(...additional.map(normalize));
    }
    return accessible;
}
/** Valida que el actor puede operar sobre la estantería indicada (shelfOperate / pickup). */
const assertActorMayOperateShelf = (actor, shelfCode) => {
    const shelf = normalize(shelfCode);
    if (!shelf) {
        throw new functions.https.HttpsError('invalid-argument', 'shelfCode requerido.');
    }
    if (actor.role === 'CALIDAD' && shelf !== 'CAL') {
        throw new functions.https.HttpsError('permission-denied', 'Calidad solo puede operar la estantería CAL.');
    }
    if (actor.role === 'OPERARIO') {
        const assignedShelfUpper = normalize(actor.assignedShelf);
        if (!assignedShelfUpper) {
            throw new functions.https.HttpsError('permission-denied', 'Operario sin estantería asignada.');
        }
        // Puede operar en su estantería principal
        if (assignedShelfUpper === shelf)
            return;
        // PRE/MEC/PME comparten ubicación física (vista combinada 'PRE'). Un operario
        // asignado a cualquiera de ellas puede operar las tres — al retirar/ubicar, el
        // frontend resuelve la estantería física real (PRE o MEC), que puede no coincidir
        // literalmente con device.assignedShelf aunque sea la misma estantería.
        if (canonicalizeShelf(assignedShelfUpper) === canonicalizeShelf(shelf))
            return;
        // Puede operar en las estanterías adicionales configuradas en el dispositivo
        // (device.allowedShelves) — fuente de verdad única, igual que el frontend.
        const deviceAllowed = (actor.allowedShelves || []).map((s) => normalize(s));
        if (deviceAllowed.includes(shelf))
            return;
        // Compatibilidad: mapa estático de estanterías adicionales por kiosko.
        const additionalShelves = KIOSK_ADDITIONAL_SHELVES[assignedShelfUpper];
        if (additionalShelves && additionalShelves.includes(shelf))
            return;
        throw new functions.https.HttpsError('permission-denied', `Operario no autorizado para la estantería ${shelf}.`);
    }
    if (actor.role === 'JEFE_SECCION') {
        const actorSection = normalizeLegacySection(actor.section) || normalize(actor.section);
        const shelfSection = normalize((0, exports.getWmsSectionForShelf)(shelf));
        if (!actorSection) {
            throw new functions.https.HttpsError('permission-denied', 'Jefe sin sección asignada.');
        }
        const accessibleSections = getAccessibleSections(actorSection);
        if (!accessibleSections.includes(shelfSection)) {
            throw new functions.https.HttpsError('permission-denied', 'No puedes operar estanterías fuera de tu sección.');
        }
    }
};
exports.assertActorMayOperateShelf = assertActorMayOperateShelf;
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
    const userDoc = await admin.firestore().collection('usuarios').doc(uid).get();
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
    // CALIDAD puede usar sesión de kiosco anónima para operar CAL.
    // ADMIN y SUPERADMIN deben autenticarse siempre con email — no se permiten sesiones anónimas.
    if (role === 'CALIDAD') {
        if (!operarioId) {
            throw new functions.https.HttpsError('permission-denied', 'Sesion operativa anonima invalida.');
        }
        if (deviceId) {
            const deviceDoc = await admin.firestore().collection('dispositivos').doc(deviceId).get();
            if (!deviceDoc.exists) {
                throw new functions.https.HttpsError('permission-denied', 'Dispositivo no registrado.');
            }
            const device = deviceDoc.data();
            if (device.active === false) {
                throw new functions.https.HttpsError('permission-denied', 'Dispositivo desactivado.');
            }
        }
        return {
            uid: context.auth.uid,
            role,
            email: null,
            section: null,
            deviceId: deviceId || undefined,
            assignedShelf: 'CAL',
            operarioId,
            operarioName: operarioName || operarioId,
        };
    }
    // Roles operativos (OPERARIO, CARRETILLERO): requieren dispositivo registrado
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
        allowedShelves: Array.isArray(device.allowedShelves) ? device.allowedShelves : null,
        operarioId,
        operarioName: operarioName || operarioId,
    };
};
exports.resolveOperationalActor = resolveOperationalActor;
//# sourceMappingURL=authz.js.map