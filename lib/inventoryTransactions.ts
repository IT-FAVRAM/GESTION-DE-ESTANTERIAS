import { db } from './firebase';
import { AssignmentItem, LocationId, PackageType } from './warehouseData';
import firebase from 'firebase/compat/app';

interface TransactionOptions {
    opId?: string; // Idempotency key
    user?: string; // User email or ID for history
}

export type TransactionResult<T = void> = {
    success: boolean;
    data?: T;
    error?: string;
};

// Helper: Get strictly required fields from an item to avoid saving undefined/extra
const sanitizeItem = (item: AssignmentItem): any => {
    return {
        barcode: item.barcode,
        orderId: item.orderId,
        timestamp: item.timestamp,
        assignedAt: item.assignedAt,
        movedAt: item.movedAt || null,
        packageType: item.packageType || null,
        status: item.status || 'UBICADO'
    };
};

/**
 * Assigns an item to a location using a transaction.
 * Prevents over-writes by reading the latest state.
 */
export const assignItemTransaction = async (
    barcode: string,
    orderId: string,
    locationId: LocationId,
    options: TransactionOptions = {},
    itemData: Partial<AssignmentItem> = {}
): Promise<TransactionResult> => {
    const { opId, user } = options;
    const now = new Date().toISOString();

    const whCode = locationId.split('-')[0];
    const locRef = db.collection("assignments").doc(whCode).collection("locations").doc(locationId);
    const historyRef = db.collection("history"); // Or whatever the history collection is named

    try {
        await db.runTransaction(async (transaction) => {
            const locDoc = await transaction.get(locRef);
            let currentItems: AssignmentItem[] = [];

            if (locDoc.exists) {
                const data = locDoc.data();
                currentItems = (data?.items as AssignmentItem[]) || [];
            }

            // check idempotency if we had a dedicated "operations" log, 
            // but here we can just check if the item is already there exactly as requested.
            const exists = currentItems.some(i => i.barcode === barcode && i.orderId === orderId);
            if (exists) {
                // If it exists, we assume success (idempotent)
                return;
            }

            const newItem: AssignmentItem = {
                barcode,
                orderId,
                timestamp: now,
                assignedAt: now,
                movedAt: undefined,
                packageType: itemData.packageType,
                status: 'UBICADO'
            };

            const newItems = [...currentItems, sanitizeItem(newItem)];

            transaction.set(locRef, {
                items: newItems,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Add History Entry
            const historyEntry = {
                barcode,
                orderId,
                action: 'assigned',
                toLocation: locationId,
                timestamp: now,
                user: user || 'system',
                opId: opId || null
            };

            // Create a new doc for history
            const newHistoryRef = historyRef.doc();
            transaction.set(newHistoryRef, historyEntry);
        });

        return { success: true };
    } catch (e: any) {
        console.error("Transaction failed:", e);
        return { success: false, error: e.message };
    }
};

/**
 * Removes an item from a location transactionally.
 */
export const removeItemTransaction = async (
    barcode: string,
    locationId: LocationId,
    orderId?: string,
    options: TransactionOptions = {}
): Promise<TransactionResult> => {
    const { opId, user } = options;
    const now = new Date().toISOString();

    const whCode = locationId.split('-')[0];
    const locRef = db.collection("assignments").doc(whCode).collection("locations").doc(locationId);
    const historyRef = db.collection("history");

    try {
        await db.runTransaction(async (transaction) => {
            const locDoc = await transaction.get(locRef);
            if (!locDoc.exists) {
                throw new Error("Location does not exist");
            }

            const currentItems = (locDoc.data()?.items as AssignmentItem[]) || [];

            // Find item logic (Strict vs Fuzzy)
            let itemIndex = -1;
            let resolvedOrderId = orderId;

            if (orderId) {
                itemIndex = currentItems.findIndex(i => i.barcode === barcode && i.orderId === orderId);
            }

            // Fallback: Fuzzy search if explicit OrderID wasn't found or wasn't provided
            if (itemIndex === -1) {
                // Determine if we can safe-delete a unique barcode
                const matches = currentItems.filter(i => i.barcode === barcode);
                if (matches.length === 1) {
                    // Safe to delete the only instance
                    resolvedOrderId = matches[0].orderId;
                    itemIndex = currentItems.findIndex(i => i.barcode === barcode && i.orderId === resolvedOrderId);
                } else if (matches.length > 1) {
                    // Ambiguous delete request without valid ID
                    throw new Error(`Ambiguous delete: Multiple items with barcode ${barcode} in location. OrderID required.`);
                }
            }

            if (itemIndex === -1) {
                // Item not found, treat as already done (idempotent success) or error? 
                // For UI feedback, usually better to throw if user really expected it there.
                // But if we want idempotency, we just return.
                // Let's return success but log warning.
                return;
            }

            const itemToRemove = currentItems[itemIndex];
            const newItems = [...currentItems];
            newItems.splice(itemIndex, 1);

            if (newItems.length === 0) {
                transaction.delete(locRef);
            } else {
                transaction.set(locRef, {
                    items: newItems,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Add History Entry
            const historyEntry = {
                barcode,
                orderId: resolvedOrderId || itemToRemove.orderId,
                action: 'removed',
                fromLocation: locationId,
                timestamp: now,
                user: user || 'system',
                opId: opId || null
            };
            const newHistoryRef = historyRef.doc();
            transaction.set(newHistoryRef, historyEntry);
        });

        return { success: true };
    } catch (e: any) {
        console.error("Remove Transaction failed:", e);
        return { success: false, error: e.message };
    }
};

/**
 * Moves an item from A to B transactionally.
 */
export const moveItemTransaction = async (
    barcode: string,
    fromLoc: LocationId,
    toLoc: LocationId,
    orderId: string, // OrderId is mandatory for safe moves
    options: TransactionOptions = {}
): Promise<TransactionResult> => {
    if (fromLoc === toLoc) return { success: true };

    const { opId, user } = options;
    const now = new Date().toISOString();

    const fromWh = fromLoc.split('-')[0];
    const toWh = toLoc.split('-')[0];

    const fromRef = db.collection("assignments").doc(fromWh).collection("locations").doc(fromLoc);
    const toRef = db.collection("assignments").doc(toWh).collection("locations").doc(toLoc);
    const historyRef = db.collection("history");

    try {
        await db.runTransaction(async (transaction) => {
            const fromDoc = await transaction.get(fromRef);
            const toDoc = await transaction.get(toRef);

            // 1. Validate Source
            if (!fromDoc.exists) throw new Error("Source location empty/missing");
            const sourceItems = (fromDoc.data()?.items as AssignmentItem[]) || [];

            const itemIndex = sourceItems.findIndex(i => i.barcode === barcode && i.orderId === orderId);
            if (itemIndex === -1) {
                throw new Error("Item not found in source location");
            }
            const itemToMove = sourceItems[itemIndex];

            // 2. Prepare Destination
            let targetItems: AssignmentItem[] = [];
            if (toDoc.exists) {
                targetItems = (toDoc.data()?.items as AssignmentItem[]) || [];
            }

            // Check duplicate in target
            if (targetItems.some(i => i.barcode === barcode && i.orderId === orderId)) {
                // Already in target! 
                // We should check if it's still in source. If so, copy? Or logic error?
                // Standard Logic: Fail to prevent duplicate, or assume "Already Moved" but we must remove from source if it's there?
                // If it is in BOTH, we should probably remove from source to consistent state.
                // Let's proceed with move logic: Remove from source, ensure in target.
            }

            // 3. Updates
            const newSourceItems = [...sourceItems];
            newSourceItems.splice(itemIndex, 1);

            if (newSourceItems.length === 0) {
                transaction.delete(fromRef);
            } else {
                transaction.set(fromRef, {
                    items: newSourceItems,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Add to target if not exists
            const alreadyInTarget = targetItems.some(i => i.barcode === barcode && i.orderId === orderId);
            if (!alreadyInTarget) {
                const newItem: AssignmentItem = {
                    ...itemToMove,
                    timestamp: now, // Update timestamp? usually yes for sorting
                    movedAt: now
                };

                targetItems.push(sanitizeItem(newItem));
                transaction.set(toRef, {
                    items: targetItems,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // 4. History
            const historyEntry = {
                barcode,
                orderId,
                action: 'relocated',
                fromLocation: fromLoc,
                toLocation: toLoc,
                timestamp: now,
                user: user || 'system',
                opId: opId || null
            };
            const newHistoryRef = historyRef.doc();
            transaction.set(newHistoryRef, historyEntry);
        });

        return { success: true };
    } catch (e: any) {
        console.error("Move Transaction failed:", e);
        return { success: false, error: e.message };
    }
};
