
import { db } from './firebase';
import { AssignmentItem, WorkingItem, FinishedItem, LocationId, getSectionFromLocation, ItemStatus, PackageType } from './warehouseData';
import firebase from "firebase/compat/app";
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a consistent key for an item based on barcode and orderId.
 */
export const getItemKey = (barcode: string, orderId: string): string => {
    return `${barcode.trim().toUpperCase()}__${orderId.trim().toUpperCase()}`;
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
    const itemKey = getItemKey(item.barcode, item.orderId);
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
    const itemKey = item.itemKey || getItemKey(item.barcode, item.orderId);

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
 * Direct Finish from Shelf (Short-circuit).
 * Removes from assignments provided by caller, adds to finishedItems.
 */
export const finishDirectly = async (
    item: AssignmentItem,
    fromLocationId: LocationId,
    user?: { uid: string; displayName: string }
): Promise<void> => {
    const itemKey = getItemKey(item.barcode, item.orderId);

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
