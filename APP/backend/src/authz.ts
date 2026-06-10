import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const normalize = (value?: string | null) => (value || '').trim().toUpperCase();

export const normalizeRole = (role?: string | null) => {
  const normalized = normalize(role);
  if (normalized === 'JEFE') {
    return 'JEFE_SECCION';
  }
  return normalized;
};

export type UserContext = {
  uid: string;
  role: string;
  email: string | null;
  section: string | null;
};

export type OperationalActor = UserContext & {
  deviceId?: string | null;
  assignedShelf?: string | null;
  operarioId?: string | null;
  operarioName?: string | null;
};

const WMS_SHELF_SECTION: Record<string, string> = {
  MEC: 'MECANIZADO',
  PRE: 'PRENSAS',
  PME: 'PRENSAS_MECANIZADO',
  PLE: 'PLEGADORA',
  SOL: 'SOLDADURA',
  RSO: 'SOLDADURA',
  SXP: 'SOLDADURA',
  REP: 'REPASADO',
  PIN: 'PINTURA',
  ZIN: 'REPASADO',
  CAL: 'CALIDAD',
  COM: 'OTROS',
  RPL: 'AUTOPLEGADORA',
  LASER: 'LASER',
};

const SECTION_COVERS: Record<string, string[]> = {
  PRENSAS_MECANIZADO: ['MECANIZADO', 'PRENSAS', 'PRENSAS_MECANIZADO'],
  PRENSAS: ['PRENSAS_MECANIZADO'],
  MECANIZADO: ['PRENSAS_MECANIZADO'],
};

const sectionCoversShelf = (actorSection: string, shelfCode: string): boolean => {
  const covers = SECTION_COVERS[actorSection];
  if (covers) {
    const shelfSection = normalize(getWmsSectionForShelf(shelfCode));
    return covers.includes(shelfSection);
  }
  return false;
};

export const getWmsSectionForShelf = (shelfCode?: string | null) => {
  const code = normalize(shelfCode);
  return WMS_SHELF_SECTION[code] || 'OTROS';
};

/** Valida que el actor puede operar sobre la estantería indicada (shelfOperate / pickup). */
export const assertActorMayOperateShelf = (
  actor: OperationalActor,
  shelfCode: string,
) => {
  const shelf = normalize(shelfCode);
  if (!shelf) {
    throw new functions.https.HttpsError('invalid-argument', 'shelfCode requerido.');
  }

  if (actor.role === 'CALIDAD' && shelf !== 'CAL') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Calidad solo puede operar la estantería CAL.',
    );
  }

  if (actor.role === 'JEFE_SECCION') {
    const actorSection = normalize(actor.section);
    const shelfSection = normalize(getWmsSectionForShelf(shelf));
    const coversCheck = sectionCoversShelf(actorSection, shelf);
    if (!actorSection || (actorSection !== shelfSection && !coversCheck)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'No puedes operar estanterías fuera de tu sección.',
      );
    }
  }
};

export const getUserContext = async (
  context: functions.https.CallableContext,
): Promise<UserContext> => {
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
      role: normalizeRole(claimedRole),
      email,
      section: claimedSection,
    };
  }

  const userDoc = await admin.firestore().collection('usuarios').doc(uid).get();
  const userData = userDoc.exists ? userDoc.data() : null;
  const role = typeof userData?.role === 'string' ? normalizeRole(userData.role) : '';
  const section = typeof userData?.section === 'string' ? userData.section : null;
  const docEmail = typeof userData?.email === 'string' ? userData.email : email;

  return {
    uid,
    role,
    email: docEmail,
    section,
  };
};

export const requireAllowedRoles = async (
  context: functions.https.CallableContext,
  allowedRoles: string[],
): Promise<UserContext> => {
  const user = await getUserContext(context);
  if (!allowedRoles.includes(user.role)) {
    throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para esta operacion.');
  }
  return user;
};

export const resolveOperationalActor = async (
  context: functions.https.CallableContext,
  session?: {
    role?: string;
    deviceId?: string;
    operarioId?: string;
    operarioName?: string;
  },
): Promise<OperationalActor> => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado.');
  }

  const provider = context.auth.token.firebase?.sign_in_provider;
  if (provider !== 'anonymous') {
    return getUserContext(context);
  }

  const role = normalizeRole(session?.role);
  const deviceId = String(session?.deviceId || '').trim();
  const operarioId = String(session?.operarioId || '').trim();
  const operarioName = String(session?.operarioName || '').trim();

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
      const device = deviceDoc.data() as { active?: boolean };
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

  const device = deviceDoc.data() as { type?: string; active?: boolean; assignedShelf?: string | null };
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
    section: role === 'OPERARIO' ? getWmsSectionForShelf(device.assignedShelf) : null,
    deviceId,
    assignedShelf: device.assignedShelf || null,
    operarioId,
    operarioName: operarioName || operarioId,
  };
};
