import * as functions from 'firebase-functions';
import { admin } from './firebaseAdmin';
import { requireAllowedRoles } from './authz';
import { getUsersByRole, sendPushToUsers } from './push';

const normalize = (value?: string | null) => String(value || '').trim();
const normalizeRole = (value?: string | null) => String(value || '').trim().toUpperCase();

const ALLOWED_ROLES = new Set(['OPERARIO', 'CARRETILLERO', 'JEFE_SECCION', 'CALIDAD', 'ADMIN', 'SUPERADMIN']);
const ALLOWED_SECTIONS = new Set(['MECANIZADO', 'PLEGADORA', 'PRENSAS', 'SOLDADURA', 'ROBOT_PLEGADO', 'REPASADO', 'PINTURA', 'LASER', 'CALIDAD', 'OTROS']);

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
    if (!deviceId) {
      throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
    }
    await db.collection('devices').doc(deviceId).set({
      name,
      type,
      assignedShelf,
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
    if (Object.keys(updatePayload).length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'No hay cambios validos para actualizar.');
    }
    await db.collection('devices').doc(deviceId).set({ ...updatePayload }, { merge: true });
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
    await db.collection('users').doc(userId).set({
      role,
      section: role === 'JEFE_SECCION' ? (section || null) : null,
    }, { merge: true });
    return { ok: true };
  }

  throw new functions.https.HttpsError('invalid-argument', `Operacion desconocida: ${op}`);
});

export const resolveDeviceConfig = functions.https.onCall(async (data: any, context: any) => {
  const deviceId = normalize(data?.deviceId);
  if (!deviceId) {
    throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
  }

  const deviceSnap = await admin.firestore().collection('devices').doc(deviceId).get();
  if (!deviceSnap.exists) {
    return { exists: false };
  }

  const device = deviceSnap.data() as {
    type?: string;
    active?: boolean;
    assignedShelf?: string | null;
    name?: string;
  };

  const result: {
    exists: boolean;
    device?: { type: string; active: boolean; assignedShelf: string | null; name: string };
    claimsUpdated: boolean;
  } = {
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
    const snap = await db.collection('users').get();
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
  const deviceId = String(data?.deviceId || '').trim();
  if (!deviceId) {
    throw new functions.https.HttpsError('invalid-argument', 'deviceId requerido.');
  }
  const deviceRef = admin.firestore().collection('devices').doc(deviceId);
  const snap = await deviceRef.get();
  if (!snap.exists) {
    return { ok: true, exists: false };
  }
  await deviceRef.set({ lastSeen: new Date().toISOString() }, { merge: true });
  return { ok: true, exists: true };
});
