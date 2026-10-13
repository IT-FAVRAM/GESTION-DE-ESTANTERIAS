import * as functions from 'firebase-functions';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const URGENCY_ALLOWED_ROLES = new Set(['ADMIN', 'SUPERADMIN']);

const assertUrgencyAuth = async (uid: string): Promise<string> => {
  const db = getFirestore();
  const userDoc = await db.collection('usuarios').doc(uid).get();
  const role = String(userDoc.data()?.role || '').toUpperCase();
  if (!URGENCY_ALLOWED_ROLES.has(role)) {
    throw new functions.https.HttpsError('permission-denied', 'Solo ADMIN y SUPERADMIN pueden gestionar urgencias.');
  }
  return userDoc.data()?.displayName || 'Unknown';
};

interface SetPinnedUrgencyRequest {
  text: string;
  articleCode: string;
  articleName?: string;
  orderId: string;
  orderNumber?: string;
}

/**
 * Cloud Function: setPinnedUrgency
 * Crea o actualiza un aviso fijado.
 * Solo los 5 usuarios autorizados pueden hacerlo.
 * Validación: máximo uno por (articleCode + orderId).
 */
export const setPinnedUrgency = functions.https.onCall(
  async (data: SetPinnedUrgencyRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = context.auth.uid;
    const db = getFirestore();

    const displayName = await assertUrgencyAuth(uid);

    if (!data.text || !data.articleCode || !data.orderId) {
      throw new functions.https.HttpsError('invalid-argument', 'text, articleCode y orderId son obligatorios');
    }

    // Buscar si ya existe un aviso para esta combinación (articleCode + orderId)
    const existingQuery = await db
      .collection('chat')
      .doc('general')
      .collection('pinned')
      .where('articleCode', '==', data.articleCode)
      .where('orderId', '==', data.orderId)
      .get();

    const existingDoc = existingQuery.docs[0];

    if (existingDoc) {
      // Actualizar
      await existingDoc.ref.update({
        text: data.text,
        articleName: data.articleName || null,
        orderNumber: data.orderNumber || null,
        pinnedBy: uid,
        pinnedByName: displayName,
        updatedAt: Timestamp.now(),
      });
      return { success: true, id: existingDoc.id, action: 'updated' };
    } else {
      // Crear nuevo
      const newDocRef = db
        .collection('chat')
        .doc('general')
        .collection('pinned')
        .doc(); // auto-generate id

      await newDocRef.set({
        text: data.text,
        articleCode: data.articleCode,
        articleName: data.articleName || null,
        orderId: data.orderId,
        orderNumber: data.orderNumber || null,
        pinnedBy: uid,
        pinnedByName: displayName,
        pinnedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      return { success: true, id: newDocRef.id, action: 'created' };
    }
  }
);

interface RemovePinnedUrgencyRequest {
  pinnedId: string;
}

/**
 * Cloud Function: removePinnedUrgency
 * Elimina un aviso fijado.
 * Solo el usuario que lo creó o los autorizados pueden eliminarlo.
 */
export const removePinnedUrgency = functions.https.onCall(
  async (data: RemovePinnedUrgencyRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = context.auth.uid;
    const db = getFirestore();

    await assertUrgencyAuth(uid);

    if (!data.pinnedId) {
      throw new functions.https.HttpsError('invalid-argument', 'pinnedId is required');
    }

    // Obtener el documento
    const pinnedRef = db
      .collection('chat')
      .doc('general')
      .collection('pinned')
      .doc(data.pinnedId);

    const pinnedDoc = await pinnedRef.get();
    if (!pinnedDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Pinned urgency not found'
      );
    }

    // Eliminar
    await pinnedRef.delete();
    return { success: true, id: data.pinnedId, action: 'deleted' };
  }
);
