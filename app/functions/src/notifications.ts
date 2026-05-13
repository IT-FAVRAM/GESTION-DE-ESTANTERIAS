import * as functions from 'firebase-functions';
import { admin } from './firebaseAdmin';
import { getWmsSectionForShelf, resolveOperationalActor } from './authz';
import { getAppConfig, getUsersByEmails, getUsersByRole, notifyUsersByEmails, notifyUsersByRole, sendPushToUsers } from './push';

const normalize = (value?: string | null) => (value || '').trim().toUpperCase();
const STALE_ITEM_THRESHOLD_DAYS = 5;
const STALE_ITEM_ALERT_INTERVAL_HOURS = 48;

const toMillis = (value?: string | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

const parseLocationPosition = (position: string) => {
  const parsed = Number.parseInt(String(position || '').replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const getAddedLocationItems = (beforeData: any, afterData: any) => {
  const beforeItems = Array.isArray(beforeData?.items) ? beforeData.items : [];
  const afterItems = Array.isArray(afterData?.items) ? afterData.items : [];
  const beforeKeys = new Set(beforeItems.map((item: any) => `${normalize(item?.articleCode)}__${normalize(item?.orderFab)}__${normalize(item?.locatedAt)}`));
  return afterItems.filter((item: any) => !beforeKeys.has(`${normalize(item?.articleCode)}__${normalize(item?.orderFab)}__${normalize(item?.locatedAt)}`));
};

export const checkStaleItems = functions.pubsub.schedule('every 24 hours').timeZone('Europe/Madrid').onRun(async () => {
  const itemsSnapshot = await admin.firestore().collection('items').where('active', '==', true).get();
  const config = await getAppConfig();
  const chiefMapping = config.chiefMapping || {};
  const now = Date.now();
  const staleLimitMs = STALE_ITEM_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const alertIntervalMs = STALE_ITEM_ALERT_INTERVAL_HOURS * 60 * 60 * 1000;
  let notifiedItems = 0;

  for (const itemDoc of itemsSnapshot.docs) {
    const item = itemDoc.data() || {};
    const locatedAtMs = toMillis(item.locatedAt);
    if (!locatedAtMs || now - locatedAtMs < staleLimitMs) continue;
    const lastAlertAtMs = toMillis(item.lastAlertAt);
    if (lastAlertAtMs && now - lastAlertAtMs < alertIntervalMs) continue;
    const shelfCode = normalize(item.shelfCode);
    const section = getWmsSectionForShelf(shelfCode);
    const emails = Array.isArray(chiefMapping[section]) ? chiefMapping[section] : [];
    const userDocs = await getUsersByEmails(emails);
    const notificationResult = await sendPushToUsers(userDocs, {
      title: 'Articulo estancado en estanteria',
      body: `${item.articleCode || 'Articulo'} ${item.orderFab || ''} lleva ${Math.floor((now - locatedAtMs) / (1000 * 60 * 60 * 24))} dias en ${Array.isArray(item.locationIds) ? item.locationIds.join(', ') : shelfCode}`.trim(),
      data: { type: 'STALE_ITEM_ALERT', shelfCode, articleCode: String(item.articleCode || ''), orderFab: String(item.orderFab || '') },
    });
    if (notificationResult.successCount > 0 || userDocs.length === 0) {
      await itemDoc.ref.update({ lastAlertAt: new Date(now).toISOString() });
      notifiedItems += 1;
    }
  }

  return { notifiedItems };
});

export const notifyPickupQueueCreated = functions.firestore
  .document('pickupQueue/{requestId}')
  .onCreate(async (snapshot: any, context: any) => {
    const data = snapshot.data() || {};
    const shelfSection = String(data.shelfSection || 'OTROS');
    const shelfName = String(data.shelfName || data.shelfCode || 'estanteria');
    const operarioId = String(data.operarioId || '---');
    await notifyUsersByRole('CARRETILLERO', {
      title: 'Nueva solicitud de recogida',
      body: `Operario ${operarioId} solicita recogida en ${shelfSection} (${shelfName}).`,
      data: { type: 'PICKUP_QUEUE_CREATED', requestId: String(context.params.requestId || ''), shelfCode: String(data.shelfCode || ''), shelfSection },
    });
    return null;
  });

export const notifySpecialLocationOccupancy = functions.firestore
  .document('shelves/{shelfCode}/locations/{position}')
  .onWrite(async (change: any, context: any) => {
    if (!change.after.exists) return null;
    const shelfCode = normalize(context.params.shelfCode);
    const position = parseLocationPosition(context.params.position);
    if (!position) return null;
    const config = await getAppConfig();
    const urgentLocations = Array.isArray(config.urgentLocations) ? config.urgentLocations : [];
    const techReviewLocations = Array.isArray(config.techReviewLocations) ? config.techReviewLocations : [];
    const locationId = `${shelfCode}-${String(context.params.position).padStart(3, '0')}`;
    const isUrgent = urgentLocations.includes(locationId);
    const isTechReview = techReviewLocations.includes(locationId);
    if (!isUrgent && !isTechReview) return null;
    const addedItems = getAddedLocationItems(change.before.data(), change.after.data());
    if (addedItems.length === 0) return null;
    const chiefMapping = config.chiefMapping || {};
    const qualityEmails = Array.isArray(config.qualityEmails) ? config.qualityEmails : [];
    const section = getWmsSectionForShelf(shelfCode);
    const firstItem = addedItems[0] || {};
    const articleCode = String(firstItem.articleCode || 'Articulo');
    const orderFab = String(firstItem.orderFab || '');

    if (isTechReview) {
      await notifyUsersByEmails(qualityEmails, {
        title: 'Articulo pendiente de revision tecnica',
        body: `${articleCode} ${orderFab} ha sido ubicado en ${locationId}.`.trim(),
        data: { type: 'TECH_REVIEW_LOCATION', shelfCode, locationId, articleCode, orderFab },
      });
    }

    if (isUrgent) {
      const chiefEmails = Array.isArray(chiefMapping[section]) ? chiefMapping[section] : [];
      await Promise.all([
        notifyUsersByEmails(chiefEmails, {
          title: 'Articulo urgente ubicado',
          body: `${articleCode} ${orderFab} ha sido ubicado en ${locationId}.`.trim(),
          data: { type: 'URGENT_LOCATION', shelfCode, locationId, articleCode, orderFab },
        }),
        notifyUsersByEmails(qualityEmails, {
          title: 'Articulo urgente ubicado',
          body: `${articleCode} ${orderFab} ha sido ubicado en ${locationId}.`.trim(),
          data: { type: 'URGENT_LOCATION_QUALITY', shelfCode, locationId, articleCode, orderFab },
        }),
      ]);
    }

    return null;
  });

export const notifyCarretilleroRequest = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snapshot: any, context: any) => {
    const data = snapshot.data();
    if (!data || data.targetRole !== 'CARRETILLERO') return;
    let userDocs = await getUsersByRole('CARRETILLERO');
    if (userDocs.length === 0) {
      const legacySnapshot = await admin.firestore().collection('users').where('user', '==', 'CARRETILLERO').get();
      userDocs = legacySnapshot.docs;
    }
    if (userDocs.length === 0) return;
    await sendPushToUsers(userDocs, {
      title: `Nueva Solicitud - ${data.title || 'Material'}`,
      body: data.message || 'Tienes una nueva solicitud pendiente.',
      data: { url: '/requests', requestId: String(context.params.notificationId || ''), priority: data.metadata?.priority || 'normal' },
    });
  });

export const pickupQueueOperate = functions.https.onCall(async (data: any, context: any) => {
  const actor = await resolveOperationalActor(context, data?.session);
  const op = String(data?.op || '');
  const payload = data?.payload || {};

  if (op === 'create') {
    const shelfCode = String(payload?.shelfCode || actor.assignedShelf || '').trim().toUpperCase();
    const operarioId = String(payload?.operarioId || actor.operarioId || actor.uid).trim();
    const operarioName = String(payload?.operarioName || actor.operarioName || actor.email || actor.uid).trim();
    const shelfName = String(payload?.shelfName || shelfCode).trim() || shelfCode;
    if (!shelfCode || !operarioId) {
      throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para crear recogida.');
    }
    if (actor.role === 'OPERARIO' && actor.assignedShelf && actor.assignedShelf !== shelfCode) {
      throw new functions.https.HttpsError('permission-denied', 'El kiosko no puede crear recogidas en otra estanteria.');
    }
    const createdAt = new Date().toISOString();
    const queueRef = await admin.firestore().collection('pickupQueue').add({
      operarioId,
      operarioName,
      shelfSection: getWmsSectionForShelf(shelfCode),
      shelfCode,
      shelfName,
      status: 'PENDING',
      createdAt,
      completedAt: null,
      completedBy: null,
    });
    await admin.firestore().collection('history').add({
      action: 'AVISAR_CARRETILLERO',
      articleCode: '',
      orderFab: '',
      fromLocation: null,
      toLocation: null,
      shelfCode,
      operarioId,
      operarioName,
      timestamp: createdAt,
      uid: actor.uid,
      role: actor.role,
      user: operarioName,
      source: 'pickupQueueOperate',
    });
    return { ok: true, requestId: queueRef.id };
  }

  if (op === 'complete') {
    if (!['CARRETILLERO', 'ADMIN', 'SUPERADMIN'].includes(actor.role)) {
      throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para completar solicitudes.');
    }
    const requestId = String(payload?.requestId || '').trim();
    if (!requestId) {
      throw new functions.https.HttpsError('invalid-argument', 'requestId requerido.');
    }
    await admin.firestore().collection('pickupQueue').doc(requestId).update({
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      completedBy: actor.uid,
    });
    return { ok: true };
  }

  throw new functions.https.HttpsError('invalid-argument', `Operacion desconocida: ${op}`);
});
