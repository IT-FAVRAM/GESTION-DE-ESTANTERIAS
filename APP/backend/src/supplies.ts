import * as functions from 'firebase-functions';
import { admin } from './firebaseAdmin';
import { resolveOperationalActor } from './authz';

const ALLOWED_COLLECTIONS = ['supplies_soldadura', 'supplies_carts'];

export const suppliesOperate = functions.https.onCall(async (data: any, context: any) => {
  const actor = await resolveOperationalActor(context, data?.session);
  if (!['ADMIN', 'SUPERADMIN', 'JEFE_SECCION'].includes(actor.role)) {
    throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para gestionar suministros.');
  }

  const op = String(data?.op || '');
  const payload = data?.payload || {};
  const collection = String(payload?.collection || '').trim();
  const docId = String(payload?.docId || '').trim();

  if (!ALLOWED_COLLECTIONS.includes(collection)) {
    throw new functions.https.HttpsError('invalid-argument', `Colección no permitida: ${collection}`);
  }
  if (!docId) {
    throw new functions.https.HttpsError('invalid-argument', 'docId es requerido.');
  }

  const db = admin.firestore();
  const now = new Date().toISOString();

  if (op === 'addItem') {
    const shelfId = String(payload?.shelfId || '').trim();
    const type = String(payload?.type || 'article').trim();
    const description = String(payload?.description || '').trim();
    const barcode = String(payload?.barcode || '').trim();
    const orderId = String(payload?.orderId || '').trim();
    if (!shelfId || !description) {
      throw new functions.https.HttpsError('invalid-argument', 'shelfId y description son requeridos.');
    }
    const itemRef = db.collection(collection).doc(docId).collection('items').doc();
    await itemRef.set({
      id: itemRef.id,
      shelfId,
      type,
      description,
      barcode: barcode || undefined,
      orderId: orderId || undefined,
      addedBy: actor.uid,
      createdAt: now,
    });
    return { ok: true, itemId: itemRef.id };
  }

  if (op === 'removeItems') {
    const itemIds: string[] = Array.isArray(payload?.itemIds) ? payload.itemIds : [];
    if (itemIds.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'itemIds array es requerido.');
    }
    const batch = db.batch();
    itemIds.forEach((id) => {
      const ref = db.collection(collection).doc(docId).collection('items').doc(id);
      batch.delete(ref);
    });
    await batch.commit();
    return { ok: true, removed: itemIds.length };
  }

  if (op === 'moveItems') {
    const itemIds: string[] = Array.isArray(payload?.itemIds) ? payload.itemIds : [];
    const targetShelfId = String(payload?.targetShelfId || '').trim();
    if (itemIds.length === 0 || !targetShelfId) {
      throw new functions.https.HttpsError('invalid-argument', 'itemIds array y targetShelfId son requeridos.');
    }
    const batch = db.batch();
    itemIds.forEach((id) => {
      const ref = db.collection(collection).doc(docId).collection('items').doc(id);
      batch.update(ref, { shelfId: targetShelfId });
    });
    await batch.commit();
    return { ok: true, moved: itemIds.length };
  }

  throw new functions.https.HttpsError('invalid-argument', `Operación desconocida: ${op}`);
});
