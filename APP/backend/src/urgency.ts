import * as functions from 'firebase-functions';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

// 5 usuarios autorizados para fijar/desfijar avisos
const AUTHORIZED_UIDS = [
  'Ll6yHQJhRHhFaEjIaxHEJjmIm3v2', // Dani
  'SDACLBwzI7azGHr6rHvT6QRsC4Q2', // Luis Asensio
  '6Shfl3VCKSNM4mJoibQCkh4xS5f2', // Alberto Barrientos
  'vpLAHVgUybXsVSRXXkhwmfDokJI3', // Jorge Diaz
  'lyWm2ALpu7S9BemL0bQARXFYqkJ3', // Juanma Gomez
];

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
    // Validar autenticación
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = context.auth.uid;
    const db = getFirestore();

    // Validar autorización
    if (!AUTHORIZED_UIDS.includes(uid)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You are not authorized to set urgencies'
      );
    }

    // Validar campos obligatorios
    if (!data.text || !data.articleCode || !data.orderId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'text, articleCode, and orderId are required'
      );
    }

    // Obtener displayName del usuario
    let displayName = 'Unknown';
    try {
      const userDoc = await db.collection('usuarios').doc(uid).get();
      if (userDoc.exists) {
        displayName = userDoc.data()?.displayName || 'Unknown';
      }
    } catch (e) {
      console.warn('Could not fetch user displayName:', e);
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
    // Validar autenticación
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = context.auth.uid;
    const db = getFirestore();

    // Validar autorización
    if (!AUTHORIZED_UIDS.includes(uid)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You are not authorized to remove urgencies'
      );
    }

    // Validar pinnedId
    if (!data.pinnedId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'pinnedId is required'
      );
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
