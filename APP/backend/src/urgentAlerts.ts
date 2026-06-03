import * as functions from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ALERT_ALLOWED_ROLES = new Set(['ADMIN', 'SUPERADMIN']);

const assertAlertAuth = async (uid: string): Promise<string> => {
  const db = getFirestore();
  const userDoc = await db.collection('usuarios').doc(uid).get();
  const role = String(userDoc.data()?.role || '').toUpperCase();
  if (!ALERT_ALLOWED_ROLES.has(role)) {
    throw new functions.https.HttpsError('permission-denied', 'Solo ADMIN y SUPERADMIN pueden gestionar alertas de urgencia.');
  }
  return userDoc.data()?.displayName || 'Unknown';
};

interface CreateUrgentAlertRequest {
  text: string;
  articleCode: string;
  articleName?: string;
  orderId: string;
  orderNumber?: string;
}

/**
 * createUrgentAlert — crea o actualiza una alerta de urgencia en `urgent_alerts/`.
 * Misma lógica de upsert por (articleCode + orderId) que el sistema anterior.
 * Solo ADMIN/SUPERADMIN.
 */
export const createUrgentAlert = functions.https.onCall(
  async (data: CreateUrgentAlertRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = context.auth.uid;
    const db = getFirestore();
    const displayName = await assertAlertAuth(uid);

    if (!data.text || !data.articleCode || !data.orderId) {
      throw new functions.https.HttpsError('invalid-argument', 'text, articleCode y orderId son obligatorios');
    }

    const existing = await db
      .collection('urgent_alerts')
      .where('articleCode', '==', data.articleCode)
      .where('orderId', '==', data.orderId)
      .where('resolved', '==', false)
      .get();

    const existingDoc = existing.docs[0];

    if (existingDoc) {
      await existingDoc.ref.update({
        text: data.text,
        articleName: data.articleName || null,
        orderNumber: data.orderNumber || null,
        createdBy: uid,
        createdByName: displayName,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { success: true, id: existingDoc.id, action: 'updated' };
    }

    const newRef = db.collection('urgent_alerts').doc();
    await newRef.set({
      text: data.text,
      articleCode: data.articleCode,
      articleName: data.articleName || null,
      orderId: data.orderId,
      orderNumber: data.orderNumber || null,
      createdBy: uid,
      createdByName: displayName,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      resolved: false,
      resolvedAt: null,
      resolvedBy: null,
      resolvedByName: null,
    });

    return { success: true, id: newRef.id, action: 'created' };
  },
);

interface ResolveUrgentAlertRequest {
  alertId: string;
}

/**
 * resolveUrgentAlert — marca una alerta como resuelta.
 * Solo ADMIN/SUPERADMIN.
 */
export const resolveUrgentAlert = functions.https.onCall(
  async (data: ResolveUrgentAlertRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = context.auth.uid;
    const db = getFirestore();
    const displayName = await assertAlertAuth(uid);

    if (!data.alertId) {
      throw new functions.https.HttpsError('invalid-argument', 'alertId is required');
    }

    const alertRef = db.collection('urgent_alerts').doc(data.alertId);
    const alertDoc = await alertRef.get();

    if (!alertDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Alerta de urgencia no encontrada');
    }

    await alertRef.update({
      resolved: true,
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: uid,
      resolvedByName: displayName,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, id: data.alertId, action: 'resolved' };
  },
);

interface DeleteUrgentAlertRequest {
  alertId: string;
}

/**
 * deleteUrgentAlert — elimina físicamente una alerta. Para limpieza de datos.
 * Solo ADMIN/SUPERADMIN.
 */
export const deleteUrgentAlert = functions.https.onCall(
  async (data: DeleteUrgentAlertRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = context.auth.uid;
    const db = getFirestore();

    await assertAlertAuth(uid);

    if (!data.alertId) {
      throw new functions.https.HttpsError('invalid-argument', 'alertId is required');
    }

    const alertRef = db.collection('urgent_alerts').doc(data.alertId);
    const alertDoc = await alertRef.get();

    if (!alertDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Alerta de urgencia no encontrada');
    }

    await alertRef.delete();
    return { success: true, id: data.alertId, action: 'deleted' };
  },
);
