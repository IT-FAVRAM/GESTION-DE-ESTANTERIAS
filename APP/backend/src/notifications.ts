import * as functions from 'firebase-functions';
import { admin } from './firebaseAdmin';
import { assertActorMayOperateShelf, getWmsSectionForShelf, resolveOperationalActor } from './authz';
import { getAppConfig, getUsersByEmails, getUsersByRole, notifyUserById, notifyUsersByEmails, notifyUsersByRole, sendPushToUsers } from './push';

const normalize = (value?: string | null) => (value || '').trim().toUpperCase();
const STALE_ITEM_THRESHOLD_DAYS = 5;
const STALE_ITEM_ALERT_INTERVAL_HOURS = 48;
const PENDING_ALERTS_COLLECTION = 'pendingAlerts';

/**
 * Notifica a los jefes de sección de un aviso URGENTE con FALLBACK persistente:
 * además del push, crea un doc en `pendingAlerts` por destinatario (acknowledged:false)
 * y manda el push con el `alertId`. Así, si el jefe NO estaba conectado y se pierde el
 * push, al volver a entrar la app le muestra un modal rojo bloqueante con el aviso.
 * Si recibe el push en vivo, el frontend marca el `alertId` como reconocido y no se
 * vuelve a mostrar.
 */
const notifyUrgentChiefsWithFallback = async (
  emails: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
) => {
  const userDocs = await getUsersByEmails(emails);
  await Promise.all(userDocs.map(async (doc) => {
    const alertRef = await admin.firestore().collection(PENDING_ALERTS_COLLECTION).add({
      recipientUid: doc.id,
      acknowledged: false,
      createdAt: new Date().toISOString(),
      title: payload.title,
      body: payload.body,
      data: payload.data || null,
      kind: 'URGENT_LOCATION',
    });
    await sendPushToUsers([doc], {
      ...payload,
      data: { ...(payload.data || {}), alertId: alertRef.id },
    });
  }));
};

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
    const targetCarretilleroId = String(data.targetCarretilleroId || '').trim();

    const destinationShelfName = String(data.destinationShelfName || '');
    const destinationStation = data.destinationStation != null ? Number(data.destinationStation) : null;
    const destText = destinationShelfName
      ? `${destinationShelfName}${destinationStation ? ` (puesto ${destinationStation})` : ''}`
      : `${shelfSection} — ${shelfName}`;

    let title: string;
    let body: string;
    let notifType: string;

    if (requestType === 'RECEPCION') {
      title = `Material en Recepciones`;
      body = `${operarioName} avisa: hay material recepcionado. Ve a Recepciones a recogerlo.`;
      notifType = 'RECEPCION_REQUEST';
    } else if (requestType === 'TRAER') {
      const articleCode = String(data.articleCode || 'Artículo');
      const articleOrderFab = String(data.articleOrderFab || '');
      const articleShelfName = String(data.articleShelfName || 'estantería desconocida');
      const articlePositions: string[] = Array.isArray(data.articlePositions) ? data.articlePositions : [];
      const posText = articlePositions.length > 0
        ? `posición ${articlePositions.join(', posición ')}`
        : 'ubicación desconocida';
      title = `${operarioName} (${shelfSection}) solicita traslado`;
      body = `Necesita: ${articleCode}${articleOrderFab ? ' ' + articleOrderFab : ''}.\nEstá en: ${articleShelfName}, ${posText}.\nLlevar a: ${destText}.`;
      notifType = 'DELIVERY_REQUEST';
    } else {
      const articleToPickCode = String(data.articleToPickCode || '');
      const articleToPickOrderFab = String(data.articleToPickOrderFab || '');
      const pickupShelfName = String(data.pickupShelfName || '');
      const pickupStation = data.pickupStation != null ? Number(data.pickupStation) : null;
      const fromText = pickupShelfName
        ? `${pickupShelfName}${pickupStation ? ` (puesto ${pickupStation})` : ''}`
        : `${shelfSection} — ${shelfName}`;
      title = `${operarioName} solicita recogida`;
      body = articleToPickCode
        ? `Recoger: ${articleToPickCode}${articleToPickOrderFab ? ' ' + articleToPickOrderFab : ''}.\nEn: ${fromText}.\nLlevar a: ${destText}.`
        : `Recoger en: ${fromText}.\nLlevar a: ${destText}.`;
      notifType = 'PICKUP_QUEUE_CREATED';
    }

    const payload = {
      title,
      body,
      data: { type: notifType, requestId, shelfCode, shelfSection },
    };
    // Si la solicitud está asignada a un carretillero concreto, solo a él le llega
    // el push (y el popup bloqueante). El resto la verá en su cola.
    if (targetCarretilleroId) {
      await notifyUserById(targetCarretilleroId, payload);
    } else {
      await notifyUsersByRole('CARRETILLERO', payload);
    }
    return null;
  });

export const notifySpecialLocationOccupancy = functions.firestore
  .document('shelves/{shelfCode}/locations/{position}')
  .onWrite(async (change: any, context: any) => {
    if (!change.after.exists) return null;
    const shelfCode = normalize(context.params.shelfCode);
    const rawPosition = String(context.params.position);
    const position = parseLocationPosition(rawPosition);
    if (!position) return null;
    const config = await getAppConfig();
    const urgentLocations = Array.isArray(config.urgentLocations) ? config.urgentLocations : [];
    const techReviewLocations = Array.isArray(config.techReviewLocations) ? config.techReviewLocations : [];
    // Identificadores candidatos para casar contra config.{urgentLocations,techReviewLocations}.
    // Formato canónico = `${shelfCode}-${posición 0-padded}` (p.ej. "PLE-001", "CAL-031"),
    // pero las celdas urgentes de Prensas/Mecanizado se guardan con una posición en
    // formato libre COMPARTIDA por ambas (p.ej. "URG MEC-PRE 001"). Casamos contra ambos
    // formatos para que el aviso urgente salte a los dos jefes (están en chiefMapping
    // PRENSAS_MECANIZADO) cuando se ubica algo en esa estantería de urgentes compartida.
    const locationId = `${shelfCode}-${String(position).padStart(3, '0')}`;
    const candidateIds = [
      locationId,                    // "PRE-001", "PLE-001", "CAL-031"
      rawPosition,                   // "URG MEC-PRE 001" (posición libre compartida)
      `${shelfCode}-${rawPosition}`, // "PRE-URG MEC-PRE 001"
    ];
    const matchesAny = (list: string[]) => list.some((entry) => candidateIds.includes(entry));
    const isUrgent = matchesAny(urgentLocations);
    const isTechReview = matchesAny(techReviewLocations);
    // Solo la estantería PRINCIPAL de soldadura (SOL). RSO/SXP/CS quedan FUERA: SXP es
    // su propia sección con jefe dedicado y RSO/CS no deben avisar al jefe de soldadura.
    const isSoldadura = shelfCode === 'SOL';
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
        // Jefes de sección: push + fallback persistente (modal rojo al reentrar si offline).
        notifyUrgentChiefsWithFallback(urgentChiefEmails, {
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
          title: 'Artículo en Reprocesos',
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
        title: 'Desconexión WiFi detectada',
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
        title: 'Desconexión WiFi detectada',
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

// Detección de dispositivos sin conexión POR HEARTBEAT OBSOLETO (server-side).
//
// Por qué no basta `notifyConnectionDisconnect`: el log DISCONNECTED y el flag
// `isOnline=false` los escribe el PROPIO dispositivo al caerse; estando offline esas
// escrituras se ENCOLAN y solo llegan al servidor cuando el kiosko RECONECTA. Por eso
// un kiosko que se queda sin conexión (o se apaga) nunca se reportaría a tiempo.
//
// Solución: el dispositivo escribe `lastSeen` cada 60s mientras está online (heartbeat).
// Aquí detectamos los `conexion_estado` cuyo `lastSeen` quedó obsoleto (>5 min) — eso
// SÍ es señal fiable de caída, sin depender de que el cliente escriba nada estando ya
// offline — y avisamos al SUPERADMIN.
export const notifyLongDisconnection = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('Europe/Madrid')
  .onRun(async () => {
    const now = Date.now();
    const STALE_MS = 5 * 60 * 1000;        // sin heartbeat > 5 min → sin conexión
    const REALERT_MS = 60 * 60 * 1000;     // no repetir el aviso del mismo equipo en 1h
    const staleThreshold = new Date(now - STALE_MS).toISOString();
    const reAlertThreshold = new Date(now - REALERT_MS).toISOString();

    const statusSnapshot = await admin.firestore()
      .collection('conexion_estado')
      .where('lastSeen', '<=', staleThreshold)
      .get();

    const staleDevices = statusSnapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
      // Los PCs de administración se apagan con normalidad: no generan alarma.
      .filter((d: any) => String(d.deviceType || '').toUpperCase() !== 'ADMIN')
      .filter((d: any) => !d.lastCriticalAlertAt || d.lastCriticalAlertAt < reAlertThreshold);

    if (staleDevices.length === 0) return { checked: statusSnapshot.size, alerted: 0 };

    const deviceList = staleDevices
      .map((d: any) => {
        const mins = d.lastSeen ? Math.floor((now - new Date(d.lastSeen).getTime()) / 60000) : null;
        return `${d.deviceName || d.id} (${d.deviceType || 'desconocido'})${mins != null ? ` — ${mins}m sin conexión` : ''}`;
      })
      .join('\n');

    await notifyUsersByRole('SUPERADMIN', {
      title: 'Kiosko sin conexión',
      body: `${staleDevices.length} dispositivo(s) sin conexión:\n${deviceList}`,
      data: {
        type: 'CRITICAL_OFFLINE_ALERT',
        deviceCount: String(staleDevices.length),
      }
    }).catch((err) => {
      console.error('[notifyLongDisconnection] Error sending critical alert:', err);
    });

    const alertedAt = new Date(now).toISOString();
    const db = admin.firestore();
    const batchUpdate = db.batch();
    staleDevices.forEach((device: any) => {
      batchUpdate.update(db.collection('conexion_estado').doc(device.id), { lastCriticalAlertAt: alertedAt });
    });
    await batchUpdate.commit().catch((err) => console.error('[notifyLongDisconnection] batch update failed:', err));

    return { checked: statusSnapshot.size, alerted: staleDevices.length };
  });

const toStation = (value: unknown): number | null => {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isNaN(n) ? null : n;
};

export const pickupQueueOperate = functions.https.onCall(async (data: any, context: any) => {
  const actor = await resolveOperationalActor(context, data?.session);
  const op = String(data?.op || '');
  const payload = data?.payload || {};

  if (op === 'carretilleros') {
    const docs = await getUsersByRole('CARRETILLERO');
    const carretilleros = docs.map((d) => {
      const u = d.data() || {};
      return { uid: d.id, name: String(u.displayName || u.email || d.id) };
    });
    return { ok: true, carretilleros };
  }

  if (op === 'create') {
    const shelfCode = String(payload?.shelfCode || actor.assignedShelf || '').trim().toUpperCase();
    const operarioId = String(payload?.operarioId || actor.operarioId || actor.uid).trim();
    const operarioName = String(payload?.operarioName || actor.operarioName || actor.email || actor.uid).trim();
    const shelfName = String(payload?.shelfName || shelfCode).trim() || shelfCode;
    const requestType = String(payload?.requestType || 'RECOGER').trim().toUpperCase();
    if (!shelfCode || !operarioId) {
      throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para crear recogida.');
    }
    // Validar autorización de estantería del solicitante (no del origen/destino,
    // que son la tarea que se le encarga al carretillero).
    assertActorMayOperateShelf(actor, shelfCode);
    const createdAt = new Date().toISOString();
    const targetCarretilleroId = String(payload?.targetCarretilleroId || '').trim();
    const targetCarretilleroName = String(payload?.targetCarretilleroName || '').trim();
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
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
      ...(targetCarretilleroId ? { targetCarretilleroId, targetCarretilleroName } : {}),
    };
    // Destino explícito (RECOGER y TRAER). La sección/estación las decide el cliente.
    const destinationShelfCode = String(payload?.destinationShelfCode || '').trim();
    if (destinationShelfCode) {
      docData.destinationShelfCode = destinationShelfCode;
      docData.destinationShelfName = String(payload?.destinationShelfName || destinationShelfCode).trim();
      docData.destinationSection = String(payload?.destinationSection || '').trim() || getWmsSectionForShelf(destinationShelfCode);
      docData.destinationStation = toStation(payload?.destinationStation);
    }
    if (requestType === 'RECEPCION') {
      // RECEPCIÓN — sin datos que indicar: el carretillero solo va a Recepciones a
      // por el material recepcionado. No lleva artículo, origen ni destino.
    } else if (requestType === 'TRAER') {
      docData.articleCode = String(payload?.articleCode || '').trim();
      docData.articleOrderFab = String(payload?.articleOrderFab || '').trim();
      docData.articleShelfName = String(payload?.articleShelfName || '').trim();
      docData.articlePositions = Array.isArray(payload?.articlePositions)
        ? payload.articlePositions.map((p: unknown) => String(p))
        : [];
    } else {
      // RECOGER / SE LLEVE — artículo puede ser texto libre (no ubicado) + origen.
      docData.articleToPickCode = String(payload?.articleToPickCode || '').trim();
      docData.articleToPickOrderFab = String(payload?.articleToPickOrderFab || '').trim();
      const pickupShelfName = String(payload?.pickupShelfName || '').trim();
      if (pickupShelfName) {
        docData.pickupShelfName = pickupShelfName;
        docData.pickupSection = String(payload?.pickupSection || '').trim() || null;
        docData.pickupStation = toStation(payload?.pickupStation);
      }
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
      targetCarretilleroId: targetCarretilleroId || null,
      source: 'pickupQueueOperate',
    });
    return { ok: true, requestId: queueRef.id };
  }

  if (op === 'acknowledge') {
    if (!['CARRETILLERO', 'ADMIN', 'SUPERADMIN'].includes(actor.role)) {
      throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para confirmar solicitudes.');
    }
    const requestId = String(payload?.requestId || '').trim();
    if (!requestId) {
      throw new functions.https.HttpsError('invalid-argument', 'requestId requerido.');
    }
    const reqRef = admin.firestore().collection('pickupQueue').doc(requestId);
    await admin.firestore().runTransaction(async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Solicitud no encontrada.');
      }
      tx.update(reqRef, {
        acknowledged: true,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: actor.uid,
      });
    });
    return { ok: true };
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
