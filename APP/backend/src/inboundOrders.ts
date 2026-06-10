import * as functions from 'firebase-functions';
import { admin } from './firebaseAdmin';
import { resolveOperationalActor } from './authz';

export const inboundOrdersOperate = functions.https.onCall(async (data: any, context: any) => {
  const actor = await resolveOperationalActor(context, data?.session);
  if (!['ADMIN', 'SUPERADMIN'].includes(actor.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Solo administradores pueden gestionar pedidos.');
  }

  const op = String(data?.op || '');
  const payload = data?.payload || {};
  const db = admin.firestore();

  if (op === 'create') {
    const orderNumber = String(payload?.orderNumber || '').trim();
    if (!orderNumber) {
      throw new functions.https.HttpsError('invalid-argument', 'orderNumber es requerido.');
    }
    await db.collection('inboundOrders').doc(orderNumber).set({
      ...payload,
      orderNumber,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true };
  }

  if (op === 'update') {
    const orderId = String(payload?.orderId || '').trim();
    if (!orderId) {
      throw new functions.https.HttpsError('invalid-argument', 'orderId es requerido.');
    }
    const { orderId: _id, ...updates } = payload;
    await db.collection('inboundOrders').doc(orderId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true };
  }

  if (op === 'delete') {
    const orderId = String(payload?.orderId || '').trim();
    if (!orderId) {
      throw new functions.https.HttpsError('invalid-argument', 'orderId es requerido.');
    }
    await db.collection('inboundOrders').doc(orderId).delete();
    return { ok: true };
  }

  throw new functions.https.HttpsError('invalid-argument', `Operación desconocida: ${op}`);
});
