import * as functions from 'firebase-functions';
import { admin } from './firebaseAdmin';
import { requireAllowedRoles } from './authz';
import { getUsersByRole, sendPushToUsers } from './push';
import { migrateSoldaduraStructure } from '../scripts/migrate-SOL-structure';
import { auditDatabase } from '../scripts/audit-BD-complete';

const normalize = (value?: string | null) => String(value || '').trim();
const normalizeRole = (value?: string | null) => String(value || '').trim().toUpperCase();

const ALLOWED_ROLES = new Set(['OPERARIO', 'CARRETILLERO', 'JEFE_SECCION', 'CALIDAD', 'ADMIN', 'SUPERADMIN', 'SOLO_VISUAL']);
const ALLOWED_SECTIONS = new Set(['PRENSAS_MECANIZADO', 'PLEGADORA', 'SOLDADURA', 'ROBOT_PLEGADO', 'REPASADO', 'PINTURA', 'LASER', 'CALIDAD', 'OTROS', 'MECANIZADO', 'PRENSAS']);

export const adminOperate = functions.https.onCall(async (data: any, context: any) => {
  await requireAllowedRoles(context, ['SUPERADMIN']);
  const op = String(data?.op || '');
  const payload = data?.payload || {};
  const db = admin.firestore();

  if (op === 'saveConfig') {
    await db.collection('config').doc('app').set(payload, { merge: true });
    return { ok: true };
  }

  if (op === 'upsertDevice') {
    const deviceId = normalize(payload?.deviceId);
    const name = normalize(payload?.name) || 'Dispositivo';
    const type = payload?.type === 'CARRETILLERO' ? 'CARRETILLERO' : 'KIOSK';
    const assignedShelf = type === 'KIOSK' ? (normalize(payload?.assignedShelf) || null) : null;
    const kioskId = type === 'KIOSK' ? (normalize(payload?.kioskId) || null) : null;
    if (!deviceId) {
      throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
    }
    await db.collection('dispositivos').doc(deviceId).set({
      name,
      type,
      assignedShelf,
      kioskId,
      active: payload?.active !== false,
      lastSeen: new Date().toISOString(),
    }, { merge: true });
    return { ok: true };
  }

  if (op === 'updateDevice') {
    const deviceId = normalize(payload?.deviceId);
    if (!deviceId) {
      throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
    }
    const updatePayload: Record<string, unknown> = {};
    if (typeof payload?.name === 'string') {
      updatePayload.name = normalize(payload.name) || 'Dispositivo';
    }
    if (typeof payload?.active === 'boolean') {
      updatePayload.active = payload.active;
    }
    if (typeof payload?.type === 'string') {
      updatePayload.type = payload.type === 'CARRETILLERO' ? 'CARRETILLERO' : 'KIOSK';
    }
    if ('assignedShelf' in payload || updatePayload.type === 'KIOSK') {
      const effectiveType = String(updatePayload.type || payload?.type || '').trim().toUpperCase();
      updatePayload.assignedShelf = effectiveType === 'CARRETILLERO' ? null : (normalize(payload?.assignedShelf) || null);
    }
    if ('kioskId' in payload) {
      const effectiveType = String(updatePayload.type || payload?.type || '').trim().toUpperCase();
      updatePayload.kioskId = effectiveType === 'KIOSK' ? (normalize(payload?.kioskId) || null) : null;
    }
    if (Object.keys(updatePayload).length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'No hay cambios validos para actualizar.');
    }
    await db.collection('dispositivos').doc(deviceId).set({ ...updatePayload }, { merge: true });
    return { ok: true };
  }

  if (op === 'updateUser') {
    const userId = normalize(payload?.userId);
    const role = normalizeRole(payload?.role);
    const section = normalizeRole(payload?.section);
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

  if (op === 'migrateSoldadura') {
    try {
      console.log('[adminOperate] Iniciando migración de SOLDADURA...');
      await migrateSoldaduraStructure();
      console.log('[adminOperate] Migración completada exitosamente');
      return { ok: true, migrationCompleted: true };
    } catch (err) {
      console.error('[adminOperate] Error en migración:', err);
      throw new functions.https.HttpsError('internal',
        `Error en migración de SOLDADURA: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (op === 'auditDatabase') {
    try {
      console.log('[adminOperate] Iniciando auditoría de BD...');
      const issues = await auditDatabase();
      const critical = issues.filter(i => i.severity === 'CRITICAL').length;
      const warnings = issues.filter(i => i.severity === 'WARNING').length;
      const infos = issues.filter(i => i.severity === 'INFO').length;
      console.log(`[adminOperate] Auditoría completada: ${critical} críticos, ${warnings} advertencias, ${infos} informativos`);
      return {
        ok: true,
        auditCompleted: true,
        summary: { critical, warnings, infos, total: issues.length },
        issues: issues
      };
    } catch (err) {
      console.error('[adminOperate] Error en auditoría:', err);
      throw new functions.https.HttpsError('internal',
        `Error en auditoría de BD: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (op === 'updateUrgentLocations') {
    try {
      const locationsToAdd = Array.isArray(payload?.locationsToAdd) ? payload.locationsToAdd : [];
      const configRef = db.collection('config').doc('app');
      const configSnap = await configRef.get();
      const config = configSnap.data() || {};
      const currentUrgent = Array.isArray(config.urgentLocations) ? [...config.urgentLocations] : [];
      const newUrgent = [...new Set([...currentUrgent, ...locationsToAdd])];
      await configRef.update({
        urgentLocations: newUrgent,
        updatedAt: new Date().toISOString(),
      });
      console.log(`[adminOperate] Ubicaciones urgentes actualizadas: ${newUrgent.length} total`);
      return { ok: true, urgentLocations: newUrgent };
    } catch (err) {
      console.error('[adminOperate] Error actualizando ubicaciones urgentes:', err);
      throw new functions.https.HttpsError('internal',
        `Error actualizando ubicaciones urgentes: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new functions.https.HttpsError('invalid-argument', `Operacion desconocida: ${op}`);
});

export const resolveDeviceConfig = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado.');
  }
  const deviceId = normalize(data?.deviceId);
  if (!deviceId) {
    throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
  }

  const deviceSnap = await admin.firestore().collection('dispositivos').doc(deviceId).get();

  // Dispositivo desconocido: NO se auto-registra. Antes se creaba como KIOSK, lo que
  // (1) llenaba `dispositivos` de entradas "Auto-N" basura y (2) hacía que CUALQUIER
  // navegador (p. ej. el PC de un responsable de Calidad) se tratara como kiosko,
  // interfiriendo con su sesión. Los kioskos y tablets de carretillero se dan de alta
  // EXPLÍCITAMENTE desde SuperAdmin (AdminDevicesTab → upsertDevice). Un dispositivo
  // no registrado simplemente cae al login normal en el cliente (mismo comportamiento
  // que ya tenía un kiosko sin estantería asignada), sin crear ningún documento.
  if (!deviceSnap.exists) {
    return { exists: false, claimsUpdated: false };
  }

  const device = deviceSnap.data() as {
    type?: string;
    active?: boolean;
    assignedShelf?: string | null;
    kioskId?: string | null;
    name?: string;
  };

  const result: {
    exists: boolean;
    device?: { type: string; active: boolean; assignedShelf: string | null; kioskId: string | null; name: string };
    claimsUpdated: boolean;
  } = {
    exists: true,
    device: {
      type: device.type === 'CARRETILLERO' ? 'CARRETILLERO' : 'KIOSK',
      active: device.active !== false,
      assignedShelf: device.assignedShelf || null,
      kioskId: device.kioskId || null,
      name: normalize(device.name) || 'Dispositivo',
    },
    claimsUpdated: false,
  };

  // Set `validatedDevice: true` custom claim so Firestore security rules can
  // verify that this anonymous user operates a registered, active device.
  // The client must force-refresh its ID token after receiving claimsUpdated: true.
  if (context.auth && device.active !== false) {
    const provider = (context.auth.token?.firebase as any)?.sign_in_provider;
    if (provider === 'anonymous' && !context.auth.token.validatedDevice) {
      try {
        await admin.auth().setCustomUserClaims(context.auth.uid, { validatedDevice: true });
        result.claimsUpdated = true;
      } catch (err) {
        // Non-fatal: writes go through Cloud Functions which validate separately.
        // The Firestore read rules will update on next token refresh (< 1 hour).
        console.warn('[resolveDeviceConfig] Could not set custom claims:', err);
      }
    }
  }

  return result;
});

const ALLOWED_MESSAGE_TARGETS = new Set(['ALL', 'JEFE_SECCION', 'CALIDAD', 'CARRETILLERO', 'ADMIN', 'SUPERADMIN']);

export const sendAdminMessage = functions.https.onCall(async (data: any, context: any) => {
  const user = await requireAllowedRoles(context, ['ADMIN', 'SUPERADMIN']);

  const title = String(data?.title || '').trim();
  const body = String(data?.body || '').trim();
  const targetRole = String(data?.targetRole || 'ALL').trim().toUpperCase();

  if (!title || !body) {
    throw new functions.https.HttpsError('invalid-argument', 'Título y mensaje son obligatorios.');
  }
  if (!ALLOWED_MESSAGE_TARGETS.has(targetRole)) {
    throw new functions.https.HttpsError('invalid-argument', 'Destinatario no válido.');
  }

  const db = admin.firestore();

  let userDocs: FirebaseFirestore.QueryDocumentSnapshot[];
  if (targetRole === 'ALL') {
    const snap = await db.collection('usuarios').get();
    userDocs = snap.docs;
  } else {
    userDocs = await getUsersByRole(targetRole);
  }

  const pushResult = await sendPushToUsers(userDocs, {
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

export const deviceHeartbeat = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado.');
  }
  const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(String(context.auth.token.role || '').trim().toUpperCase());
  const isValidatedDevice = context.auth.token.validatedDevice === true;
  if (!isAdmin && !isValidatedDevice) {
    throw new functions.https.HttpsError('permission-denied', 'Solo dispositivos validados o admins pueden enviar heartbeat.');
  }
  const deviceId = String(data?.deviceId || '').trim();
  if (!deviceId) {
    throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
  }
  const deviceRef = admin.firestore().collection('dispositivos').doc(deviceId);
  const snap = await deviceRef.get();
  if (!snap.exists) {
    return { ok: true, exists: false };
  }
  await deviceRef.set({ lastSeen: new Date().toISOString() }, { merge: true });
  return { ok: true, exists: true };
});

/** Setup: Crear usuario, documento de usuario y dispositivo (SOLO SUPERADMIN) */
export const setupUser = functions.https.onCall(async (data: any, context: any) => {
  await requireAllowedRoles(context, ['SUPERADMIN']);
  const db = admin.firestore();
  const auth = admin.auth();

  const email = normalize(data?.email);
  const password = String(data?.password || '').trim();
  const displayName = normalize(data?.displayName);
  const role = normalizeRole(data?.role);
  const section = normalizeRole(data?.section);
  const deviceId = normalize(data?.deviceId);
  const deviceName = normalize(data?.deviceName) || 'Dispositivo';
  const assignedShelf = normalize(data?.assignedShelf);

  if (!email || !password || !displayName) {
    throw new functions.https.HttpsError('invalid-argument', 'email, password y displayName son requeridos.');
  }

  try {
    // 1. Crear usuario en Firebase Auth
    const user = await auth.createUser({
      email,
      password,
      displayName,
    });
    console.log(`[setupUser] Usuario creado: ${user.uid} (${email})`);

    // 2. Crear documento de usuario en Firestore
    await db.collection('usuarios').doc(user.uid).set({
      email,
      displayName,
      role: ALLOWED_ROLES.has(role) ? role : 'OPERARIO',
      section: ALLOWED_SECTIONS.has(section) ? section : null,
      fcmTokens: [],
      lastLoginAt: new Date().toISOString(),
    });
    console.log(`[setupUser] Documento de usuario creado`);

    // 3. Crear dispositivo si se proporciona
    if (deviceId && assignedShelf) {
      await db.collection('devices').doc(deviceId).set({
        deviceId,
        type: 'CARRETILLERO',
        name: deviceName,
        assignedShelf,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log(`[setupUser] Dispositivo creado: ${deviceId}`);
    }

    return { ok: true, uid: user.uid };
  } catch (error: any) {
    console.error('[setupUser] Error:', error.message);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
