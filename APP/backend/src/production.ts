import * as functions from 'firebase-functions';
import { admin } from './firebaseAdmin';
import { normalizeRole, getWmsSectionForShelf, getUserContext, assertActorMayOperateShelf } from './authz';

const normalize = (value?: string | null) => (value || '').trim().toUpperCase();

/**
 * Parsea un locationId legacy (formato "SHELF-POSITION") en shelfCode y position.
 * Ejemplos: "PRE-E1-01" → { shelfCode: "PRE", position: "E1-01" }
 *           "PRE-001" → { shelfCode: "PRE", position: "001" }
 */
const parseLegacyLocationId = (locationId: string): { shelfCode: string; position: string } => {
  const dashIdx = locationId.indexOf('-');
  if (dashIdx < 0) {
    throw new functions.https.HttpsError('invalid-argument', `locationId invalido: '${locationId}'`);
  }
  return {
    shelfCode: locationId.substring(0, dashIdx),
    position: locationId.substring(dashIdx + 1),
  };
};

/** Extrae shelfCode y position de los parámetros (soporta v3 y legacy). */
const resolveShelfPosition = (
  shelfCode?: string,
  position?: string,
  locationId?: string,
): { shelfCode: string; position: string } => {
  if (shelfCode && position) {
    return { shelfCode: normalize(shelfCode), position: position.trim() };
  }
  if (locationId) {
    return parseLegacyLocationId(locationId);
  }
  throw new functions.https.HttpsError('invalid-argument', 'Se requiere shelfCode+position o locationId.');
};

export const productionOperate = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'auth required');

  const role = normalizeRole((context.auth.token.role as string) || '');
  const uid = context.auth.uid;
  const email = (context.auth.token.email as string) || 'unknown';
  const displayName = (context.auth.token.name as string) || email;
  const op = data?.op as string;
  const payload = data?.payload || {};
  const opId = (data?.opId as string) || admin.firestore().collection('_ops').doc().id;
  const now = new Date().toISOString();
  const db = admin.firestore();

  if (!['ADMIN', 'SUPERADMIN', 'JEFE_SECCION', 'CALIDAD'].includes(role)) {
    throw new functions.https.HttpsError('permission-denied', `Role ${role} cannot perform production operations`);
  }

  // WITHDRAW_TO_WORKING: Quita de shelves/items, añade a workingItems (transacción atómica)
  if (op === 'withdrawToWorking') {
    const { barcode, orderId, itemKey, containerId, presenceId } = payload;
    const { shelfCode, position } = resolveShelfPosition(
      payload.shelfCode,
      payload.position,
      payload.fromLocationId,
    );

    if (!barcode || !orderId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing barcode or orderId');
    }

    // Validar que el actor pueda operar la estantería
    const actorContext = await getUserContext(context as any);
    assertActorMayOperateShelf(actorContext, shelfCode);

    const aggregateKey = `${normalize(barcode)}__${normalize(orderId)}`;
    const computedItemKey = itemKey || `${normalize(barcode)}__${normalize(orderId)}${containerId ? `__${normalize(containerId)}` : ''}`;
    const section = getWmsSectionForShelf(shelfCode);
    const locationId = `${shelfCode}-${position}`;

    const locRef = db.collection('shelves').doc(shelfCode).collection('locations').doc(position);
    const aggregateRef = db.collection('itemAggregates').doc(aggregateKey);
    const workingRef = db.collection('workingItems').doc(computedItemKey);
    const historyRef = db.collection('history').doc();

    await db.runTransaction(async (tx) => {
      const [locSnap, aggregateSnap, workingDoc] = await Promise.all([
        tx.get(locRef),
        tx.get(aggregateRef),
        tx.get(workingRef),
      ]);

      if (workingDoc.exists) {
        throw new functions.https.HttpsError('already-exists', 'Item is already in workingItems');
      }

      const locItems = (locSnap.data()?.items || []) as any[];
      // Buscar item por presenceId (preferido) o por articleCode+orderFab
      const itemIndex = locItems.findIndex((i: any) => {
        if (presenceId && i.presenceId) return i.presenceId === presenceId;
        return normalize(i.articleCode) === normalize(barcode) && normalize(i.orderFab) === normalize(orderId);
      });

      if (itemIndex < 0) {
        throw new functions.https.HttpsError('not-found', 'Item not found in shelf location');
      }

      const item = locItems[itemIndex];
      const removedPresenceId = item.presenceId;
      const updatedItems = locItems.filter((_: any, idx: number) => idx !== itemIndex);

      // Actualizar ubicación: eliminar item del array
      tx.set(locRef, { position, items: updatedItems, isEmpty: updatedItems.length === 0 }, { merge: true });

      // Desactivar presencia en items/
      if (removedPresenceId) {
        const presenceRef = db.collection('items').doc(removedPresenceId);
        tx.update(presenceRef, { active: false, removedAt: now, removedBy: uid, locationIds: [] });
      }

      // Actualizar aggregate: remover presenceId del array activo
      if (aggregateSnap.exists) {
        const aggregate = aggregateSnap.data() as any;
        const remainingIds = (aggregate.activePresenceIds || []).filter((id: string) => id !== removedPresenceId);
        tx.set(aggregateRef, {
          activePresenceIds: remainingIds,
          totalActivePresences: remainingIds.length,
          totalPlacements: aggregate.totalPlacements,
          updatedAt: now,
        }, { merge: true });
      }

      // Crear workingItem con datos de la ubicación v3
      const workingItem = {
        barcode,
        orderId,
        articleCode: barcode,
        orderFab: orderId,
        status: 'EN_TRABAJO',
        section,
        fromLocationId: locationId,
        shelfCode,
        position,
        withdrawnAt: now,
        withdrawnBy: displayName,
        itemKey: computedItemKey,
        presenceId: removedPresenceId,
        aggregateKey,
        assignedAt: item.locatedAt || now,
        quantity: item.quantity ?? 1,
        containerId: containerId || null,
      };

      tx.set(workingRef, workingItem, { merge: true });
      tx.set(historyRef, {
        id: historyRef.id,
        barcode,
        orderId,
        articleCode: barcode,
        orderFab: orderId,
        action: 'moved_to_working',
        fromLocation: locationId,
        toLocation: 'EN_TRABAJO',
        shelfCode,
        timestamp: now,
        uid,
        role,
        user: displayName,
        opId,
        source: 'productionOperate',
      });
    });

    console.log(`[productionOperate] withdrawToWorking SUCCESS: ${barcode} ${orderId} from ${shelfCode}-${position}`);
    return { ok: true, opId, itemKey: computedItemKey };
  }

  // FINISH_WORKING: Quita de workingItems, añade a finishedItems
  if (op === 'finishWorking') {
    const { itemKey, barcode, orderId, packageType } = payload;
    if (!itemKey || !barcode || !orderId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing itemKey, barcode, or orderId');
    }

    const workingRef = db.collection('workingItems').doc(itemKey);
    const finishedRef = db.collection('finishedItems').doc(itemKey);
    const historyRef = db.collection('history').doc();

    await db.runTransaction(async (tx) => {
      const workingDoc = await tx.get(workingRef);
      if (!workingDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Item not in workingItems');
      }

      const workingData = workingDoc.data() as any;

      const finishedItem = {
        id: itemKey,
        barcode,
        orderId,
        articleCode: barcode,
        orderFab: orderId,
        timestamp: now,
        finishedAt: now,
        finishedBy: displayName,
        status: 'FINALIZADO',
        previousStatus: 'EN_TRABAJO',
        packageType: packageType || null,
        shelfCode: workingData.shelfCode || null,
        position: workingData.position || null,
        fromLocationId: workingData.fromLocationId || null,
        presenceId: workingData.presenceId || null,
        aggregateKey: workingData.aggregateKey || null,
      };

      tx.set(finishedRef, finishedItem);
      tx.delete(workingRef);
      tx.set(historyRef, {
        id: historyRef.id,
        barcode,
        orderId,
        articleCode: barcode,
        orderFab: orderId,
        action: 'process_finished',
        fromLocation: 'EN_TRABAJO',
        toLocation: 'FINALIZADO',
        shelfCode: workingData.shelfCode || null,
        timestamp: now,
        uid,
        role,
        user: displayName,
        opId,
        source: 'productionOperate',
      });
    });

    console.log(`[productionOperate] finishWorking SUCCESS: ${itemKey}`);
    return { ok: true, opId, itemKey };
  }

  // LOCATE_WORKING: Quita de workingItems, añade a shelves/ + items/ (v3)
  if (op === 'locateWorking') {
    const { itemKey, barcode, orderId, toShelfCode, toPosition } = payload;
    const { shelfCode: targetShelfCode, position: targetPosition } = resolveShelfPosition(
      toShelfCode,
      toPosition,
      payload.toLocation,
    );

    if (!itemKey || !barcode || !orderId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    // Validar que el actor pueda operar la estantería destino
    const actorContext = await getUserContext(context as any);
    assertActorMayOperateShelf(actorContext, targetShelfCode);

    const aggregateKey = `${normalize(barcode)}__${normalize(orderId)}`;
    const locationId = `${targetShelfCode}-${targetPosition}`;
    const locRef = db.collection('shelves').doc(targetShelfCode).collection('locations').doc(targetPosition);
    const aggregateRef = db.collection('itemAggregates').doc(aggregateKey);
    const presenceRef = db.collection('items').doc();
    const workingRef = db.collection('workingItems').doc(itemKey);
    const historyRef = db.collection('history').doc();

    await db.runTransaction(async (tx) => {
      const [locSnap, aggregateSnap, workingDoc] = await Promise.all([
        tx.get(locRef),
        tx.get(aggregateRef),
        tx.get(workingRef),
      ]);

      if (!workingDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Item not in workingItems');
      }

      const currentItems = (locSnap.data()?.items || []) as any[];

      // Verificar que no exista ya el mismo artículo en la ubicación destino
      const alreadyExists = currentItems.some((i: any) =>
        normalize(i.articleCode) === normalize(barcode) && normalize(i.orderFab) === normalize(orderId)
      );

      if (alreadyExists) {
        throw new functions.https.HttpsError('already-exists',
          `El artículo ${barcode} | ${orderId} ya existe en ${locationId}`);
      }

      // Crear presencia en items/
      const newItem = {
        presenceId: presenceRef.id,
        articleCode: barcode,
        orderFab: orderId,
        locatedBy: uid,
        locatedByName: displayName,
        locatedAt: now,
      };

      // Actualizar ubicación: añadir item al array
      tx.set(locRef, {
        position: targetPosition,
        items: [...currentItems, newItem],
        isEmpty: false,
      }, { merge: true });

      // Crear documento de presencia
      tx.set(presenceRef, {
        presenceId: presenceRef.id,
        aggregateKey,
        articleCode: barcode,
        orderFab: orderId,
        locationIds: [locationId],
        shelfCode: targetShelfCode,
        shelfCodes: [targetShelfCode],
        locatedBy: uid,
        locatedByName: displayName,
        locatedAt: now,
        active: true,
      });

      // Actualizar aggregate
      if (aggregateSnap.exists) {
        const aggregate = aggregateSnap.data() as any;
        const currentIds: string[] = aggregate.activePresenceIds || [];
        tx.set(aggregateRef, {
          activePresenceIds: [...currentIds, presenceRef.id],
          totalActivePresences: (aggregate.totalActivePresences || 0) + 1,
          totalPlacements: (aggregate.totalPlacements || 0) + 1,
          updatedAt: now,
        }, { merge: true });
      } else {
        tx.set(aggregateRef, {
          aggregateKey,
          articleCode: barcode,
          orderFab: orderId,
          activePresenceIds: [presenceRef.id],
          totalActivePresences: 1,
          totalPlacements: 1,
          updatedAt: now,
        });
      }

      // Eliminar de workingItems
      tx.delete(workingRef);

      tx.set(historyRef, {
        id: historyRef.id,
        barcode,
        orderId,
        articleCode: barcode,
        orderFab: orderId,
        action: 'relocated',
        fromLocation: 'EN_TRABAJO',
        toLocation: locationId,
        shelfCode: targetShelfCode,
        timestamp: now,
        uid,
        role,
        user: displayName,
        opId,
        source: 'productionOperate',
      });
    });

    console.log(`[productionOperate] locateWorking SUCCESS: ${itemKey} → ${targetShelfCode}-${targetPosition}`);
    return { ok: true, opId, itemKey };
  }

  throw new functions.https.HttpsError('invalid-argument', `Unknown operation: ${op}`);
});
