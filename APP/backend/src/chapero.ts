import * as functions from 'firebase-functions';
import { admin } from './firebaseAdmin';
import { resolveOperationalActor } from './authz';

const CHAPERO_ALLOWED_ROLES = ['CARRETILLERO', 'ADMIN', 'SUPERADMIN', 'JEFE_SECCION'];

const assertChaperoAccess = async (actor: { role: string; uid: string; section: string | null }) => {
  if (actor.role === 'JEFE_SECCION') {
    const section = actor.section?.toUpperCase() ?? '';
    if (section !== 'PUNZONADO') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Solo el jefe de PUNZONADO puede acceder al chapero.',
      );
    }
    return;
  }
  if (!CHAPERO_ALLOWED_ROLES.includes(actor.role)) {
    throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para acceder al chapero.');
  }
};

const generateItemId = (uid: string): string => `${uid}-${Date.now()}`;

export const chaperoOperate = functions.https.onCall(async (data: any, context: any) => {
  const actor = await resolveOperationalActor(context, data?.session);
  await assertChaperoAccess(actor);

  const op = String(data?.op || '');
  const payload = data?.payload || {};
  const db = admin.firestore();
  const now = new Date().toISOString();

  if (op === 'ubicar') {
    const positionId = String(payload?.positionId || '').trim();
    const material = String(payload?.material || '').trim().toUpperCase();
    const spec = typeof payload?.spec === 'string' ? payload.spec.trim().toUpperCase() : undefined;
    const espesor = String(payload?.espesor || '').trim();
    const locatedByName = String(payload?.locatedByName || actor.operarioName || actor.email || actor.uid).trim();

    if (!positionId) throw new functions.https.HttpsError('invalid-argument', 'positionId es requerido.');
    if (!material) throw new functions.https.HttpsError('invalid-argument', 'material es requerido.');
    if (!espesor) throw new functions.https.HttpsError('invalid-argument', 'espesor es requerido.');

    const itemId = generateItemId(actor.uid);
    const newItem: Record<string, unknown> = {
      id: itemId,
      material,
      espesor,
      locatedBy: actor.operarioId || actor.uid,
      locatedByName,
      locatedAt: now,
    };
    if (spec) newItem.spec = spec;

    const posRef = db.collection('chapero_positions').doc(positionId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(posRef);
      const existing = snap.exists ? (snap.data()?.items ?? []) : [];
      const updated = [...existing, newItem];
      tx.set(posRef, { positionId, items: updated, isEmpty: false }, { merge: true });

      const histRef = db.collection('history').doc();
      tx.set(histRef, {
        id: histRef.id,
        timestamp: now,
        uid: actor.uid,
        role: actor.role,
        user: actor.email ?? actor.operarioId ?? actor.uid,
        source: 'chaperoOperate',
        action: 'CHAPERO_UBICAR',
        positionId,
        material,
        espesor,
        spec: spec ?? null,
        locatedByName,
        itemId,
      });
    });

    return { ok: true, itemId };
  }

  if (op === 'retirar') {
    const positionId = String(payload?.positionId || '').trim();
    const itemIds: string[] = Array.isArray(payload?.itemIds) ? payload.itemIds : [];

    if (!positionId) throw new functions.https.HttpsError('invalid-argument', 'positionId es requerido.');
    if (itemIds.length === 0) throw new functions.https.HttpsError('invalid-argument', 'itemIds no puede estar vacío.');

    const posRef = db.collection('chapero_positions').doc(positionId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(posRef);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Posición no encontrada.');
      const existing: any[] = snap.data()?.items ?? [];
      const removed = existing.filter((it: any) => itemIds.includes(it.id));
      const remaining = existing.filter((it: any) => !itemIds.includes(it.id));
      tx.set(posRef, { items: remaining, isEmpty: remaining.length === 0 }, { merge: true });

      const histRef = db.collection('history').doc();
      tx.set(histRef, {
        id: histRef.id,
        timestamp: now,
        uid: actor.uid,
        role: actor.role,
        user: actor.email ?? actor.operarioId ?? actor.uid,
        source: 'chaperoOperate',
        action: 'CHAPERO_RETIRAR',
        positionId,
        removedItems: removed,
        removedBy: actor.operarioId || actor.uid,
        removedByName: actor.operarioName || actor.email || actor.uid,
      });
    });

    return { ok: true, removed: itemIds.length };
  }

  if (op === 'mover') {
    const fromId = String(payload?.fromPositionId || '').trim();
    const toId = String(payload?.toPositionId || '').trim();

    if (!fromId || !toId) throw new functions.https.HttpsError('invalid-argument', 'fromPositionId y toPositionId son requeridos.');
    if (fromId === toId) throw new functions.https.HttpsError('invalid-argument', 'Origen y destino no pueden ser la misma posición.');

    const fromRef = db.collection('chapero_positions').doc(fromId);
    const toRef = db.collection('chapero_positions').doc(toId);

    await db.runTransaction(async (tx) => {
      const [fromSnap, toSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
      const fromItems: any[] = fromSnap.exists ? (fromSnap.data()?.items ?? []) : [];
      if (fromItems.length === 0) throw new functions.https.HttpsError('not-found', 'La posición origen está vacía.');
      const toItems: any[] = toSnap.exists ? (toSnap.data()?.items ?? []) : [];
      const merged = [...toItems, ...fromItems];

      tx.set(fromRef, { items: [], isEmpty: true }, { merge: true });
      tx.set(toRef, { positionId: toId, items: merged, isEmpty: false }, { merge: true });

      const histRef = db.collection('history').doc();
      tx.set(histRef, {
        id: histRef.id,
        timestamp: now,
        uid: actor.uid,
        role: actor.role,
        user: actor.email ?? actor.operarioId ?? actor.uid,
        source: 'chaperoOperate',
        action: 'CHAPERO_MOVER',
        fromPositionId: fromId,
        toPositionId: toId,
        movedItems: fromItems,
        movedByName: actor.operarioName || actor.email || actor.uid,
      });
    });

    return { ok: true };
  }

  throw new functions.https.HttpsError('invalid-argument', `Operación desconocida: ${op}`);
});
