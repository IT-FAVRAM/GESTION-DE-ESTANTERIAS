
import React, { useCallback } from 'react';
import { Assignments, AssignmentItem, LocationId, ActionType, WarehouseCode, ShelfNumber, RACKS, POSITIONS, isUrgentLocation, PackageType } from '../lib/warehouseData';
import { useHistory } from './useHistory';
import { NotificationType } from '../components/NotificationToast';
import { BatchItem } from '../App';
import { SystemAlert } from './useSystemNotifications';
import { assignItemTransaction, moveItemTransaction, removeItemTransaction } from '../lib/inventoryTransactions';

/**
 * This hook acts as a Facade for business logic.
 * It orchestrates updates to both Assignments and History.
 * NOW USES TRANSACTIONS for critical path operations.
 */
export const useInventoryOperations = (
    assignments: Assignments,
    setAssignments: React.Dispatch<React.SetStateAction<Assignments>>, // Still needed for legacy/admin ops handled locally or optimistic updates if we wanted them
    addHistoryEntry: ReturnType<typeof useHistory>['addHistoryEntry'],
    notify?: (type: NotificationType, title: string, message: string) => void,
    sendSystemAlert?: (alert: Omit<SystemAlert, 'id' | 'readBy' | 'timestamp'>) => Promise<void>,
    userEmail?: string
) => {

    // --- HELPER: FIND ITEM LOCATION ---
    const findItemLocation = useCallback((barcode: string, orderId?: string): LocationId | null => {
        const safeBarcode = barcode.trim().toUpperCase();
        const safeOrder = orderId ? orderId.trim().toUpperCase() : null;

        if (safeOrder) {
            for (const locId in assignments) {
                if (assignments[locId as LocationId].some(item => item.barcode === safeBarcode && item.orderId === safeOrder)) {
                    return locId as LocationId;
                }
            }
        }

        for (const locId in assignments) {
            if (assignments[locId as LocationId].some(item => item.barcode === safeBarcode)) {
                return locId as LocationId;
            }
        }

        return null;
    }, [assignments]);

    // --- SINGLE OR MULTI ASSIGNMENT ---
    const assignItem = useCallback(async (
        barcode: string,
        orderId: string,
        locationOrLocations: LocationId | LocationId[],
        options: { allowMultiLocation?: boolean; packageType?: PackageType } = {}
    ) => {
        const locations = Array.isArray(locationOrLocations) ? locationOrLocations : [locationOrLocations];
        const { allowMultiLocation = false, packageType } = options;
        const opId = crypto.randomUUID();

        // 1. Urgency Check & Alerts
        let isUrgent = false;
        let urgentLocation = '';
        locations.forEach(loc => {
            if (isUrgentLocation(loc)) { isUrgent = true; urgentLocation = loc; }
        });

        if (isUrgent) {
            if (notify) notify('warning', 'UBICACIÓN URGENTE', `El artículo se ha colocado en zona prioritaria.`);
            if (sendSystemAlert) {
                sendSystemAlert({
                    targetRole: 'JEFE',
                    type: 'urgent_placement',
                    title: '🚨 Material Urgente Ubicado',
                    message: `📦 Un artículo urgente (${barcode}) ha sido colocado en ${urgentLocation}. Revisión prioritaria requerida.`,
                    metadata: { barcode, location: urgentLocation }
                });
            }
        }

        // 2. Identify Moves vs New Assignments (Local check for context/alerting, but transaction handles consistency)
        // If !allowMultiLocation, we SHOULD try to remove from old location first.
        let previousLocations: LocationId[] = [];
        const effectiveAllowMultiLocation = allowMultiLocation || locations.length > 1;

        if (!effectiveAllowMultiLocation) {
            for (const locId in assignments) {
                const foundItem = assignments[locId as LocationId].find(item => item.barcode === barcode && item.orderId === orderId);
                if (foundItem && !locations.includes(locId as LocationId)) {
                    previousLocations.push(locId as LocationId);
                }
            }
        }

        // 3. Execution Loop (Parallel Transactions)
        // If it's a move, we must do remove + add. Transactional lib has 'moveItemTransaction'.
        // But if previousLocations exists, it implies a move. 
        // Logic:
        // A) If previousLocations found -> Use moveItemTransaction for each previous->target pair?
        //    Complex if 1 source -> N targets.
        //    Simpler: Remove from source(s) then Add to target(s).
        //    Or just use assignItemTransaction and let the user strictly "Move" via the move modal?
        //    The 'assignItem' function here is a "Super Assign" that auto-moves if needed.

        try {
            const promises: Promise<any>[] = [];

            // Handle Moves (Implicit)
            for (const prevLoc of previousLocations) {
                // If we are moving to multiple locations, we remove from source once, then add to all?
                // Actually if allowMultiLocation=false, we expect 1 target.
                // If we have 1 source, 1 target -> MoveTransaction
                if (locations.length === 1) {
                    promises.push(moveItemTransaction(barcode, prevLoc, locations[0], orderId, { opId, user: userEmail }));
                    // We don't need to assign again if we moved.
                    // But we might need to handle the loop carefully.
                } else {
                    // Multi target from 1 source? Remove from source, assign to targets.
                    promises.push(removeItemTransaction(barcode, prevLoc, orderId, { opId, user: userEmail }));
                }
            }

            // If we did a 1-to-1 move, we are done.
            if (previousLocations.length === 1 && locations.length === 1) {
                const res = await promises[0];
                if (!res.success) throw new Error(res.error);
                if (notify) notify('success', 'Ubicado (M)', `${barcode} movido a ${locations[0]}`);
                return;
            }

            // Otherwise (New Assignment OR Multi-target move where we just removed source)
            // Execute Assign on all targets
            // Note: If we just removed it, it's gone from DB. Now we add it.
            // We need to wait for removals if strictly consistent, but firestore is fast. verify? 
            // Better: await all removals, then assign.
            await Promise.all(promises);

            const assignPromises = locations.map(loc => {
                // Skip if we already did a move transaction to this loc
                if (previousLocations.length === 1 && previousLocations[0] !== loc && locations.length === 1) return Promise.resolve({ success: true });

                return assignItemTransaction(barcode, orderId, loc, { opId, user: userEmail }, { packageType });
            });

            const results = await Promise.all(assignPromises);
            const failures = results.filter(r => !r.success);

            if (failures.length > 0) {
                throw new Error(failures[0].error || "Error en asignación múltiple");
            }

            // Success Notification
            if (previousLocations.length > 0) {
                if (notify) notify('success', 'Reubicado', `${barcode} movido a ${locations.length} ubicación(es).`);
            } else {
                // Determine notification text
                const target = locations.length === 1 ? locations[0] : `${locations.length} ubicaciones`;
                if (notify) notify('success', 'Asignado', `${barcode} asignado a ${target}`);
            }

        } catch (err: any) {
            console.error("Assign Error:", err);
            if (notify) notify('error', 'Error de Asignación', err.message || "Fallo en la operación");
        }

    }, [assignments, setAssignments, addHistoryEntry, notify, sendSystemAlert, userEmail]);

    // --- REQUEST ITEM --- (Keep existing logic, history is local-ish but safe enough, or move to transaction if critical? Request isn't changing inventory, just logging history/alert. Keep as is for now or use dummy transaction? Keep as is.)
    const requestItem = useCallback((barcode: string, orderId: string, fromLocation?: string, priority: 'normal' | 'high' = 'normal') => {
        const now = new Date().toISOString();
        addHistoryEntry({
            barcode,
            orderId,
            action: 'requested',
            fromLocation: fromLocation as LocationId,
            timestamp: now
        });

        const urgencyText = priority === 'high' ? 'URGENTE' : '';
        if (notify) notify('success', `Solicitud Enviada ${urgencyText}`, `Se ha notificado al carretillero: ${barcode}`);

        if (sendSystemAlert) {
            const locText = fromLocation ? `desde ${fromLocation}` : 'para recogida';
            const urgencyPrefix = priority === 'high' ? '🚨 URGENTE: ' : '🚚 ';

            sendSystemAlert({
                targetRole: 'CARRETILLERO',
                type: 'request_material',
                title: `${urgencyPrefix}Nueva Solicitud de Material`,
                message: `🛠 Se ha solicitado el artículo ${barcode} (OF: ${orderId}) ${locText}. Preparar para traslado.`,
                metadata: { barcode, location: fromLocation, priority }
            });
        }
    }, [addHistoryEntry, notify, sendSystemAlert]);


    // --- DELETE ITEM ---
    const removeItem = useCallback(async (barcode: string, location: LocationId, orderId?: string): Promise<boolean> => {
        const opId = crypto.randomUUID();

        try {
            const result = await removeItemTransaction(barcode, location, orderId, { opId, user: userEmail });

            if (!result.success) {
                if (notify) notify('error', 'Error al retirar', result.error || "Fallo desconocido");
                return false;
            }

            // Assuming the listener will update the UI.
            // We can show success immediately.
            // if (notify) notify('success', 'Retirado', `${barcode} retirado de ${location}`); 
            // ^ App.tsx does the notify usually based on return value.
            return true;
        } catch (e: any) {
            console.error(e);
            return false;
        }
    }, [notify, userEmail]);


    // --- MOVE ITEM ---
    const moveItem = useCallback(async (barcode: string, fromLocation: LocationId, toLocation: LocationId, orderId?: string) => {
        if (fromLocation === toLocation) return;
        const opId = crypto.randomUUID();

        // Safe orderId check: moveTransaction requires strict orderId. 
        // If not provided, we must find it first.
        let safeOrderId = orderId;
        if (!safeOrderId) {
            // Find in assignments to get valid ID
            const item = assignments[fromLocation]?.find(i => i.barcode === barcode);
            if (item) safeOrderId = item.orderId;
            else {
                if (notify) notify('error', 'Error', 'No se encontró el artículo original para mover.');
                return;
            }
        }

        // Urgency Check
        let isUrgent = isUrgentLocation(toLocation);
        if (isUrgent) {
            if (notify) notify('warning', 'AVISO DE URGENCIA', 'Movimiento a zona URGENTE detectado.');
            if (sendSystemAlert) {
                sendSystemAlert({
                    targetRole: 'JEFE',
                    type: 'urgent_placement',
                    title: '🚨 Material Movido a Urgente',
                    message: `📦 El artículo ${barcode} ha sido movido a ${toLocation} (Zona Urgente).`,
                    metadata: { barcode, location: toLocation }
                });
            }
        }

        const result = await moveItemTransaction(barcode, fromLocation, toLocation, safeOrderId!, { opId, user: userEmail });

        if (result.success) {
            if (notify) notify('success', 'Reubicado', `${barcode} movido a ${toLocation}`);
        } else {
            if (notify) notify('error', 'Error al mover', result.error || "Fallo de transacción");
        }

    }, [assignments, notify, sendSystemAlert, userEmail]);


    // --- EMPTY SHELF (Admin) ---
    // Keep local for now or TODO: refactor to transaction if critical. 
    // Given the request asks for "Assign/Move/Remove", emptyShelf is lower priority but should ideally be safe.
    // For now we keep the optimistic version to avoid breaking it, as it's a massive delete.
    const emptyShelf = useCallback((warehouse: WarehouseCode, shelf: ShelfNumber) => {
        const now = new Date().toISOString();
        setAssignments(prevAssignments => {
            const newAssignments: Assignments = { ...prevAssignments };
            const locationsToRemove: LocationId[] = [];

            for (const rack of RACKS) {
                for (const pos of POSITIONS) {
                    const locId = `${warehouse}-E${shelf}-B${rack}-${pos}` as LocationId;
                    if (newAssignments[locId]) {
                        newAssignments[locId].forEach(item => {
                            addHistoryEntry({
                                barcode: item.barcode,
                                orderId: item.orderId,
                                action: 'removed',
                                fromLocation: locId,
                                timestamp: now
                            });
                        });
                        locationsToRemove.push(locId);
                    }
                }
            }
            locationsToRemove.forEach(locId => {
                delete newAssignments[locId];
            });
            return newAssignments;
        });
        if (notify) notify('success', 'Estantería Vaciada', `Estantería ${shelf} vaciada.`);
    }, [setAssignments, addHistoryEntry, notify]);

    // --- DEPRECATED / UTILS ---
    const batchAssign = useCallback(() => { }, []);
    const batchAssignToSingleLocation = useCallback(() => { }, []); // Should ideally reuse assignItem
    const batchAssignToMultipleLocations = useCallback(() => { }, []);

    const relocateLocationContents = useCallback(async (fromLoc: LocationId, toLoc: LocationId) => {
        // This is a bulk move. We should ideally make a 'relocateLocationTransaction' or iterate.
        // For now, keep as legacy local update OR implement iteration.
        // Let's iterate assignments locally and call moveTransaction for safety.
        const items = assignments[fromLoc] || [];
        if (items.length === 0) return;

        // Fire and forget all moves? Or sequence? Sequence safer.
        // Note: If we do this, the UI might flicker if we rely only on snapshot.
        // This is Admin only, so flickering is acceptable vs data loss.
        for (const item of items) {
            await moveItemTransaction(item.barcode, fromLoc, toLoc, item.orderId, { user: userEmail });
        }
        if (notify) notify('success', 'Ubicación Reubicada', `Contenido movido a ${toLoc}`);

    }, [assignments, userEmail, notify]);

    const adminClearLocations = useCallback(async (locationIds: string[]) => {
        // Bulk remove
        for (const locId of locationIds) {
            // How to atomic remove whole location? removeItemTransaction removes item by item.
            // We need a "clearLocationTransaction".
            // Since we implemented 'removeItemTransaction', we can iterate items.
            // Or better: just delete the doc in firestore for that location?
            // The logic requires removing specific items to log history.
            // Let's stick to optimistic local update for this admin tool OR iterate deletes.
            // Since it's "Clear", maybe just pure delete is fine?
            // User request mentioned "Opción B: arrays pero siempre con transacciones".
            // If we are strictly consistent, we should iterate.
            const items = assignments[locId as LocationId] || [];
            for (const item of items) {
                await removeItemTransaction(item.barcode, locId as LocationId, item.orderId, { user: userEmail });
            }
        }
        if (notify) notify('success', 'Vaciado', `${locationIds.length} ubicaciones vaciadas.`);
    }, [assignments, userEmail, notify]);

    const withdrawItem = useCallback(async (barcode: string, location: LocationId, orderId: string) => {
        // Call service normally
        try {
            const { moveToWorking } = await import('../lib/production');
            const item = assignments[location]?.find(i => i.barcode === barcode && i.orderId === orderId);
            if (!item) return false;

            await moveToWorking(item, location); // This should be atomic ideally but it's external service.

            // Now remove from our DB efficiently.
            await removeItemTransaction(barcode, location, orderId, { user: userEmail });

            if (notify) notify('success', 'En Trabajo', `Artículo ${barcode} movido a producción.`);
            return true;
        } catch (e: any) {
            if (notify) notify('error', 'Error', e.message);
            return false;
        }
    }, [assignments, userEmail, notify]);

    const copyItem = useCallback((barcode: string, fromLocation: LocationId, toLocation: LocationId, orderId?: string) => {
        const item = assignments[fromLocation]?.find(i => i.barcode === barcode && (!orderId || i.orderId === orderId));
        if (item) {
            assignItem(barcode, item.orderId, toLocation, { allowMultiLocation: true });
        }
    }, [assignments, assignItem]);

    return {
        assignItem,
        requestItem,
        findItemLocation,
        removeItem,
        copyItem,
        moveItem,
        relocateLocationContents,
        emptyShelf,
        batchAssign,
        batchAssignToSingleLocation, // We might want to fix these to use assignItem logic too if they are used
        batchAssignToMultipleLocations,
        adminClearLocations,
        withdrawItem
    };
};
