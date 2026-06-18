import * as functions from 'firebase-functions';
import { admin } from './firebaseAdmin';
import {
  assertActorMayOperateShelf,
  getWmsSectionForShelf,
  requireAllowedRoles,
  resolveOperationalActor,
} from './authz';

const normalize = (value?: string | null) => (value || '').trim().toUpperCase();

/** Normaliza shelfCode para búsqueda: MEC/PME → PRE (consolidación PRE+MEC) */
const normalizeShelfCodeForSearch = (shelfCode: string): string => {
  const normalized = shelfCode.toUpperCase().trim();
  if (normalized === 'MEC' || normalized === 'PME') return 'PRE';
  return normalized;
};

const isSameIdentity = (
  item: any,
  barcode: string,
  orderId?: string,
  itemKey?: string,
  containerId?: string,
) => {
  const byKey = normalize(itemKey || item?.itemKey);
  if (byKey) return normalize(item?.itemKey) === byKey;
  const barcodeMatch = normalize(item?.barcode) === normalize(barcode);
  const orderMatch = !orderId || normalize(item?.orderId) === normalize(orderId);
  const containerMatch = !containerId || normalize(item?.containerId) === normalize(containerId);
  return barcodeMatch && orderMatch && containerMatch;
};

/**
 * Deduplica artículos basado en presenceId.
 * Previene duplicación cuando offline operations se reintenten.
 * presenceId format: {uid}-{timestamp}-{shelfCode}-{position}
 * Esto permite al backend deduplicar basado en la operación original.
 */
const samePresence = (item: any, presenceId: string, articleCode: string, orderFab: string) => {
  if (item?.presenceId) {
    return item.presenceId === presenceId;
  }
  return normalize(item?.articleCode) === normalize(articleCode) && normalize(item?.orderFab) === normalize(orderFab);
};

// ── Ubicaciones urgentes compartidas URG MEC-PRE ─────────────────────────────
// PRE (Prensas) y MEC (Mecanizado) comparten físicamente las 4 ubicaciones
// "URG MEC-PRE 001..004". En Firestore son documentos separados
// (shelves/PRE/locations/... y shelves/MEC/locations/...), así que cualquier
// alta/baja en una debe espejarse en la otra. Modelo: una sola presencia
// canónica (no se duplican contadores) + el array `items` del doc de ubicación
// espejado en ambas estanterías. El item espejado lleva el MISMO presenceId, de
// modo que las retiradas (que filtran por presenceId) funcionan en ambos lados.
const URG_TWIN: Record<string, string> = { PRE: 'MEC', MEC: 'PRE' };

/** Devuelve el shelfCode gemelo si la posición es una urgente compartida, o null. */
const urgentTwinShelf = (shelfCode: string, position: string): string | null => {
  if (!position || !position.startsWith('URG MEC-PRE')) return null;
  return URG_TWIN[normalize(shelfCode)] ?? null;
};

/** Ref del documento de ubicación gemelo (o null si la posición no es compartida). */
const twinLocRefFor = (
  db: FirebaseFirestore.Firestore,
  shelfCode: string,
  position: string,
) => {
  const twin = urgentTwinShelf(shelfCode, position);
  return twin ? db.collection('shelves').doc(twin).collection('locations').doc(position) : null;
};

/** Espeja un alta: añade `item` al array `items` del doc gemelo. */
const mirrorAppend = (
  tx: FirebaseFirestore.Transaction,
  twinLocRef: FirebaseFirestore.DocumentReference | null,
  twinSnap: FirebaseFirestore.DocumentSnapshot | undefined,
  position: string,
  item: any,
  pendingItemsByPath?: Map<string, any[]>,
) => {
  if (!twinLocRef) return;
  const twinData = twinSnap?.exists ? twinSnap.data() : {};
  let cur = twinSnap?.exists ? ((twinData?.items || []) as any[]) : [];
  if (pendingItemsByPath?.has(twinLocRef.path)) {
    cur = pendingItemsByPath.get(twinLocRef.path)!;
  }

  // CRITICAL FIX: Validar que presenceId NO exista ya en ubicación gemela (evita duplicación)
  const presenceIdExists = cur.some((it) => it?.presenceId === item?.presenceId);
  if (presenceIdExists) {
    // presenceId ya existe → no duplicar
    return;
  }

  const newItems = [...cur, item];
  if (pendingItemsByPath) pendingItemsByPath.set(twinLocRef.path, newItems);

  // ✅ FIX #9: Copiar `nota` y otros campos de la ubicación gemela
  const notaToPreserve = twinData?.nota;
  tx.set(twinLocRef, { position, items: newItems, isEmpty: false, ...(notaToPreserve ? { nota: notaToPreserve } : {}) }, { merge: true });
};

/** ✅ FIX #6: Determina los shelfCodes para una posición (soporta ubicaciones compartidas). */
const getShelfCodesForPosition = (shelfCode: string, position: string): string[] => {
  const isTwin = position && position.startsWith('URG MEC-PRE');
  if (isTwin) {
    // Los datos de las ubicaciones URG compartidas viven en PRE y MEC (espejo
    // vía URG_TWIN). No hay colección 'PME', así que no debe figurar aquí.
    return ['PRE', 'MEC'];
  }
  return [shelfCode];
};

/** Espeja una baja: elimina la presencia del array `items` del doc gemelo. */
const mirrorRemove = (
  tx: FirebaseFirestore.Transaction,
  twinLocRef: FirebaseFirestore.DocumentReference | null,
  twinSnap: FirebaseFirestore.DocumentSnapshot | undefined,
  position: string,
  presenceId: string,
  articleCode: string,
  orderFab: string,
  pendingItemsByPath?: Map<string, any[]>,
) => {
  if (!twinLocRef || !twinSnap?.exists) return;
  
  let cur = (twinSnap.data()?.items || []) as any[];
  if (pendingItemsByPath?.has(twinLocRef.path)) {
    cur = pendingItemsByPath.get(twinLocRef.path)!;
  }
  
  const updated = cur.filter((it) => !samePresence(it, presenceId, articleCode, orderFab));
  if (pendingItemsByPath) pendingItemsByPath.set(twinLocRef.path, updated);
  
  tx.set(twinLocRef, { position, items: updated, isEmpty: updated.length === 0 }, { merge: true });
};

const sectionForWarehouse = (warehouseId: string) => getWmsSectionForShelf(warehouseId);

const canOperateWarehouse = (role: string, section: string | null, warehouseId: string) => {
  if (['ADMIN', 'CARRETILLERO', 'SUPERADMIN', 'CALIDAD'].includes(role)) return true;
  if (role === 'JEFE_SECCION') return !!section && section === sectionForWarehouse(warehouseId);
  return false;
};

export const onAssignmentWrite = functions.firestore
  .document('assignments/{warehouseId}/locations/{locationId}')
  .onWrite(async (change: any) => {
    const afterData = change.after.exists ? change.after.data() : null;
    const beforeData = change.before.exists ? change.before.data() : null;
    if (!afterData || !Array.isArray(afterData.items)) return;
    const afterItems: any[] = afterData.items;
    const beforeItems: any[] = Array.isArray(beforeData?.items) ? beforeData.items : [];
    const beforeKeys = new Set(beforeItems.map((item) => `${item.barcode}_${item.orderId}`));
    const newItems = afterItems.filter((item) => !beforeKeys.has(`${item.barcode}_${item.orderId}`));
    if (newItems.length === 0) return;
    const ordersToUpdate = new Set<string>();
    newItems.forEach((item) => {
      if (item.orderId && item.orderId !== 'PENDIENTE') ordersToUpdate.add(item.orderId);
    });
    const orderIds = Array.from(ordersToUpdate);
    const orderRefs = orderIds.map((id) => admin.firestore().collection('inboundOrders').doc(id));
    const orderDocs = await Promise.all(orderRefs.map((ref) => ref.get()));
    const inboundBatch = admin.firestore().batch();
    let hasBatchUpdates = false;
    for (let i = 0; i < orderIds.length; i++) {
      if (!orderDocs[i].exists) continue;
      inboundBatch.update(orderRefs[i], {
        fecha_disponible_estanteria: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'DISPONIBLE',
      });
      hasBatchUpdates = true;
    }
    if (hasBatchUpdates) await inboundBatch.commit();
  });

// Trigger for the new shelfOperate path (shelves/{shelfCode}/locations/{position})
// Updates inboundOrders to DISPONIBLE when articles are placed via shelfOperate.
export const onShelfLocationWrite = functions.firestore
  .document('shelves/{shelfCode}/locations/{position}')
  .onWrite(async (change: any) => {
    const afterData = change.after.exists ? change.after.data() : null;
    const beforeData = change.before.exists ? change.before.data() : null;
    if (!afterData || !Array.isArray(afterData.items)) return;
    const afterItems: any[] = afterData.items;
    const beforeItems: any[] = Array.isArray(beforeData?.items) ? beforeData.items : [];
    const beforeKeys = new Set(beforeItems.map((item) => `${item.articleCode}_${item.orderFab}`));
    const newItems = afterItems.filter((item) => !beforeKeys.has(`${item.articleCode}_${item.orderFab}`));
    if (newItems.length === 0) return;
    const ordersToUpdate = new Set<string>();
    newItems.forEach((item) => {
      if (item.orderFab && item.orderFab !== 'PENDIENTE') ordersToUpdate.add(item.orderFab);
    });
    const orderFabs = Array.from(ordersToUpdate);
    const orderRefs = orderFabs.map((of) => admin.firestore().collection('inboundOrders').doc(of));
    const orderDocs = await Promise.all(orderRefs.map((ref) => ref.get()));
    const inboundBatch = admin.firestore().batch();
    let hasBatchUpdates = false;
    for (let i = 0; i < orderFabs.length; i++) {
      if (!orderDocs[i].exists) continue;
      inboundBatch.update(orderRefs[i], {
        fecha_disponible_estanteria: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'DISPONIBLE',
      });
      hasBatchUpdates = true;
    }
    if (hasBatchUpdates) await inboundBatch.commit();
  });

/**
 * @deprecated Legacy inventory operate. Usa shelfOperate en su lugar.
 * Esta función opera sobre la colección legacy `assignments/`.
 * Mantener solo para backward compatibility; eliminar en v4.
 */
export const inventoryOperate = functions.https.onCall(async (data: any, context: any) => {
  const userCtx = await requireAllowedRoles(context, ['ADMIN', 'SUPERADMIN', 'JEFE_SECCION', 'CARRETILLERO', 'CALIDAD']);
  const uid = userCtx.uid;
  const role = userCtx.role;
  const section = userCtx.section;
  const user = userCtx.email || 'unknown';
  const op = data?.op as string;
  const payload = data?.payload || {};
  const opId = (data?.opId as string) || admin.firestore().collection('_ops').doc().id;
  const now = new Date().toISOString();

  const writeHistory = (tx: any, entry: any) => {
    const historyRef = admin.firestore().collection('history').doc();
    tx.set(historyRef, { ...entry, id: historyRef.id, timestamp: now, uid, role, user, opId, source: 'inventoryOperate' });
  };

  if (op === 'emptyShelf') {
    const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
    const isJefeSectionInScope = role === 'JEFE_SECCION' && section && payload?.warehouse && payload.warehouse.startsWith(section);
    if (!isAdmin && !isJefeSectionInScope) {
      throw new functions.https.HttpsError('permission-denied', 'Only admin or section chiefs can empty shelves');
    }
    const warehouse = payload?.warehouse as string;
    const shelf = payload?.shelf as string;
    if (!warehouse || !shelf) throw new functions.https.HttpsError('invalid-argument', 'Missing warehouse/shelf');
    if (!canOperateWarehouse(role, section, warehouse)) {
      throw new functions.https.HttpsError('permission-denied', 'Warehouse out of scope');
    }
    const prefix = `${warehouse}-E${shelf}-`;
    const snapshot = await admin.firestore().collection('assignments').doc(warehouse).collection('locations').get();
    const docs = snapshot.docs.filter((doc) => doc.id.startsWith(prefix));
    await admin.firestore().runTransaction(async (tx: any) => {
      for (const doc of docs) {
        const items = (doc.data()?.items || []) as any[];
        tx.delete(doc.ref);
        items.forEach((item) => writeHistory(tx, {
          barcode: item.barcode || '', orderId: item.orderId || '', action: 'removed', fromLocation: doc.id, toLocation: null,
        }));
      }
    });
    return { ok: true, opId, removedLocations: docs.length };
  }

  const barcode = (payload?.barcode as string) || '';
  const orderId = (payload?.orderId as string) || '';

  if (op === 'assign') {
    const locationId = payload?.locationId as string;
    if (!locationId || !barcode || !orderId) throw new functions.https.HttpsError('invalid-argument', 'Missing assign payload');
    const warehouseId = locationId.split('-')[0];
    if (!canOperateWarehouse(role, section, warehouseId)) throw new functions.https.HttpsError('permission-denied', 'Warehouse out of scope');
    const locRef = admin.firestore().collection('assignments').doc(warehouseId).collection('locations').doc(locationId);
    await admin.firestore().runTransaction(async (tx: any) => {
      const doc = await tx.get(locRef);
      const items = (doc.data()?.items || []) as any[];
      const exists = items.some((item) => isSameIdentity(item, barcode, orderId, payload?.itemKey, payload?.containerId));
      if (exists) return;
      tx.set(locRef, {
        items: [...items, { barcode, orderId, timestamp: now, assignedAt: now, movedAt: null, packageType: payload?.packageType || null, itemKey: payload?.itemKey || null, quantity: payload?.quantity ?? 1, containerId: payload?.containerId || null, notes: payload?.notes || null, status: 'UBICADO' }],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      writeHistory(tx, { barcode, orderId, action: 'assigned', fromLocation: null, toLocation: locationId });
    });
    return { ok: true, opId };
  }

  if (op === 'remove') {
    const locationId = payload?.locationId as string;
    if (!locationId || !barcode) throw new functions.https.HttpsError('invalid-argument', 'Missing remove payload');
    const warehouseId = locationId.split('-')[0];
    if (!canOperateWarehouse(role, section, warehouseId)) throw new functions.https.HttpsError('permission-denied', 'Warehouse out of scope');
    const locRef = admin.firestore().collection('assignments').doc(warehouseId).collection('locations').doc(locationId);
    await admin.firestore().runTransaction(async (tx: any) => {
      const doc = await tx.get(locRef);
      if (!doc.exists) throw new functions.https.HttpsError('not-found', 'LOCATION_NOT_FOUND');
      const items = (doc.data()?.items || []) as any[];
      const idx = items.findIndex((item) => isSameIdentity(item, barcode, orderId, payload?.itemKey, payload?.containerId));
      if (idx < 0) throw new functions.https.HttpsError('not-found', 'ITEM_NOT_FOUND');
      const item = items[idx];
      const next = [...items];
      next.splice(idx, 1);
      if (next.length === 0) tx.delete(locRef);
      else tx.set(locRef, { items: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      writeHistory(tx, { barcode, orderId: orderId || item?.orderId || '', action: 'removed', fromLocation: locationId, toLocation: null });
    });
    return { ok: true, opId };
  }

  if (op === 'move') {
    const fromLoc = payload?.fromLoc as string;
    const toLoc = payload?.toLoc as string;
    if (!fromLoc || !toLoc || !barcode || !orderId) throw new functions.https.HttpsError('invalid-argument', 'Missing move payload');
    const fromWh = fromLoc.split('-')[0];
    const toWh = toLoc.split('-')[0];
    if (!canOperateWarehouse(role, section, fromWh) || !canOperateWarehouse(role, section, toWh)) {
      throw new functions.https.HttpsError('permission-denied', 'Warehouse out of scope');
    }
    const fromRef = admin.firestore().collection('assignments').doc(fromWh).collection('locations').doc(fromLoc);
    const toRef = admin.firestore().collection('assignments').doc(toWh).collection('locations').doc(toLoc);
    await admin.firestore().runTransaction(async (tx: any) => {
      const [fromDoc, toDoc] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
      if (!fromDoc.exists) throw new functions.https.HttpsError('not-found', 'SOURCE_NOT_FOUND');
      const fromItems = (fromDoc.data()?.items || []) as any[];
      const idx = fromItems.findIndex((item) => isSameIdentity(item, barcode, orderId, payload?.itemKey, payload?.containerId));
      if (idx < 0) throw new functions.https.HttpsError('not-found', 'ITEM_NOT_FOUND');
      const item = fromItems[idx];
      const nextSource = [...fromItems];
      nextSource.splice(idx, 1);
      if (nextSource.length === 0) tx.delete(fromRef);
      else tx.set(fromRef, { items: nextSource, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      const toItems = (toDoc.data()?.items || []) as any[];
      const existsInTarget = toItems.some((target) => isSameIdentity(target, barcode, orderId, item?.itemKey, item?.containerId));
      if (!existsInTarget) {
        tx.set(toRef, { items: [...toItems, { ...item, timestamp: now, movedAt: now }], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      writeHistory(tx, { barcode, orderId, action: 'relocated', fromLocation: fromLoc, toLocation: toLoc });
    });
    return { ok: true, opId };
  }

  throw new functions.https.HttpsError('invalid-argument', `Unknown op: ${op}`);
});

export const shelfOperate = functions.https.onCall(async (data: any, context: any) => {
  const actor = await resolveOperationalActor(context, data?.session);
  const op = String(data?.op || '');
  const payload = data?.payload || {};
  const shelfCode = normalize(payload?.shelfCode || actor.assignedShelf);
  const articleCode = String(payload?.articleCode || '').trim();
  const orderFab = String(payload?.orderFab || '').trim();
  // SUBCONTRATACIÓN: artículo de etiqueta de subcontratación (código amarillo, sin OF).
  // Cuando es true se permite OF vacía y se marca el ítem para trazabilidad.
  const subcontratacion = payload?.subcontratacion === true;
  const operarioId = String(payload?.operarioId || actor.operarioId || actor.uid).trim();
  const operarioName = String(payload?.operarioName || actor.operarioName || actor.email || actor.uid).trim();
  const now = new Date().toISOString();
  const db = admin.firestore();

  if (!shelfCode) {
    throw new functions.https.HttpsError('invalid-argument', 'shelfCode requerido.');
  }

  assertActorMayOperateShelf(actor, shelfCode);

  const writeHistory = (tx: FirebaseFirestore.Transaction, entry: Record<string, unknown>) => {
    const historyRef = db.collection('history').doc();
    tx.set(historyRef, {
      ...entry,
      id: historyRef.id,
      timestamp: now,
      uid: actor.uid,
      role: actor.role,
      user: operarioName,
      source: 'shelfOperate',
    });
  };

  if (op === 'ubicar') {
    const position = String(payload?.position || '').trim();
    if (!position || !articleCode || (!orderFab && !subcontratacion)) {
      throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para ubicar.');
    }
    const locationId = `${shelfCode}-${position}`;
    const aggregateKey = `${normalize(articleCode)}__${normalize(orderFab)}`;
    const locRef = db.collection('shelves').doc(shelfCode).collection('locations').doc(position);
    const presenceRef = db.collection('items').doc();
    const aggregateRef = db.collection('itemAggregates').doc(aggregateKey);
    const twinLocRef = twinLocRefFor(db, shelfCode, position);
    await db.runTransaction(async (tx) => {
      const [locSnap, aggregateSnap, twinSnap] = await Promise.all([
        tx.get(locRef),
        tx.get(aggregateRef),
        twinLocRef ? tx.get(twinLocRef) : Promise.resolve(undefined),
      ]);
      const currentItems = locSnap.exists ? ((locSnap.data()?.items || []) as any[]) : [];
      const newItem = { presenceId: presenceRef.id, articleCode, orderFab, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now, ...(subcontratacion ? { subcontratacion: true } : {}) };
      tx.set(locRef, {
        position,
        items: [...currentItems, newItem],
        isEmpty: false,
      }, { merge: true });
      // Espejo a la estantería gemela si es una urgente compartida (URG MEC-PRE).
      mirrorAppend(tx, twinLocRef, twinSnap, position, newItem);
      // ✅ FIX #6: Usar shelfCodes array para soportar ubicaciones compartidas
      const shelfCodes = getShelfCodesForPosition(shelfCode, position);
      const normalizedShelfCode = normalizeShelfCodeForSearch(shelfCode);
      tx.set(presenceRef, { presenceId: presenceRef.id, aggregateKey, articleCode, orderFab, locationIds: [locationId], shelfCode: normalizedShelfCode, shelfCodes, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now, active: true, ...(subcontratacion ? { subcontratacion: true } : {}) });
      if (aggregateSnap.exists) {
        const aggregate = aggregateSnap.data() as any;
        const currentIds: string[] = aggregate.activePresenceIds || [];
        if (currentIds.length >= 500) {
          throw new functions.https.HttpsError(
            'resource-exhausted',
            `El agregado ${aggregateKey} ha alcanzado el limite de 500 presencias activas simultaneas.`,
          );
        }
        tx.set(aggregateRef, { activePresenceIds: [...currentIds, presenceRef.id], totalActivePresences: (aggregate.totalActivePresences || 0) + 1, totalPlacements: (aggregate.totalPlacements || 0) + 1, updatedAt: now }, { merge: true });
      } else {
        tx.set(aggregateRef, { aggregateKey, articleCode, orderFab, activePresenceIds: [presenceRef.id], totalActivePresences: 1, totalPlacements: 1, updatedAt: now });
      }
      writeHistory(tx, { action: 'UBICAR', articleCode, orderFab, fromLocation: null, toLocation: locationId, shelfCode, operarioId, operarioName });
    });
    console.log(`[shelfOperate] ubicar SUCCESS: ${articleCode} ${orderFab} → ${shelfCode}-${position}`);

    // Comprobar si el articulo esta en otras estanterias (aviso informativo)
    let warning: string | null = null;
    try {
      const otherPresences = await db.collection('items')
        .where('aggregateKey', '==', aggregateKey)
        .where('active', '==', true)
        .limit(10)
        .get();
      const otherShelves = [...new Set(
        otherPresences.docs
          .map(d => d.data().shelfCode as string)
          .filter(sc => sc && sc !== shelfCode)
      )];
      if (otherShelves.length > 0) {
        warning = `Este articulo tambien esta en: ${otherShelves.join(', ')}`;
      }
    } catch { /* non-critical */ }

    return { ok: true, warning };
  }

  if (op === 'ubicarMulti') {
    const rawPositions = Array.isArray(payload?.positions) ? payload.positions : [];
    const positions = rawPositions.map((value: unknown) => String(value).trim()).filter(Boolean);
    const importe = payload?.importe as number | undefined;
    const cantidad = payload?.cantidad as number | undefined;
    if (!articleCode || (!orderFab && !subcontratacion) || positions.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para ubicar múltiple.');
    }
    if (positions.length > 100) {
      throw new functions.https.HttpsError('invalid-argument', 'No se pueden ubicar mas de 100 posiciones en una operacion.');
    }
    // ✅ FIX #2: Validar importe y cantidad (mismo que updateReproceso)
    if (importe !== undefined) {
      if (!isFinite(importe) || importe < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'importe debe ser un número ≥ 0.');
      }
    }
    if (cantidad !== undefined) {
      if (!isFinite(cantidad) || cantidad < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'cantidad debe ser un número ≥ 0.');
      }
    }
    const db2 = admin.firestore();
    const results: string[] = [];

    await db2.runTransaction(async (tx) => {
      const aggregateKey = `${normalize(articleCode)}__${normalize(orderFab)}`;
      const aggregateRef = db2.collection('itemAggregates').doc(aggregateKey);

      // Pre-build all refs and pre-read all docs before any writes
      const locRefs = positions.map((pos: string) =>
        db2.collection('shelves').doc(shelfCode).collection('locations').doc(pos)
      );
      const presenceRefs = positions.map(() => db2.collection('items').doc());
      // Refs gemelas (urgentes compartidas) en paralelo a positions; null si no aplica.
      const twinLocRefs = positions.map((pos: string) => twinLocRefFor(db2, shelfCode, pos));
      const [aggregateSnap, ...restSnaps] = await Promise.all([
        tx.get(aggregateRef),
        ...locRefs.map((ref: any) => tx.get(ref)),
        ...twinLocRefs.map((ref: FirebaseFirestore.DocumentReference | null) => (ref ? tx.get(ref) : Promise.resolve(undefined))),
      ]);
      const locSnaps = restSnaps.slice(0, positions.length);
      // ✅ FIX #3: Mantener mapping correcto de twinSnaps por índice (evitar desfase con nulls)
      const twinSnapsByIndex: Record<number, any> = {};
      for (let i = 0; i < positions.length; i++) {
        const snapIdx = positions.length + i;
        if (snapIdx < restSnaps.length) {
          twinSnapsByIndex[i] = restSnaps[snapIdx];
        }
      }

      let totalPresencesAdded = 0;
      const presenceIdsToAdd: string[] = [];
      const pendingItemsByPath = new Map<string, any[]>();

      for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        const locationId = `${shelfCode}-${position}`;
        const locRef = locRefs[i];
        const locSnap = locSnaps[i];
        const presenceRef = presenceRefs[i];

        let currentItems = locSnap.exists ? ((locSnap.data()?.items || []) as any[]) : [];
        if (pendingItemsByPath.has(locRef.path)) {
          currentItems = pendingItemsByPath.get(locRef.path)!;
        }

        const locationItem: any = { presenceId: presenceRef.id, articleCode, orderFab, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now };
        if (importe !== undefined) locationItem.unitCost = importe;
        if (cantidad !== undefined) locationItem.quantity = cantidad;
        if (subcontratacion) locationItem.subcontratacion = true;
        
        const newItems = [...currentItems, locationItem];
        pendingItemsByPath.set(locRef.path, newItems);
        
        tx.set(locRef, {
          position,
          items: newItems,
          isEmpty: false,
        }, { merge: true });
        // Espejo a la estantería gemela (urgentes compartidas).
        mirrorAppend(tx, twinLocRefs[i], twinSnapsByIndex[i] as any, position, locationItem, pendingItemsByPath);

        // ✅ FIX #6: Usar shelfCodes array para soportar ubicaciones compartidas
        const shelfCodes = getShelfCodesForPosition(shelfCode, position);
        const normalizedShelfCode = normalizeShelfCodeForSearch(shelfCode);
        const presenceDoc: any = { presenceId: presenceRef.id, aggregateKey, articleCode, orderFab, locationIds: [locationId], shelfCode: normalizedShelfCode, shelfCodes, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now, active: true };
        if (importe !== undefined) presenceDoc.unitCost = importe;
        if (cantidad !== undefined) presenceDoc.quantity = cantidad;
        if (subcontratacion) presenceDoc.subcontratacion = true;
        tx.set(presenceRef, presenceDoc);

        totalPresencesAdded++;
        presenceIdsToAdd.push(presenceRef.id);
        results.push(locationId);
      }

      if (aggregateSnap.exists) {
        const aggregate = aggregateSnap.data() as any;
        const currentIds: string[] = aggregate.activePresenceIds || [];
        const totalActive = (currentIds.length + totalPresencesAdded);
        if (totalActive > 500) {
          throw new functions.https.HttpsError(
            'resource-exhausted',
            `El agregado ${aggregateKey} ha alcanzado el limite de 500 presencias activas simultaneas.`,
          );
        }
        tx.set(aggregateRef, { activePresenceIds: [...currentIds, ...presenceIdsToAdd], totalActivePresences: (aggregate.totalActivePresences || 0) + totalPresencesAdded, totalPlacements: (aggregate.totalPlacements || 0) + totalPresencesAdded, updatedAt: now }, { merge: true });
      } else {
        tx.set(aggregateRef, { aggregateKey, articleCode, orderFab, activePresenceIds: presenceIdsToAdd, totalActivePresences: totalPresencesAdded, totalPlacements: totalPresencesAdded, updatedAt: now });
      }

      writeHistory(tx, { action: 'UBICAR_MULTI', articleCode, orderFab, fromLocation: null, toLocation: results.join(', '), shelfCode, operarioId, operarioName });
    });
    console.log(`[shelfOperate] ubicarMulti SUCCESS: ${articleCode} ${orderFab} → ${results.join(', ')}`);

    return { ok: true, positions: results };
  }

  if (op === 'retirar') {
    if (!articleCode || !orderFab) {
      throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para retirar.');
    }
    const aggregateKey = `${normalize(articleCode)}__${normalize(orderFab)}`;
    const aggregateRef = db.collection('itemAggregates').doc(aggregateKey);
    // ✅ FIX #6: Buscar usando shelfCodes array para soportar ubicaciones compartidas
    const presenceSnapshot = await db.collection('items')
      .where('aggregateKey', '==', aggregateKey)
      .where('active', '==', true)
      .where('shelfCodes', 'array-contains', shelfCode)
      .get();
    const activePresences = presenceSnapshot.docs.map((snap) => ({ ref: snap.ref, data: snap.data() as any }));
    if (activePresences.length === 0) {
      throw new functions.https.HttpsError('not-found', 'Articulo no encontrado.');
    }
    const positions: string[] = [];
    await db.runTransaction(async (tx) => {
      // Pre-compute all location refs from presence data
      const presenceLocData = activePresences.map((presence) => {
        const locationId = String(presence.data.locationIds?.[0] || '');
        const position = locationId.split('-').slice(1).join('-');
        const locRef = db.collection('shelves').doc(shelfCode).collection('locations').doc(position);
        const twinLocRef = twinLocRefFor(db, shelfCode, position);
        return { presence, position, locRef, twinLocRef };
      });

      // All reads before any writes (incluye docs gemelos de urgentes compartidas)
      const [aggregateSnap, ...restSnaps] = await Promise.all([
        tx.get(aggregateRef),
        ...presenceLocData.map(({ locRef }) => tx.get(locRef)),
        ...presenceLocData.map(({ twinLocRef }) => (twinLocRef ? tx.get(twinLocRef) : Promise.resolve(undefined))),
      ]);
      const locSnaps = restSnaps.slice(0, presenceLocData.length);
      const twinSnaps = restSnaps.slice(presenceLocData.length);
      const aggregate = aggregateSnap.exists ? (aggregateSnap.data() as any) : null;
      const removedPresenceIds: string[] = [];
      const pendingItemsByPath = new Map<string, any[]>();

      for (let i = 0; i < presenceLocData.length; i++) {
        const { presence, position, locRef, twinLocRef } = presenceLocData[i];
        const locSnap = locSnaps[i];
        positions.push(position);
        if (locSnap?.exists) {
          const locData = locSnap.data() as any;
          let currentItems = (locData.items || []) as any[];
          if (pendingItemsByPath.has(locRef.path)) {
            currentItems = pendingItemsByPath.get(locRef.path)!;
          }
          
          const updatedItems = currentItems.filter((item: any) => !samePresence(item, presence.data.presenceId, articleCode, orderFab));
          pendingItemsByPath.set(locRef.path, updatedItems);
          
          tx.set(locRef, { position, items: updatedItems, isEmpty: updatedItems.length === 0 }, { merge: true });
        }
        // Espejo de la baja en la estantería gemela (urgentes compartidas).
        mirrorRemove(tx, twinLocRef, twinSnaps[i] as any, position, presence.data.presenceId, articleCode, orderFab, pendingItemsByPath);
        tx.update(presence.ref, { active: false, removedAt: now, removedBy: operarioId, locationIds: [] });
        removedPresenceIds.push(presence.ref.id);
      }

      if (aggregate) {
        const remainingPresenceIds = (aggregate.activePresenceIds || []).filter((id: string) => !removedPresenceIds.includes(id));
        tx.set(aggregateRef, { activePresenceIds: remainingPresenceIds, totalActivePresences: remainingPresenceIds.length, totalPlacements: aggregate.totalPlacements, updatedAt: now }, { merge: true });
      }
      writeHistory(tx, { action: 'RETIRAR', articleCode, orderFab, fromLocation: positions.map((position) => `${shelfCode}-${position}`).join(', '), toLocation: null, shelfCode, operarioId, operarioName });
    });
    console.log(`[shelfOperate] retirar SUCCESS: ${articleCode} ${orderFab} from ${shelfCode}, positions: ${positions.join(', ')}`);
    return { ok: true, positions };
  }

  if (op === 'retirarDeUbicacion') {
    const position = String(payload?.position || '').trim();
    if (!articleCode || !orderFab || !position) {
      throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para retirar de ubicacion.');
    }
    const locRef = db.collection('shelves').doc(shelfCode).collection('locations').doc(position);
    const aggregateKey = `${normalize(articleCode)}__${normalize(orderFab)}`;
    const aggregateRef = db.collection('itemAggregates').doc(aggregateKey);
    const twinLocRef = twinLocRefFor(db, shelfCode, position);

    await db.runTransaction(async (tx) => {
      // All reads must come before writes in a Firestore transaction
      const [locSnap, aggregateSnap, twinSnap] = await Promise.all([
        tx.get(locRef),
        tx.get(aggregateRef),
        twinLocRef ? tx.get(twinLocRef) : Promise.resolve(undefined),
      ]);

      if (!locSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Ubicacion no encontrada.');
      }

      const locData = locSnap.data() as any;
      const items = locData.items || [];
      const payloadPresenceId = String(payload?.presenceId || '').trim();
      const itemIndex = items.findIndex((i: any) => {
        if (payloadPresenceId && i.presenceId) return i.presenceId === payloadPresenceId;
        return normalize(i.articleCode) === normalize(articleCode) && normalize(i.orderFab) === normalize(orderFab);
      });

      if (itemIndex === -1) {
        throw new functions.https.HttpsError('not-found', 'Articulo no encontrado en esta ubicacion.');
      }

      const removedItem = items[itemIndex];
      const presenceId = removedItem.presenceId;
      const newItems = items.filter((_: any, idx: number) => idx !== itemIndex);

      // Writes after all reads
      tx.set(locRef, { position, items: newItems, isEmpty: newItems.length === 0 }, { merge: true });
      // Espejo de la baja en la estantería gemela (urgentes compartidas).
      mirrorRemove(tx, twinLocRef, twinSnap as any, position, presenceId, articleCode, orderFab);

      if (presenceId) {
        const presenceRef = db.collection('items').doc(presenceId);
        tx.update(presenceRef, { active: false, removedAt: now, removedBy: operarioId, locationIds: [] });
      }

      if (aggregateSnap.exists) {
        const aggregate = aggregateSnap.data() as any;
        const newActiveIds = (aggregate.activePresenceIds || []).filter((id: string) => id !== presenceId);
        tx.set(aggregateRef, { activePresenceIds: newActiveIds, totalActivePresences: newActiveIds.length, totalPlacements: aggregate.totalPlacements, updatedAt: now }, { merge: true });
      }

      writeHistory(tx, { action: 'RETIRAR_DE_UBICACION', articleCode, orderFab, fromLocation: `${shelfCode}-${position}`, toLocation: null, shelfCode, operarioId, operarioName });
    });
    console.log(`[shelfOperate] retirarDeUbicacion SUCCESS: ${articleCode} ${orderFab} from ${shelfCode}-${position}`);

    return { ok: true, positions: [position] };
  }

  if (op === 'mover') {
    const rawPositions = Array.isArray(payload?.newPositions) ? payload.newPositions : [];
    const newPositions = rawPositions.map((value: unknown) => String(value).trim()).filter(Boolean);
    if (!articleCode || !orderFab || newPositions.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para mover.');
    }
    const aggregateKey = `${normalize(articleCode)}__${normalize(orderFab)}`;
    const aggregateRef = db.collection('itemAggregates').doc(aggregateKey);
    const presenceSnapshot = await db.collection('items')
      .where('aggregateKey', '==', aggregateKey)
      .where('active', '==', true)
      .where('shelfCode', '==', shelfCode)
      .get();
    const activePresences = presenceSnapshot.docs.map((snap) => ({ ref: snap.ref, data: snap.data() as any }));
    // Apilado: un único destino acepta todas las presencias (todas se mueven a
    // la misma posición). Si hay varios destinos, deben coincidir 1:1.
    const targetPositions: string[] = newPositions.length === 1 && activePresences.length > 1
      ? activePresences.map(() => newPositions[0])
      : newPositions;
    if (activePresences.length === 0 || activePresences.length !== targetPositions.length) {
      throw new functions.https.HttpsError('failed-precondition', 'Las presencias activas no coinciden con los destinos.');
    }
    await db.runTransaction(async (tx) => {
      // Pre-compute all old and new location refs
      const oldLocData = activePresences.map((presence) => {
        const locationId = String(presence.data.locationIds?.[0] || '');
        const position = locationId.split('-').slice(1).join('-');
        if (!position) {
          throw new functions.https.HttpsError('failed-precondition', `Presencia ${presence.ref.id} tiene locationId invalido: '${locationId}'.`);
        }
        const locRef = db.collection('shelves').doc(shelfCode).collection('locations').doc(position);
        return { presence, locationId, position, locRef };
      });
      const newLocData = targetPositions.map((position: string, index: number) => ({
        position,
        locationId: `${shelfCode}-${position}`,
        locRef: db.collection('shelves').doc(shelfCode).collection('locations').doc(position),
        presence: activePresences[index],
      }));

      // Deduplicate refs by path, then read all in one pass before any writes.
      // Presence refs are included so Firestore's optimistic locking detects concurrent retirar/mover.
      // Refs gemelas (urgentes compartidas) de origen y destino para espejado.
      const refByPath = new Map<string, any>();
      refByPath.set(aggregateRef.path, aggregateRef);
      for (const d of oldLocData) refByPath.set(d.locRef.path, d.locRef);
      for (const d of newLocData) refByPath.set(d.locRef.path, d.locRef);
      for (const p of activePresences) refByPath.set(p.ref.path, p.ref);
      for (const d of oldLocData) {
        const twin = twinLocRefFor(db, shelfCode, d.position);
        if (twin) refByPath.set(twin.path, twin);
      }
      for (const d of newLocData) {
        const twin = twinLocRefFor(db, shelfCode, d.position);
        if (twin) refByPath.set(twin.path, twin);
      }
      const refEntries = [...refByPath.entries()];
      const allSnaps = await Promise.all(refEntries.map(([, ref]) => tx.get(ref)));
      const snapByPath = new Map<string, any>();
      for (let i = 0; i < refEntries.length; i++) snapByPath.set(refEntries[i][0], allSnaps[i]);

      // Verify presences are still active — guards against concurrent retirar
      for (const presence of activePresences) {
        const presSnap = snapByPath.get(presence.ref.path);
        if (!presSnap?.exists || presSnap.data()?.active === false) {
          throw new functions.https.HttpsError('failed-precondition', 'El articulo fue modificado por otra operacion en curso. Intentalo de nuevo.');
        }
      }

      const aggregateSnap = snapByPath.get(aggregateRef.path);
      const oldLocationIds: string[] = [];
      const newLocationIds: string[] = [];

      // Capture preserved fields (unitCost/quantity) from the source location items
      const preservedFields = new Map<string, { unitCost?: number; quantity?: number }>();
      for (const { presence, locRef } of oldLocData) {
        const locSnap = snapByPath.get(locRef.path);
        if (locSnap?.exists) {
          const srcItem = (locSnap.data()?.items || []).find((i: any) => samePresence(i, presence.data.presenceId, articleCode, orderFab));
          if (srcItem) preservedFields.set(presence.ref.id, { unitCost: srcItem.unitCost, quantity: srcItem.quantity });
        }
      }

      const pendingItemsByPath = new Map<string, any[]>();

      // Remove article from old positions
      for (const { presence, locationId, position, locRef } of oldLocData) {
        oldLocationIds.push(locationId);
        const locSnap = snapByPath.get(locRef.path);
        if (locSnap?.exists) {
          const locData = locSnap.data() as any;
          let currentItems = (locData.items || []) as any[];
          if (pendingItemsByPath.has(locRef.path)) {
            currentItems = pendingItemsByPath.get(locRef.path)!;
          }
          
          const updatedItems = currentItems.filter((item: any) => !samePresence(item, presence.data.presenceId, articleCode, orderFab));
          pendingItemsByPath.set(locRef.path, updatedItems);
          
          tx.set(locRef, { position, items: updatedItems, isEmpty: updatedItems.length === 0 }, { merge: true });
        }
        // Espejo de la baja si la posición de origen es urgente compartida.
        const twinRef = twinLocRefFor(db, shelfCode, position);
        mirrorRemove(tx, twinRef, twinRef ? snapByPath.get(twinRef.path) : undefined, position, presence.data.presenceId, articleCode, orderFab, pendingItemsByPath);
      }

      // Add article to new positions
      for (const { position, locationId, locRef, presence } of newLocData) {
        newLocationIds.push(locationId);
        const locSnap = snapByPath.get(locRef.path);
        
        let currentItems = locSnap?.exists ? ((locSnap.data()?.items || []) as any[]) : [];
        if (pendingItemsByPath.has(locRef.path)) {
          currentItems = pendingItemsByPath.get(locRef.path)!;
        }

        const pf = preservedFields.get(presence.ref.id) ?? {};
        const movedItem: Record<string, unknown> = { presenceId: presence.data.presenceId, articleCode, orderFab, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now };
        if (pf.unitCost !== undefined) movedItem.unitCost = pf.unitCost;
        if (pf.quantity !== undefined) movedItem.quantity = pf.quantity;
        
        const newItems = [...currentItems, movedItem];
        pendingItemsByPath.set(locRef.path, newItems);

        tx.set(locRef, { position, items: newItems, isEmpty: false }, { merge: true });
        // Espejo del alta si la posición de destino es urgente compartida.
        const twinRef = twinLocRefFor(db, shelfCode, position);
        mirrorAppend(tx, twinRef, twinRef ? snapByPath.get(twinRef.path) : undefined, position, movedItem, pendingItemsByPath);
        
        // ✅ FIX #6: Usar shelfCodes array para soportar ubicaciones compartidas
        const shelfCodes = getShelfCodesForPosition(shelfCode, position);
        const normalizedShelfCode = normalizeShelfCodeForSearch(shelfCode);
        tx.update(presence.ref, { locationIds: [locationId], shelfCode: normalizedShelfCode, shelfCodes, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now });
      }

      if (aggregateSnap?.exists) {
        tx.set(aggregateRef, { updatedAt: now }, { merge: true });
      }
      writeHistory(tx, { action: 'MOVER', articleCode, orderFab, fromLocation: oldLocationIds.join(', '), toLocation: newLocationIds.join(', '), shelfCode, operarioId, operarioName });
    });
    console.log(`[shelfOperate] mover SUCCESS: ${articleCode} ${orderFab} → ${newPositions.join(', ')} (en ${shelfCode})`);
    return { ok: true };
  }

  if (op === 'reubicar') {
    // Reubicar = mover ENTRE secciones (espejo cross-estantería de `mover`).
    // Solo ADMIN / SUPERADMIN.
    if (!['ADMIN', 'SUPERADMIN'].includes(actor.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Solo admin puede reubicar entre secciones.');
    }
    const fromShelfCode = normalize(payload?.fromShelfCode || shelfCode);
    const toShelfCode = normalize(payload?.toShelfCode);
    const rawPositions = Array.isArray(payload?.newPositions) ? payload.newPositions : [];
    const newPositions = rawPositions.map((value: unknown) => String(value).trim()).filter(Boolean);
    if (!articleCode || !orderFab || !fromShelfCode || !toShelfCode || newPositions.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para reubicar.');
    }
    if (fromShelfCode === toShelfCode) {
      throw new functions.https.HttpsError('invalid-argument', 'Origen y destino son la misma sección; usa mover.');
    }
    assertActorMayOperateShelf(actor, fromShelfCode);
    assertActorMayOperateShelf(actor, toShelfCode);

    const aggregateKey = `${normalize(articleCode)}__${normalize(orderFab)}`;
    const aggregateRef = db.collection('itemAggregates').doc(aggregateKey);
    const presenceSnapshot = await db.collection('items')
      .where('aggregateKey', '==', aggregateKey)
      .where('active', '==', true)
      .where('shelfCode', '==', fromShelfCode)
      .get();
    const activePresences = presenceSnapshot.docs.map((snap) => ({ ref: snap.ref, data: snap.data() as any }));
    if (activePresences.length === 0 || activePresences.length !== newPositions.length) {
      throw new functions.https.HttpsError('failed-precondition', 'Las presencias activas en la sección origen no coinciden con los destinos.');
    }

    await db.runTransaction(async (tx) => {
      const oldLocData = activePresences.map((presence) => {
        const locationId = String(presence.data.locationIds?.[0] || '');
        const position = locationId.split('-').slice(1).join('-');
        const locRef = db.collection('shelves').doc(fromShelfCode).collection('locations').doc(position);
        return { presence, locationId, position, locRef };
      });
      const newLocData = newPositions.map((position: string, index: number) => ({
        position,
        locationId: `${toShelfCode}-${position}`,
        locRef: db.collection('shelves').doc(toShelfCode).collection('locations').doc(position),
        presence: activePresences[index],
      }));

      const refByPath = new Map<string, any>();
      refByPath.set(aggregateRef.path, aggregateRef);
      for (const d of oldLocData) refByPath.set(d.locRef.path, d.locRef);
      for (const d of newLocData) refByPath.set(d.locRef.path, d.locRef);
      // Refs gemelas: origen según fromShelfCode, destino según toShelfCode.
      for (const d of oldLocData) {
        const twin = twinLocRefFor(db, fromShelfCode, d.position);
        if (twin) refByPath.set(twin.path, twin);
      }
      for (const d of newLocData) {
        const twin = twinLocRefFor(db, toShelfCode, d.position);
        if (twin) refByPath.set(twin.path, twin);
      }
      const refEntries = [...refByPath.entries()];
      const allSnaps = await Promise.all(refEntries.map(([, ref]) => tx.get(ref)));
      const snapByPath = new Map<string, any>();
      for (let i = 0; i < refEntries.length; i++) snapByPath.set(refEntries[i][0], allSnaps[i]);

      const aggregateSnap = snapByPath.get(aggregateRef.path);
      const oldLocationIds: string[] = [];
      const newLocationIds: string[] = [];

      // Capture preserved fields (unitCost/quantity) from the source location items
      const preservedFieldsR = new Map<string, { unitCost?: number; quantity?: number }>();
      for (const { presence, locRef } of oldLocData) {
        const locSnap = snapByPath.get(locRef.path);
        if (locSnap?.exists) {
          const srcItem = (locSnap.data()?.items || []).find((i: any) => samePresence(i, presence.data.presenceId, articleCode, orderFab));
          if (srcItem) preservedFieldsR.set(presence.ref.id, { unitCost: srcItem.unitCost, quantity: srcItem.quantity });
        }
      }

      const pendingItemsByPath = new Map<string, any[]>();

      // Quitar de las posiciones de origen
      for (const { presence, locationId, position, locRef } of oldLocData) {
        oldLocationIds.push(locationId);
        const locSnap = snapByPath.get(locRef.path);
        if (locSnap?.exists) {
          const locData = locSnap.data() as any;
          let currentItems = (locData.items || []) as any[];
          if (pendingItemsByPath.has(locRef.path)) {
            currentItems = pendingItemsByPath.get(locRef.path)!;
          }
          
          const updatedItems = currentItems.filter((item: any) => !samePresence(item, presence.data.presenceId, articleCode, orderFab));
          pendingItemsByPath.set(locRef.path, updatedItems);
          
          tx.set(locRef, { position, items: updatedItems, isEmpty: updatedItems.length === 0 }, { merge: true });
        }
        // Espejo de la baja si el origen es urgente compartida.
        const twinRef = twinLocRefFor(db, fromShelfCode, position);
        mirrorRemove(tx, twinRef, twinRef ? snapByPath.get(twinRef.path) : undefined, position, presence.data.presenceId, articleCode, orderFab, pendingItemsByPath);
      }

      // Añadir en las posiciones de destino (otra sección) + reasignar presencia
      for (const { position, locationId, locRef, presence } of newLocData) {
        newLocationIds.push(locationId);
        const locSnap = snapByPath.get(locRef.path);
        
        let currentItems = locSnap?.exists ? ((locSnap.data()?.items || []) as any[]) : [];
        if (pendingItemsByPath.has(locRef.path)) {
          currentItems = pendingItemsByPath.get(locRef.path)!;
        }

        const pfR = preservedFieldsR.get(presence.ref.id) ?? {};
        const movedItem: Record<string, unknown> = { presenceId: presence.data.presenceId, articleCode, orderFab, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now };
        if (pfR.unitCost !== undefined) movedItem.unitCost = pfR.unitCost;
        if (pfR.quantity !== undefined) movedItem.quantity = pfR.quantity;
        
        const newItems = [...currentItems, movedItem];
        pendingItemsByPath.set(locRef.path, newItems);

        tx.set(locRef, { position, items: newItems, isEmpty: false }, { merge: true });
        // Espejo del alta si el destino es urgente compartida.
        const twinRef = twinLocRefFor(db, toShelfCode, position);
        mirrorAppend(tx, twinRef, twinRef ? snapByPath.get(twinRef.path) : undefined, position, movedItem, pendingItemsByPath);
        const normalizedToShelfCode = normalizeShelfCodeForSearch(toShelfCode);
        tx.update(presence.ref, { locationIds: [locationId], shelfCode: normalizedToShelfCode, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now });
      }

      if (aggregateSnap?.exists) {
        tx.set(aggregateRef, { updatedAt: now }, { merge: true });
      }
      writeHistory(tx, { action: 'REUBICAR', articleCode, orderFab, fromLocation: oldLocationIds.join(', '), toLocation: newLocationIds.join(', '), shelfCode: `${fromShelfCode}→${toShelfCode}`, operarioId, operarioName });
    });
    console.log(`[shelfOperate] reubicar SUCCESS: ${articleCode} ${orderFab} ${fromShelfCode} → ${toShelfCode} ${newPositions.join(', ')}`);
    return { ok: true };
  }

  if (op === 'enviarAlmacen') {
    // Solo CARRETILLERO, ADMIN, SUPERADMIN o la seccion PINTURA
    const actorSection = String(actor.section || '').toUpperCase();
    if (!['CARRETILLERO', 'ADMIN', 'SUPERADMIN'].includes(actor.role) && actorSection !== 'PINTURA') {
      throw new functions.https.HttpsError('permission-denied', 'Solo carretillero, admin o seccion pintura pueden enviar a almacen.');
    }
    if (!articleCode || !orderFab) {
      throw new functions.https.HttpsError('invalid-argument', 'articleCode y orderFab requeridos para enviar a almacen.');
    }

    const aggregateKey = `${normalize(articleCode)}__${normalize(orderFab)}`;
    // Búsqueda GLOBAL en toda la nave (no se filtra por estantería): el artículo
    // que sube a almacén puede estar ubicado en cualquier sección, o ya haber sido
    // retirado. En ambos casos hay que reflejar que sale de la rueda.
    const presenceSnapshot = await db.collection('items')
      .where('aggregateKey', '==', aggregateKey)
      .where('active', '==', true)
      .get();

    // Caso: no está ubicado en ninguna parte → igualmente se registra la subida
    // a almacén (queda traza en el historial), sin error.
    if (presenceSnapshot.empty) {
      await db.runTransaction(async (tx) => {
        writeHistory(tx, {
          action: 'ENVIAR_ALMACEN',
          articleCode,
          orderFab,
          fromLocation: null,
          toLocation: 'ALMACEN',
          shelfCode: 'GLOBAL',
          notLocated: true,
          operarioId,
          operarioName,
        });
      });
      return { ok: true, removedFrom: 0, locations: [], wasLocated: false };
    }

    const removedFromLocations: string[] = [];

    await db.runTransaction(async (tx) => {
      const aggregateRef = db.collection('itemAggregates').doc(aggregateKey);

      // Pre-compute all location refs from presence data
      const presLocData = presenceSnapshot.docs.map((presSnap) => {
        const presData = presSnap.data();
        const locId = String(presData.locationIds?.[0] || '');
        const parts = locId.split('-');
        const sc = parts[0] || '';
        const pos = parts.slice(1).join('-');
        const locRef = sc && pos ? db.collection('shelves').doc(sc).collection('locations').doc(pos) : null;
        const twinLocRef = sc && pos ? twinLocRefFor(db, sc, pos) : null;
        return { presSnap, presData, locId, pos, locRef, twinLocRef };
      });

      // All reads before any writes: aggregate + all location docs (+ gemelos)
      const validLocData = presLocData.filter(({ locRef }) => locRef !== null);
      const twinLocData = presLocData.filter(({ twinLocRef }) => twinLocRef !== null);
      const [aggregateSnap, ...restSnaps] = await Promise.all([
        tx.get(aggregateRef),
        ...validLocData.map(({ locRef }) => tx.get(locRef!)),
        ...twinLocData.map(({ twinLocRef }) => tx.get(twinLocRef!)),
      ]);
      const locSnaps = restSnaps.slice(0, validLocData.length);
      const twinSnaps = restSnaps.slice(validLocData.length);
      const locSnapByPath = new Map<string, any>();
      for (let i = 0; i < validLocData.length; i++) {
        locSnapByPath.set(validLocData[i].locRef!.path, locSnaps[i]);
      }
      const twinSnapByPath = new Map<string, any>();
      for (let i = 0; i < twinLocData.length; i++) {
        twinSnapByPath.set(twinLocData[i].twinLocRef!.path, twinSnaps[i]);
      }

      const pendingItemsByPath = new Map<string, any[]>();

      // All writes
      for (const { presSnap, presData, locId, pos, locRef, twinLocRef } of presLocData) {
        if (locRef) {
          const locSnap = locSnapByPath.get(locRef.path);
          if (locSnap?.exists) {
            const locData = locSnap.data() as any;
            let currentItems = (locData.items || []) as any[];
            if (pendingItemsByPath.has(locRef.path)) {
              currentItems = pendingItemsByPath.get(locRef.path)!;
            }
            
            const updatedItems = currentItems.filter((item: any) =>
              !samePresence(item, presData.presenceId, articleCode, orderFab)
            );
            pendingItemsByPath.set(locRef.path, updatedItems);
            
            tx.set(locRef, { position: pos, items: updatedItems, isEmpty: updatedItems.length === 0 }, { merge: true });
          }
          removedFromLocations.push(locId);
        }
        // Espejo de la baja si la posición es urgente compartida.
        mirrorRemove(tx, twinLocRef, twinLocRef ? twinSnapByPath.get(twinLocRef.path) : undefined, pos, presData.presenceId, articleCode, orderFab, pendingItemsByPath);
        tx.update(presSnap.ref, { active: false, removedAt: now, removedBy: operarioId, locationIds: [], sentToWarehouse: true });
      }

      if (aggregateSnap.exists) {
        tx.update(aggregateRef, { activePresenceIds: [], totalActivePresences: 0, updatedAt: now });
      }

      writeHistory(tx, {
        action: 'ENVIAR_ALMACEN',
        articleCode,
        orderFab,
        fromLocation: removedFromLocations.join(', '),
        toLocation: 'ALMACEN',
        shelfCode: shelfCode || 'GLOBAL',
        operarioId,
        operarioName,
      });
    });

    return { ok: true, removedFrom: presenceSnapshot.size, locations: removedFromLocations, wasLocated: true };
  }

  if (op === 'emptyShelf') {
    const canEmpty = ['ADMIN', 'SUPERADMIN'].includes(actor.role) ||
      (actor.role === 'JEFE_SECCION' && actor.section === sectionForWarehouse(shelfCode));
    if (!canEmpty) {
      throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para vaciar esta estanteria.');
    }

    // Control doc para detectar fallos a medio camino y permitir compensación
    const controlRef = db.collection('_ops').doc(`emptyShelf_${shelfCode}_${Date.now()}`);
    await controlRef.set({
      op: 'emptyShelf',
      shelfCode,
      operarioId,
      operarioName,
      uid: actor.uid,
      role: actor.role,
      startedAt: now,
      stepsCompleted: [],
      status: 'in_progress',
    });

    const CHUNK = 30;
    let locSnapshot: FirebaseFirestore.QuerySnapshot;
    let presenceSnapshot: FirebaseFirestore.QuerySnapshot;
    let aggregateMap = new Map<string, string[]>();

    try {
      // 1. Delete all location documents (+ clear items[] mirror in URG twin)
      locSnapshot = await db.collection('shelves').doc(shelfCode).collection('locations').get();
      const urgPositions = locSnapshot.docs.map((d) => d.id).filter((id) => id.startsWith('URG MEC-PRE'));
      if (urgPositions.length > 0) {
        const twinShelf = URG_TWIN[normalize(shelfCode)];
        if (twinShelf) {
          for (let i = 0; i < urgPositions.length; i += CHUNK) {
            const twinBatch = db.batch();
            urgPositions.slice(i, i + CHUNK).forEach((pos) => {
              const twinRef = db.collection('shelves').doc(twinShelf).collection('locations').doc(pos);
              twinBatch.set(twinRef, { position: pos, items: [], isEmpty: true }, { merge: true });
            });
            await twinBatch.commit();
          }
        }
      }
      await controlRef.update({ stepsCompleted: admin.firestore.FieldValue.arrayUnion('urg_twins_cleared') });

      for (let i = 0; i < locSnapshot.docs.length; i += CHUNK) {
        const batchWrite = db.batch();
        locSnapshot.docs.slice(i, i + CHUNK).forEach((d) => batchWrite.delete(d.ref));
        await batchWrite.commit();
      }
      await controlRef.update({ stepsCompleted: admin.firestore.FieldValue.arrayUnion('locations_deleted') });

      // 2. Deactivate all active item presences for this shelf
      presenceSnapshot = await db.collection('items')
        .where('shelfCode', '==', shelfCode)
        .where('active', '==', true)
        .get();

      aggregateMap = new Map<string, string[]>();
      for (const presDoc of presenceSnapshot.docs) {
        const data = presDoc.data() as any;
        const key = String(data.aggregateKey || '');
        if (!aggregateMap.has(key)) aggregateMap.set(key, []);
        aggregateMap.get(key)!.push(presDoc.id);
      }

      for (let i = 0; i < presenceSnapshot.docs.length; i += CHUNK) {
        const batchWrite = db.batch();
        presenceSnapshot.docs.slice(i, i + CHUNK).forEach((d) =>
          batchWrite.update(d.ref, { active: false, removedAt: now, removedBy: operarioId, locationIds: [] }),
        );
        await batchWrite.commit();
      }
      await controlRef.update({ stepsCompleted: admin.firestore.FieldValue.arrayUnion('presences_deactivated') });

      // 3. Update itemAggregates
      const aggEntries = Array.from(aggregateMap.entries());
      if (aggEntries.length > 0) {
        const aggRefs = aggEntries.map(([key]) => db.collection('itemAggregates').doc(key));
        const aggSnaps = await Promise.all(aggRefs.map((ref) => ref.get()));
        for (let i = 0; i < aggEntries.length; i += CHUNK) {
          const aggBatch = db.batch();
          for (let j = i; j < Math.min(i + CHUNK, aggEntries.length); j++) {
            if (!aggSnaps[j].exists) continue;
            const [, removedIds] = aggEntries[j];
            const aggData = aggSnaps[j].data() as any;
            const remaining = (aggData.activePresenceIds || []).filter((id: string) => !removedIds.includes(id));
            aggBatch.update(aggRefs[j], { activePresenceIds: remaining, totalActivePresences: remaining.length, updatedAt: now });
          }
          await aggBatch.commit();
        }
      }
      await controlRef.update({ stepsCompleted: admin.firestore.FieldValue.arrayUnion('aggregates_updated') });

      await db.collection('history').add({
        action: 'VACIAR_ESTANTERIA',
        articleCode: 'ALL',
        orderFab: 'ALL',
        fromLocation: shelfCode,
        toLocation: null,
        shelfCode,
        operarioId,
        operarioName,
        timestamp: now,
        uid: actor.uid,
        role: actor.role,
        user: operarioName,
        source: 'shelfOperate',
      });

      await controlRef.update({ status: 'completed', completedAt: new Date().toISOString() });
      return { ok: true, deleted: locSnapshot.docs.length, deactivatedPresences: presenceSnapshot.docs.length };
    } catch (err) {
      // Compensación: intentar revertir pasos completados
      console.error(`[emptyShelf] Falló en shelf ${shelfCode}:`, err);
      await controlRef.update({ status: 'failed', error: String(err) });

      // Intentar compensación parcial
      try {
        const controlDoc = await controlRef.get();
        const completed = (controlDoc.data() as any)?.stepsCompleted || [];

        if (completed.includes('aggregates_updated') && aggregateMap.size > 0) {
          const aggEntries = Array.from(aggregateMap.entries());
          const aggRefs = aggEntries.map(([key]) => db.collection('itemAggregates').doc(key));
          const aggSnaps = await Promise.all(aggRefs.map((ref) => ref.get()));
          for (let i = 0; i < aggEntries.length; i += CHUNK) {
            const aggBatch = db.batch();
            for (let j = i; j < Math.min(i + CHUNK, aggEntries.length); j++) {
              if (!aggSnaps[j].exists) continue;
              const aggData = aggSnaps[j].data() as any;
              const restoredIds = aggData.activePresenceIds || [];
              aggBatch.update(aggRefs[j], { totalActivePresences: restoredIds.length });
            }
            await aggBatch.commit();
          }
        }
      } catch (compensationErr) {
        console.error(`[emptyShelf] Compensación falló para shelf ${shelfCode}:`, compensationErr);
      }

      throw new functions.https.HttpsError(
        'internal',
        `Error al vaciar estantería ${shelfCode}. Algunos cambios pudieron aplicarse. Contacta a administración. (Error: ${err instanceof Error ? err.message : String(err)})`,
      );
    }
  }

  throw new functions.https.HttpsError('invalid-argument', `Operacion desconocida: ${op}`);
});

export const cartOperate = functions.https.onCall(async (data: any, context: any) => {
  const actor = await resolveOperationalActor(context, data?.session);
  if (!['CARRETILLERO', 'ADMIN', 'SUPERADMIN'].includes(actor.role)) {
    throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para editar carros.');
  }

  const cartCode = String(data?.payload?.cartCode || '').trim().toUpperCase();
  const position = String(data?.payload?.position || '').trim();
  const description = String(data?.payload?.description || '').trim();
  if (!cartCode || !position) {
    throw new functions.https.HttpsError('invalid-argument', 'cartCode y position son obligatorios.');
  }

  const now = new Date().toISOString();
  const locRef = admin.firestore().collection('shelves').doc(cartCode).collection('locations').doc(position);
  if (description) {
    await locRef.set({
      position,
      items: [{
        articleCode: description,
        orderFab: 'MANUAL',
        locatedBy: actor.operarioId || actor.uid,
        locatedByName: actor.operarioName || actor.email || actor.uid,
        locatedAt: now,
      }],
      isEmpty: false,
    }, { merge: true });
  } else {
    await locRef.set({
      position,
      items: [],
      isEmpty: true,
    }, { merge: true });
  }

  await admin.firestore().collection('history').add({
    action: description ? 'MOVER' : 'RETIRAR',
    articleCode: description || 'MANUAL_CART_CLEAR',
    orderFab: 'MANUAL',
    fromLocation: description ? null : `${cartCode}-${position}`,
    toLocation: description ? `${cartCode}-${position}` : null,
    shelfCode: cartCode,
    operarioId: actor.operarioId || actor.uid,
    operarioName: actor.operarioName || actor.email || actor.uid,
    timestamp: now,
    uid: actor.uid,
    role: actor.role,
    user: actor.operarioName || actor.email || actor.uid,
    source: 'cartOperate',
  });

  return { ok: true };
});

// ─── updateReproceso ───
// Permite a CALIDAD/ADMIN/SUPERADMIN editar cantidad e importe en ubicaciones de reproceso (CAL 001-022)
export const updateReproceso = functions.https.onCall(async (data: any, context: any) => {
  const actor = await resolveOperationalActor(context, data?.session);
  if (!['CALIDAD', 'ADMIN', 'SUPERADMIN'].includes(actor.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Sin permisos para editar reprocesos.');
  }

  const position = String(data?.payload?.position || '').trim();
  const presenceId = String(data?.payload?.presenceId || '').trim();
  const articleCode = String(data?.payload?.articleCode || '').trim();
  const orderFab = String(data?.payload?.orderFab || '').trim();
  const quantity = Number(data?.payload?.quantity) || 0;
  const unitCost = Number(data?.payload?.unitCost) || 0;

  if (!isFinite(quantity) || quantity < 0) {
    throw new functions.https.HttpsError('invalid-argument', 'quantity debe ser un número ≥ 0.');
  }
  if (!isFinite(unitCost) || unitCost < 0) {
    throw new functions.https.HttpsError('invalid-argument', 'unitCost debe ser un número ≥ 0.');
  }

  const posNum = parseInt(position, 10);

  if (isNaN(posNum) || posNum < 1 || posNum > 22) {
    throw new functions.https.HttpsError('invalid-argument', 'Solo se pueden editar reprocesos en CAL 001-022.');
  }

  const db = admin.firestore();
  const locRef = db.collection('shelves').doc('CAL').collection('locations').doc(position);

  await db.runTransaction(async (tx) => {
    // Todas las lecturas antes que las escrituras
    const locSnap = await tx.get(locRef);
    const locData = locSnap.exists ? (locSnap.data() as any) : { position, items: [], isEmpty: true };
    
    let found = false;
    let foundPresenceId = '';
    let foundAggregateKey = '';
    const items = (locData.items || []).map((item: any) => {
      // ✅ FIX #1: Validar presenceId no esté vacío antes de usar para matching
      const matchByPresence = presenceId.length > 0 && item.presenceId === presenceId;
      const matchByCode = presenceId.length === 0
        && item.articleCode?.toUpperCase() === articleCode.toUpperCase()
        && item.orderFab?.toUpperCase() === orderFab.toUpperCase();
      if (matchByPresence || matchByCode) {
        found = true;
        foundPresenceId = item.presenceId;
        foundAggregateKey = item.aggregateKey || '';
        return { ...item, quantity, unitCost };
      }
      return item;
    });

    if (!found) {
      throw new functions.https.HttpsError('not-found', 'Artículo no encontrado en la ubicación CAL indicada. Ubícalo primero con shelfOperate.');
    }

    // Lectura adicional para aggregate si se encontró el item
    let aggregateSnap = null;
    if (foundAggregateKey) {
      const aggregateRef = db.collection('itemAggregates').doc(foundAggregateKey);
      aggregateSnap = await tx.get(aggregateRef);
    }

    // Escrituras
    tx.set(locRef, {
      position,
      isEmpty: items.length === 0,
      items,
    }, { merge: true });

    // ✅ FIX #5: Actualizar también la presencia en la colección items para mantener sincronización
    if (foundPresenceId) {
      const itemRef = db.collection('items').doc(foundPresenceId);
      tx.update(itemRef, { quantity, unitCost });
    }

    // ✅ FIX #3: Sincronizar aggregate
    if (foundAggregateKey && aggregateSnap && aggregateSnap.exists) {
      const aggregateRef = db.collection('itemAggregates').doc(foundAggregateKey);
      const aggregate = aggregateSnap.data() as any;
      tx.set(aggregateRef, {
        aggregateKey: foundAggregateKey,
        articleCode: aggregate.articleCode || articleCode,
        orderFab: aggregate.orderFab || orderFab,
        activePresenceIds: aggregate.activePresenceIds || [],
        totalActivePresences: aggregate.totalActivePresences || 0,
        totalPlacements: aggregate.totalPlacements || 0,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
  });

  return { ok: true };
});
