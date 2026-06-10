import * as functions from 'firebase-functions';
import { admin } from './firebaseAdmin';
import { assertActorMayOperateShelf, getWmsSectionForShelf, resolveOperationalActor } from './authz';
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

export const checkStaleItems = functions.pubsub.schedule('every day 02:00').timeZone('Europe/Madrid').onRun(async () => {
  const BATCH_SIZE = 500;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let allItemDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  while (true) {
    let q = admin.firestore().collection('items').where('active', '==', true).limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc) as any;
    const batch = await q.get();
    allItemDocs = allItemDocs.concat(batch.docs);
    if (batch.size < BATCH_SIZE) break;
    lastDoc = batch.docs[batch.docs.length - 1];
  }

  const itemsSnapshot = { docs: allItemDocs };
  const config = await getAppConfig();
  const chiefMapping = config.chiefMapping || {};
  const now = Date.now();
  const staleLimitMs = STALE_ITEM_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const alertIntervalMs = STALE_ITEM_ALERT_INTERVAL_HOURS * 60 * 60 * 1000;
  let notifiedItems = 0;

  // Group stale items by section to avoid N+1 getUsersByEmails calls
  type StaleEntry = { doc: FirebaseFirestore.QueryDocumentSnapshot; item: any; shelfCode: string; section: string; locatedAtMs: number };
  const staleItems: StaleEntry[] = [];
  for (const itemDoc of itemsSnapshot.docs) {
    const item = itemDoc.data() || {};
    const locatedAtMs = toMillis(item.locatedAt);
    if (!locatedAtMs || now - locatedAtMs < staleLimitMs) continue;
    const lastAlertAtMs = toMillis(item.lastAlertAt);
    if (lastAlertAtMs && now - lastAlertAtMs < alertIntervalMs) continue;
    const shelfCode = normalize(item.shelfCode);
    staleItems.push({ doc: itemDoc, item, shelfCode, section: getWmsSectionForShelf(shelfCode), locatedAtMs });
  }

  // Prefetch users once per section
  const uniqueSections = [...new Set(staleItems.map((s) => s.section))];
  const usersBySection = new Map<string, any[]>();
  await Promise.all(uniqueSections.map(async (section) => {
    const emails = Array.isArray(chiefMapping[section]) ? chiefMapping[section] : [];
    usersBySection.set(section, await getUsersByEmails(emails));
  }));

  for (const { doc: itemDoc, item, shelfCode, section, locatedAtMs } of staleItems) {
    const userDocs = usersBySection.get(section) || [];
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
    const requestType = String(data.requestType || 'RECOGER');
    const shelfSection = String(data.shelfSection || 'OTROS');
    const shelfName = String(data.shelfName || data.shelfCode || 'estanteria');
    const operarioName = String(data.operarioName || data.operarioId || '---');
    const requestId = String(context.params.requestId || '');
    const shelfCode = String(data.shelfCode || '');

    let title: string;
    let body: string;
    let notifType: string;

    if (requestType === 'TRAER') {
      const articleCode = String(data.articleCode || 'Artículo');
      const articleOrderFab = String(data.articleOrderFab || '');
      const articleShelfName = String(data.articleShelfName || 'estantería desconocida');
      const articlePositions: string[] = Array.isArray(data.articlePositions) ? data.articlePositions : [];
      const posText = articlePositions.length > 0
        ? `posición ${articlePositions.join(', posición ')}`
        : 'ubicación desconocida';
      title = `📦 ${operarioName} (${shelfSection}) solicita traslado`;
      body = `Necesita: ${articleCode}${articleOrderFab ? ' ' + articleOrderFab : ''}.\nEstá en: ${articleShelfName}, ${posText}.\nLlevar a: ${shelfSection} — ${shelfName}.`;
      notifType = 'DELIVERY_REQUEST';
    } else {
      const operarioId = String(data.operarioId || '---');
      title = `🛑 ${operarioName} solicita recogida`;
      body = `${shelfSection} — ${shelfName} (${operarioId}).`;
      notifType = 'PICKUP_QUEUE_CREATED';
    }

    await notifyUsersByRole('CARRETILLERO', {
      title,
      body,
      data: { type: notifType, requestId, shelfCode, shelfSection },
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
    const isSoldadura = ['SOL', 'RSO', 'SXP'].includes(shelfCode);
    const isReprocesos = shelfCode === 'CAL' && position >= 1 && position <= 22;
    if (!isUrgent && !isTechReview && !isSoldadura && !isReprocesos) return null;
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
      // Destinatarios adicionales de avisos URGENTES por sección (configurable en config/app).
      // urgentExtraEmails: { REPASADO: ['x@y.com'], ... }  — editable en Firestore sin redeploy.
      const urgentExtraBySection = (config.urgentExtraEmails && typeof config.urgentExtraEmails === 'object')
        ? config.urgentExtraEmails as Record<string, string[]>
        : {};
      const extraUrgentEmails = Array.isArray(urgentExtraBySection[section])
        ? urgentExtraBySection[section]
        : [];
      const urgentChiefEmails = [...chiefEmails, ...extraUrgentEmails];
      await Promise.all([
        notifyUsersByEmails(urgentChiefEmails, {
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

    if (isSoldadura && !isUrgent) {
      const soldaduraEmails = Array.isArray(chiefMapping['SOLDADURA']) ? chiefMapping['SOLDADURA'] : [];
      if (soldaduraEmails.length > 0) {
        await notifyUsersByEmails(soldaduraEmails, {
          title: 'Articulo ubicado en zona de Soldadura',
          body: `${articleCode} ${orderFab} ha sido ubicado en ${locationId} (${shelfCode}).`.trim(),
          data: { type: 'SOLDADURA_LOCATION', shelfCode, locationId, articleCode, orderFab },
        });
      }
    }

    if (isReprocesos && qualityEmails.length > 0) {
      // Determinar el rol del usuario que ubicó el artículo
      const locatedBy = String(firstItem.locatedBy || '');
      let placerRole = 'UNKNOWN';
      if (locatedBy) {
        try {
          const userDoc = await admin.firestore().collection('usuarios').doc(locatedBy).get();
          if (userDoc.exists) {
            placerRole = String((userDoc.data() as any)?.role || 'UNKNOWN').toUpperCase();
          }
        } catch { /* non-critical, notificamos igualmente si no podemos resolver el rol */ }
      }
      // Solo notificar si quien ubica NO es CALIDAD (ellos ya saben lo que hacen)
      if (placerRole !== 'CALIDAD') {
        const placerName = String(firstItem.locatedByName || locatedBy || 'Alguien');
        await notifyUsersByEmails(qualityEmails, {
          title: '⚠️ Artículo en Reprocesos',
          body: `${placerName} ha ubicado ${articleCode}${orderFab ? ' ' + orderFab : ''} en ${locationId}.`.trim(),
          data: { type: 'REPROCESOS_LOCATION', shelfCode, locationId, articleCode, orderFab, placerRole },
        });
        console.log(`[notifySpecialLocationOccupancy] Reprocesos notif sent: ${articleCode} ${orderFab} → ${locationId} por ${placerName} (${placerRole})`);
      }
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
      const legacySnapshot = await admin.firestore().collection('usuarios').where('role', '==', 'CARRETILLERO').get();
      userDocs = legacySnapshot.docs;
    }
    if (userDocs.length === 0) return;
    await sendPushToUsers(userDocs, {
      title: `Nueva Solicitud - ${data.title || 'Material'}`,
      body: data.message || 'Tienes una nueva solicitud pendiente.',
      data: { url: '/requests', requestId: String(context.params.notificationId || ''), priority: data.metadata?.priority || 'normal' },
    });
  });

// ── WiFi Connection Monitoring Notifications ───────────────────────────────────

export const notifyConnectionDisconnect = functions.firestore
  .document('conexion_logs/{logId}')
  .onCreate(async (snapshot: any, context: any) => {
    const log = snapshot.data() || {};

    // Only notify on DISCONNECTED events
    if (log.event !== 'DISCONNECTED') return null;

    const deviceName = String(log.deviceName || 'Dispositivo desconocido');
    const deviceType = String(log.deviceType || 'UNKNOWN');
    const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) : 'hace poco';

    // Notify ADMIN and SUPERADMIN roles
    await Promise.all([
      notifyUsersByRole('ADMIN', {
        title: '⚠️ Desconexión WiFi detectada',
        body: `${deviceName} se desconectó a las ${timestamp}`,
        data: {
          type: 'DEVICE_DISCONNECTED',
          deviceId: String(log.deviceId || ''),
          deviceName,
          deviceType,
          timestamp: log.timestamp || '',
        }
      }),
      notifyUsersByRole('SUPERADMIN', {
        title: '⚠️ Desconexión WiFi detectada',
        body: `${deviceName} se desconectó a las ${timestamp}`,
        data: {
          type: 'DEVICE_DISCONNECTED',
          deviceId: String(log.deviceId || ''),
          deviceName,
          deviceType,
          timestamp: log.timestamp || '',
        }
      })
    ]).catch((err) => {
      console.error('[notifyConnectionDisconnect] Error sending notifications:', err);
    });

    return null;
  });

// Long offline detection (triggered when a device stays offline for 10+ minutes)
export const notifyLongDisconnection = functions.pubsub
  .schedule('every 10 minutes')
  .timeZone('Europe/Madrid')
  .onRun(async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const statusSnapshot = await admin.firestore()
      .collection('conexion_estado')
      .where('isOnline', '==', false)
      .where('lastDisconnectedAt', '<=', tenMinutesAgo)
      .get();

    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const offlineDevices = statusSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (offlineDevices.length === 0) return { checked: 0, critical: 0 };

    const criticalDevices = offlineDevices.filter((device: any) => {
      const disconnectTime = new Date(device.lastDisconnectedAt).getTime();
      const isLongOffline = (now - disconnectTime) > 30 * 60 * 1000;
      const notRecentlyAlerted = !device.lastCriticalAlertAt || device.lastCriticalAlertAt < oneHourAgo;
      return isLongOffline && notRecentlyAlerted;
    });

    if (criticalDevices.length > 0) {
      const deviceList = criticalDevices
        .map((d: any) => `${d.deviceName} (${d.deviceType}) - ${Math.floor((now - new Date(d.lastDisconnectedAt).getTime()) / 60000)}m`)
        .join('\n');

      await notifyUsersByRole('SUPERADMIN', {
        title: '🔴 Dispositivos críticos sin conexión',
        body: `${criticalDevices.length} dispositivo(s) llevan más de 30 minutos sin conexión:\n${deviceList}`,
        data: {
          type: 'CRITICAL_OFFLINE_ALERT',
          deviceCount: String(criticalDevices.length),
        }
      }).catch((err) => {
        console.error('[notifyLongDisconnection] Error sending critical alert:', err);
      });

      const alertedAt = new Date(now).toISOString();
      const db = admin.firestore();
      const batchUpdate = db.batch();
      criticalDevices.forEach((device: any) => {
        batchUpdate.update(db.collection('conexion_estado').doc(device.id), { lastCriticalAlertAt: alertedAt });
      });
      await batchUpdate.commit().catch((err) => console.error('[notifyLongDisconnection] batch update failed:', err));
    }

    return { checked: offlineDevices.length, critical: criticalDevices.length };
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
    const requestType = String(payload?.requestType || 'RECOGER').trim().toUpperCase();
    if (!shelfCode || !operarioId) {
      throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para crear recogida.');
    }
    // Validar autorización de estantería para ambos tipos
    assertActorMayOperateShelf(actor, shelfCode);
    const createdAt = new Date().toISOString();
    const docData: Record<string, unknown> = {
      operarioId,
      operarioName,
      shelfSection: getWmsSectionForShelf(shelfCode),
      shelfCode,
      shelfName,
      requestType,
      status: 'PENDING',
      createdAt,
      completedAt: null,
      completedBy: null,
    };
    if (requestType === 'TRAER') {
      docData.articleCode = String(payload?.articleCode || '').trim();
      docData.articleOrderFab = String(payload?.articleOrderFab || '').trim();
      docData.articleShelfName = String(payload?.articleShelfName || '').trim();
      docData.articlePositions = Array.isArray(payload?.articlePositions)
        ? payload.articlePositions.map((p: unknown) => String(p))
        : [];
    }
    const queueRef = await admin.firestore().collection('pickupQueue').add(docData);
    await admin.firestore().collection('history').add({
      action: requestType === 'TRAER' ? 'SOLICITAR_TRASLADO' : 'AVISAR_CARRETILLERO',
      articleCode: requestType === 'TRAER' ? String(payload?.articleCode || '') : '',
      orderFab: requestType === 'TRAER' ? String(payload?.articleOrderFab || '') : '',
      fromLocation: requestType === 'TRAER' ? String(payload?.articleShelfName || '') : null,
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
    const reqRef = admin.firestore().collection('pickupQueue').doc(requestId);
    // Usar transacción para evitar race condition si dos carretilleros completan la misma solicitud
    await admin.firestore().runTransaction(async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Solicitud no encontrada.');
      }
      if (reqSnap.data()?.status !== 'PENDING') {
        throw new functions.https.HttpsError('failed-precondition', 'La solicitud no está pendiente.');
      }
      tx.update(reqRef, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        completedBy: actor.uid,
      });
    });
    return { ok: true };
  }

  throw new functions.https.HttpsError('invalid-argument', `Operacion desconocida: ${op}`);
});
