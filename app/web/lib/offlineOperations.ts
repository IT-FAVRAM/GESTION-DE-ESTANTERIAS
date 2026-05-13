import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebaseV3';
import {
  type HistoryEntryDoc,
  type ItemAggregateDoc,
  type ItemDoc,
  type LocationDoc,
  type LocationItem,
  type PickupRequestDoc,
  type PickupStatus,
  COLLECTIONS,
  getItemAggregateId,
  getLocationDocId,
  getSectionForShelf,
  getShelfDefinition,
} from './firestoreSchema';

const sameItem = (item: LocationItem, articleCode: string, orderFab: string) => (
  item.articleCode === articleCode && item.orderFab === orderFab
);

const samePresence = (item: LocationItem, presenceId: string, articleCode: string, orderFab: string) => {
  if (item.presenceId) {
    return item.presenceId === presenceId;
  }

  return sameItem(item, articleCode, orderFab);
};

const buildPresenceQuery = (articleCode: string, orderFab: string, shelfCode: string) => query(
  collection(db, COLLECTIONS.ITEMS),
  where('aggregateKey', '==', getItemAggregateId(articleCode, orderFab)),
  where('active', '==', true),
  where('shelfCode', '==', shelfCode),
);

export interface UbicarPayload {
  shelfCode: string;
  articleCode: string;
  orderFab: string;
  position: string;
  operarioId: string;
  operarioName: string;
}

export interface RetirarPayload {
  shelfCode: string;
  articleCode: string;
  orderFab: string;
  operarioId: string;
  operarioName: string;
}

export interface MoverPayload {
  shelfCode: string;
  articleCode: string;
  orderFab: string;
  newPositions: string[];
  operarioId: string;
  operarioName: string;
}

export interface CreatePickupPayload {
  operarioId: string;
  operarioName: string;
  shelfCode: string;
}

export interface CompletePickupPayload {
  requestId: string;
  completedByUid: string;
}

export const executeUbicar = async ({
  shelfCode,
  articleCode,
  orderFab,
  position,
  operarioId,
  operarioName,
}: UbicarPayload) => {
  const now = new Date().toISOString();
  const locationId = getLocationDocId(shelfCode, position);
  const aggregateKey = getItemAggregateId(articleCode, orderFab);
  const locRef = doc(db, COLLECTIONS.SHELVES, shelfCode, COLLECTIONS.LOCATIONS, position);
  const presenceRef = doc(collection(db, COLLECTIONS.ITEMS));
  const aggregateRef = doc(db, COLLECTIONS.ITEM_AGGREGATES, aggregateKey);

  await runTransaction(db, async (tx) => {
    const [locSnap, aggregateSnap] = await Promise.all([tx.get(locRef), tx.get(aggregateRef)]);
    const currentItems: LocationItem[] = locSnap.exists() ? ((locSnap.data() as LocationDoc).items || []) : [];
    const newItem: LocationItem = {
      presenceId: presenceRef.id,
      articleCode,
      orderFab,
      locatedBy: operarioId,
      locatedByName: operarioName,
      locatedAt: now,
    };

    tx.set(locRef, { position, items: [...currentItems, newItem], isEmpty: false }, { merge: true });

    const presenceDoc: ItemDoc = {
      presenceId: presenceRef.id,
      aggregateKey,
      articleCode,
      orderFab,
      locationIds: [locationId],
      shelfCode,
      locatedBy: operarioId,
      locatedByName: operarioName,
      locatedAt: now,
      active: true,
    };
    tx.set(presenceRef, presenceDoc);

    if (aggregateSnap.exists()) {
      const aggregate = aggregateSnap.data() as ItemAggregateDoc;
      tx.set(aggregateRef, {
        activePresenceIds: [...aggregate.activePresenceIds, presenceRef.id],
        totalActivePresences: aggregate.totalActivePresences + 1,
        totalPlacements: aggregate.totalPlacements + 1,
        updatedAt: now,
      }, { merge: true });
    } else {
      tx.set(aggregateRef, {
        aggregateKey,
        articleCode,
        orderFab,
        activePresenceIds: [presenceRef.id],
        totalActivePresences: 1,
        totalPlacements: 1,
        updatedAt: now,
      } as ItemAggregateDoc);
    }

    const historyRef = doc(collection(db, COLLECTIONS.HISTORY));
    tx.set(historyRef, {
      action: 'UBICAR',
      articleCode,
      orderFab,
      fromLocation: null,
      toLocation: locationId,
      shelfCode,
      operarioId,
      operarioName,
      timestamp: now,
    } as HistoryEntryDoc);
  });
};

export const executeRetirar = async ({
  shelfCode,
  articleCode,
  orderFab,
  operarioId,
  operarioName,
}: RetirarPayload) => {
  const now = new Date().toISOString();
  const aggregateKey = getItemAggregateId(articleCode, orderFab);
  const aggregateRef = doc(db, COLLECTIONS.ITEM_AGGREGATES, aggregateKey);
  const presenceSnapshot = await getDocs(buildPresenceQuery(articleCode, orderFab, shelfCode));
  const activePresences = presenceSnapshot.docs.map((snap) => ({ ref: snap.ref, data: snap.data() as ItemDoc }));

  if (activePresences.length === 0) {
    throw new Error('Articulo no encontrado');
  }

  const positions: string[] = [];
  await runTransaction(db, async (tx) => {
    const aggregateSnap = await tx.get(aggregateRef);
    const aggregateData = aggregateSnap.exists() ? (aggregateSnap.data() as ItemAggregateDoc) : null;
    const removedPresenceIds: string[] = [];

    for (const presence of activePresences) {
      const locationId = presence.data.locationIds[0];
      const parsed = locationId.split('-');
      const locShelfCode = parsed[0];
      const locPosition = parsed.slice(1).join('-');
      positions.push(locPosition);

      const locRef = doc(db, COLLECTIONS.SHELVES, locShelfCode, COLLECTIONS.LOCATIONS, locPosition);
      const locSnap = await tx.get(locRef);
      if (locSnap.exists()) {
        const locData = locSnap.data() as LocationDoc;
        const updatedItems = (locData.items || []).filter((item) => !samePresence(item, presence.data.presenceId, articleCode, orderFab));
        tx.set(locRef, { position: locPosition, items: updatedItems, isEmpty: updatedItems.length === 0 }, { merge: true });
      }

      tx.update(presence.ref, { active: false, removedAt: now, removedBy: operarioId, locationIds: [] });
      removedPresenceIds.push(presence.ref.id);
    }

    if (aggregateData) {
      const remainingPresenceIds = aggregateData.activePresenceIds.filter((presenceId) => !removedPresenceIds.includes(presenceId));
      tx.set(aggregateRef, {
        activePresenceIds: remainingPresenceIds,
        totalActivePresences: remainingPresenceIds.length,
        totalPlacements: aggregateData.totalPlacements,
        updatedAt: now,
      }, { merge: true });
    }

    const historyRef = doc(collection(db, COLLECTIONS.HISTORY));
    tx.set(historyRef, {
      action: 'RETIRAR',
      articleCode,
      orderFab,
      fromLocation: positions.map((position) => getLocationDocId(shelfCode, position)).join(', '),
      toLocation: null,
      shelfCode,
      operarioId,
      operarioName,
      timestamp: now,
    } as HistoryEntryDoc);
  });

  return { positions };
};

export const executeMover = async ({
  shelfCode,
  articleCode,
  orderFab,
  newPositions,
  operarioId,
  operarioName,
}: MoverPayload) => {
  const now = new Date().toISOString();
  const aggregateKey = getItemAggregateId(articleCode, orderFab);
  const aggregateRef = doc(db, COLLECTIONS.ITEM_AGGREGATES, aggregateKey);
  const presenceSnapshot = await getDocs(buildPresenceQuery(articleCode, orderFab, shelfCode));
  const activePresences = presenceSnapshot.docs.map((snap) => ({ ref: snap.ref, data: snap.data() as ItemDoc }));

  if (activePresences.length === 0) {
    throw new Error('Articulo no encontrado o ya retirado');
  }

  if (activePresences.length !== newPositions.length) {
    throw new Error('El numero de huecos destino no coincide con las presencias activas del articulo.');
  }

  await runTransaction(db, async (tx) => {
    const aggregateSnap = await tx.get(aggregateRef);
    const oldLocationIds: string[] = [];
    const newLocationIds: string[] = [];

    for (const presence of activePresences) {
      const locationId = presence.data.locationIds[0];
      oldLocationIds.push(locationId);
      const parsed = locationId.split('-');
      const locShelfCode = parsed[0];
      const locPosition = parsed.slice(1).join('-');
      const locRef = doc(db, COLLECTIONS.SHELVES, locShelfCode, COLLECTIONS.LOCATIONS, locPosition);
      const locSnap = await tx.get(locRef);
      if (locSnap.exists()) {
        const locData = locSnap.data() as LocationDoc;
        const updatedItems = (locData.items || []).filter((item) => !samePresence(item, presence.data.presenceId, articleCode, orderFab));
        tx.set(locRef, { position: locPosition, items: updatedItems, isEmpty: updatedItems.length === 0 }, { merge: true });
      }
    }

    for (let index = 0; index < newPositions.length; index += 1) {
      const pos = newPositions[index];
      const presence = activePresences[index];
      const locationId = getLocationDocId(shelfCode, pos);
      newLocationIds.push(locationId);
      const locRef = doc(db, COLLECTIONS.SHELVES, shelfCode, COLLECTIONS.LOCATIONS, pos);
      const locSnap = await tx.get(locRef);
      const currentItems: LocationItem[] = locSnap.exists() ? ((locSnap.data() as LocationDoc).items || []) : [];
      tx.set(locRef, {
        position: pos,
        items: [...currentItems, {
          presenceId: presence.data.presenceId,
          articleCode,
          orderFab,
          locatedBy: operarioId,
          locatedByName: operarioName,
          locatedAt: now,
        }],
        isEmpty: false,
      }, { merge: true });

      tx.update(presence.ref, { locationIds: [locationId], shelfCode });
    }

    if (aggregateSnap.exists()) {
      tx.set(aggregateRef, { updatedAt: now }, { merge: true });
    }

    const historyRef = doc(collection(db, COLLECTIONS.HISTORY));
    tx.set(historyRef, {
      action: 'MOVER',
      articleCode,
      orderFab,
      fromLocation: oldLocationIds.join(', '),
      toLocation: newLocationIds.join(', '),
      shelfCode,
      operarioId,
      operarioName,
      timestamp: now,
    } as HistoryEntryDoc);
  });
};

export const executeCreatePickupRequest = async ({ operarioId, operarioName, shelfCode }: CreatePickupPayload) => {
  const shelfDef = getShelfDefinition(shelfCode);
  const section = getSectionForShelf(shelfCode);
  const newRequest: PickupRequestDoc = {
    operarioId,
    operarioName,
    shelfSection: section,
    shelfCode,
    shelfName: shelfDef?.name || shelfCode,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    completedAt: null,
    completedBy: null,
  };

  await addDoc(collection(db, COLLECTIONS.PICKUP_QUEUE), newRequest);
  await addDoc(collection(db, COLLECTIONS.HISTORY), {
    action: 'AVISAR_CARRETILLERO',
    articleCode: '',
    orderFab: '',
    fromLocation: null,
    toLocation: null,
    shelfCode,
    operarioId,
    operarioName,
    timestamp: newRequest.createdAt,
  } as HistoryEntryDoc);
};

export const executeCompletePickupRequest = async ({ requestId, completedByUid }: CompletePickupPayload) => {
  await updateDoc(doc(db, COLLECTIONS.PICKUP_QUEUE, requestId), {
    status: 'COMPLETED' as PickupStatus,
    completedAt: new Date().toISOString(),
    completedBy: completedByUid,
  });
};
