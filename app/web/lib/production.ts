
import { db } from '../legacy/firebaseCompat';
import { AssignmentItem, WorkingItem, FinishedItem, LocationId, getSectionFromLocation, ItemStatus, PackageType } from './warehouseData';
import firebase from "firebase/compat/app";
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a consistent key for an item based on barcode and orderId.
 */
export const getItemKey = (barcode: string, orderId: string): string => {
    return `${barcode.trim().toUpperCase()}__${orderId.trim().toUpperCase()}`;
};

export const getItemIdentityKey = (barcode: string, orderId: string, containerId?: string): string => {
    const base = getItemKey(barcode, orderId);
    return containerId ? `${base}__${containerId.trim().toUpperCase()}` : base;
};

/**
 * Moves an item from "Assigned" (Shelf) to "Working" (En Trabajo).
 * This operation involves:
 * 1. Removing from `assignments` (handled by useAssignments caller usually, but we can do it here if we have the path). 
 *    Actually, useAssignments manages the local state and sync. Ideally, we do this transactionally.
 *    However, since `assignments` is sharded by warehouse, and `workingItems` is a global collection, 
 *    a cross-shard transaction is possible but complex if we don't know the exact doc path easily or if the caller handles state.
 *    
 *    Design decision: The caller (useAssignments) removes from shelf. This service adds to `workingItems`.
 */
export const moveToWorking = async (
    item: AssignmentItem,
    fromLocationId: LocationId,
    user?: { uid: string; displayName: string }
): Promise<void> => {
    const itemKey = item.itemKey || getItemIdentityKey(item.barcode, item.orderId, item.containerId);
    const section = getSectionFromLocation(fromLocationId) || 'OTROS';

    const workingItem: WorkingItem = {
        ...item,
        status: 'EN_TRABAJO',
        section,
        fromLocationId,
        withdrawnAt: new Date().toISOString(),
        withdrawnBy: user?.displayName || 'Desconocido',
        itemKey,
        assignedAt: item.assignedAt || new Date().toISOString()
    };

    // Use set with merge to be idempotent
    await db.collection("workingItems").doc(itemKey).set(workingItem, { merge: true });

    // History log
    await db.collection("history").add({
        id: uuidv4(),
        barcode: item.barcode,
        orderId: item.orderId,
        action: 'moved_to_working',
        fromLocation: fromLocationId,
        toLocation: 'EN_TRABAJO' as any,
        timestamp: new Date().toISOString(),
        user: user?.displayName || 'System'
    });
};

/**
 * Moves an item from "Working" to "Finished".
 */
export const finishWorkingItem = async (
    item: WorkingItem,
    user?: { uid: string; displayName: string }
): Promise<void> => {
    const itemKey = item.itemKey || getItemIdentityKey(item.barcode, item.orderId, item.containerId);

    const finishedItem: FinishedItem = {
        id: itemKey,
        barcode: item.barcode,
        orderId: item.orderId,
        timestamp: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        finishedBy: user?.displayName || 'Desconocido',
        status: 'FINALIZADO',
        previousStatus: 'EN_TRABAJO',
        packageType: item.packageType
    };

    const batch = db.batch();

    // 1. Add to finishedItems
    const finishedRef = db.collection("finishedItems").doc(itemKey);
    batch.set(finishedRef, finishedItem);

    // 2. Remove from workingItems
    const workingRef = db.collection("workingItems").doc(itemKey);
    batch.delete(workingRef);

    // 3. Log History
    const historyRef = db.collection("history").doc();
    batch.set(historyRef, {
        id: historyRef.id,
        barcode: item.barcode,
        orderId: item.orderId,
        action: 'process_finished',
        fromLocation: 'EN_TRABAJO' as any,
        toLocation: 'FINALIZADO' as any,
        timestamp: new Date().toISOString(),
        user: user?.displayName || 'System'
    });

    await batch.commit();
};

/**
 * Atomic transition from shelf assignment to workingItems.
 */
export const withdrawToWorkingAtomic = async (
    barcode: string,
    orderId: string,
    fromLocationId: LocationId,
    identity?: { itemKey?: string; containerId?: string },
    user?: { uid: string; displayName: string }
): Promise<void> => {
    const itemKey = identity?.itemKey || getItemIdentityKey(barcode, orderId, identity?.containerId);
    const section = getSectionFromLocation(fromLocationId) || 'OTROS';
    const now = new Date().toISOString();

    const sourceWarehouse = fromLocationId.split('-')[0];
    const sourceRef = db.collection("assignments").doc(sourceWarehouse).collection("locations").doc(fromLocationId);
    const workingRef = db.collection("workingItems").doc(itemKey);
    const historyRef = db.collection("history").doc();

    await db.runTransaction(async (transaction) => {
        const [sourceDoc, workingDoc] = await Promise.all([
            transaction.get(sourceRef),
            transaction.get(workingRef)
        ]);

        if (workingDoc.exists) {
            return;
        }

        const sourceItems: AssignmentItem[] = ((sourceDoc.data()?.items as AssignmentItem[]) || []);
        const itemIndex = sourceItems.findIndex(i => {
            if (identity?.itemKey) return i.itemKey === identity.itemKey;
            if (identity?.containerId) {
                return i.barcode === barcode && i.orderId === orderId && i.containerId === identity.containerId;
            }
            return i.barcode === barcode && i.orderId === orderId;
        });
        if (itemIndex < 0) {
            throw new Error('El articulo no se encuentra en la ubicacion origen.');
        }

        const item = sourceItems[itemIndex];

        const updatedItems = sourceItems.filter((_, idx) => idx !== itemIndex);
        if (updatedItems.length === 0) {
            transaction.delete(sourceRef);
        } else {
            transaction.set(sourceRef, {
                items: updatedItems,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        const workingItem: WorkingItem = {
            ...item,
            status: 'EN_TRABAJO',
            section,
            fromLocationId,
            withdrawnAt: now,
            withdrawnBy: user?.displayName || 'Desconocido',
            itemKey,
            assignedAt: item.assignedAt || now
        };

        transaction.set(workingRef, workingItem, { merge: true });

        transaction.set(historyRef, {
            id: historyRef.id,
            barcode,
            orderId,
            action: 'moved_to_working',
            fromLocation: fromLocationId,
            toLocation: 'EN_TRABAJO' as any,
            timestamp: now,
            user: user?.displayName || 'System'
        });
    });
};

/**
 * Moves an item from "Working" back to a warehouse location.
 */
export const locateWorkingItem = async (
    item: WorkingItem,
    toLocation: LocationId,
    user?: { uid: string; displayName: string }
): Promise<void> => {
    const itemKey = item.itemKey || getItemIdentityKey(item.barcode, item.orderId, item.containerId);
    const now = new Date().toISOString();

    const targetWarehouse = toLocation.split('-')[0];
    const targetRef = db.collection("assignments").doc(targetWarehouse).collection("locations").doc(toLocation);
    const workingRef = db.collection("workingItems").doc(itemKey);
    const historyRef = db.collection("history").doc();

    await db.runTransaction(async (transaction) => {
        const [targetDoc, workingDoc] = await Promise.all([
            transaction.get(targetRef),
            transaction.get(workingRef)
        ]);

        if (!workingDoc.exists) {
            throw new Error('El articulo ya no esta en trabajo.');
        }

        const currentItems: AssignmentItem[] = ((targetDoc.data()?.items as AssignmentItem[]) || []);
        const alreadyExists = currentItems.some(i => i.barcode === item.barcode && i.orderId === item.orderId);

        if (!alreadyExists) {
            const assignedItem: AssignmentItem = {
                barcode: item.barcode,
                orderId: item.orderId,
                timestamp: now,
                assignedAt: item.assignedAt || now,
                movedAt: now,
                packageType: item.packageType,
                status: 'UBICADO',
                itemKey,
                quantity: item.quantity ?? 1,
                containerId: item.containerId,
                notes: item.notes
            };

            transaction.set(targetRef, {
                items: [...currentItems, assignedItem],
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        transaction.delete(workingRef);

        transaction.set(historyRef, {
            id: historyRef.id,
            barcode: item.barcode,
            orderId: item.orderId,
            action: 'relocated',
            fromLocation: 'EN_TRABAJO' as any,
            toLocation,
            timestamp: now,
            user: user?.displayName || 'System'
        });
    });
};

/**
 * Finds matching working items and relocates them to a shelf location.
 * Returns how many working records were relocated.
 */
export const locateWorkingItemsByBarcodeOrder = async (
    barcode: string,
    orderId: string,
    toLocation: LocationId,
    user?: { uid: string; displayName: string }
): Promise<number> => {
    const normalizedBarcode = barcode.trim().toUpperCase();
    const normalizedOrderId = orderId.trim().toUpperCase();
    const docsById = new Map<string, firebase.firestore.DocumentSnapshot<firebase.firestore.DocumentData>>();

    const directRef = db.collection('workingItems').doc(getItemKey(normalizedBarcode, normalizedOrderId));
    const directDoc = await directRef.get();
    if (directDoc.exists) {
        docsById.set(directDoc.id, directDoc);
    }

    const searchPairs: Array<[string, string]> = [
        [barcode.trim(), orderId.trim()],
        [normalizedBarcode, normalizedOrderId]
    ];

    for (const [searchBarcode, searchOrderId] of searchPairs) {
        const snapshot = await db
            .collection('workingItems')
            .where('barcode', '==', searchBarcode)
            .where('orderId', '==', searchOrderId)
            .get();

        snapshot.docs.forEach((doc) => docsById.set(doc.id, doc));
    }

    if (docsById.size === 0) {
        return 0;
    }

    for (const doc of docsById.values()) {
        const workingItem = doc.data() as WorkingItem;
        await locateWorkingItem({ ...workingItem, itemKey: workingItem.itemKey || doc.id }, toLocation, user);
    }

    return docsById.size;
};

/**
 * Attempts to locate working items by barcode only.
 * If requireSingleOrder is true, it only proceeds when all matches share the same orderId.
 */
export const locateWorkingItemsByBarcode = async (
    barcode: string,
    toLocation: LocationId,
    user?: { uid: string; displayName: string },
    requireSingleOrder = true
): Promise<number> => {
    const normalizedBarcode = barcode.trim().toUpperCase();
    const docsById = new Map<string, firebase.firestore.DocumentSnapshot<firebase.firestore.DocumentData>>();

    const searchBarcodes = new Set([barcode.trim(), normalizedBarcode]);
    for (const searchBarcode of searchBarcodes) {
        const snapshot = await db
            .collection('workingItems')
            .where('barcode', '==', searchBarcode)
            .get();

        snapshot.docs.forEach((doc) => docsById.set(doc.id, doc));
    }

    if (docsById.size === 0) {
        return 0;
    }

    if (requireSingleOrder) {
        const distinctOrders = new Set(
            Array.from(docsById.values()).map((doc) => ((doc.data() as WorkingItem).orderId || '').trim().toUpperCase())
        );
        if (distinctOrders.size > 1) {
            return 0;
        }
    }

    for (const doc of docsById.values()) {
        const workingItem = doc.data() as WorkingItem;
        await locateWorkingItem({ ...workingItem, itemKey: workingItem.itemKey || doc.id }, toLocation, user);
    }

    return docsById.size;
};

/**
 * Direct Finish from Shelf (Short-circuit).
 * Removes from assignments provided by caller, adds to finishedItems.
 */
export const finishDirectly = async (
    item: AssignmentItem,
    fromLocationId: LocationId,
    user?: { uid: string; displayName: string }
): Promise<void> => {
    const itemKey = item.itemKey || getItemIdentityKey(item.barcode, item.orderId, item.containerId);

    const finishedItem: FinishedItem = {
        id: itemKey,
        barcode: item.barcode,
        orderId: item.orderId,
        timestamp: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        finishedBy: user?.displayName || 'Desconocido',
        status: 'FINALIZADO',
        previousStatus: 'UBICADO',
        packageType: item.packageType
    };

    // We assume the caller removes it from the shelf in `assignments`.
    // We just write the finished record and history.

    const batch = db.batch();

    // 1. Add to finishedItems
    const finishedRef = db.collection("finishedItems").doc(itemKey);
    batch.set(finishedRef, finishedItem);

    // 2. Log History
    const historyRef = db.collection("history").doc();
    batch.set(historyRef, {
        id: historyRef.id,
        barcode: item.barcode,
        orderId: item.orderId,
        action: 'process_finished',
        fromLocation: fromLocationId,
        toLocation: 'FINALIZADO' as any,
        timestamp: new Date().toISOString(),
        user: user?.displayName || 'System'
    });

    await batch.commit();
};

export const updatePackageType = async (
    collection: 'assignments' | 'workingItems' | 'finishedItems',
    docPath: string, // For assignments: "WH/locations/LOC_ID", for others: "ITEM_KEY"
    itemKey: string,
    newType: PackageType
) => {
    // This is a bit tricky because 'assignments' is nested. 
    // The caller needs to handle 'assignments' update via useAssignments hook usually.
    // This helper might be useful only for working/finished items.

    if (collection === 'workingItems' || collection === 'finishedItems') {
        await db.collection(collection).doc(itemKey).update({ packageType: newType });
    }
};
