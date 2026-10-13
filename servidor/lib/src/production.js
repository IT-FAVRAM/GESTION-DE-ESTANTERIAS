"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productionOperate = void 0;
const functions = require("firebase-functions");
const firebaseAdmin_1 = require("./firebaseAdmin");
const authz_1 = require("./authz");
const normalize = (value) => (value || '').trim().toUpperCase();
/**
 * Parsea un locationId legacy (formato "SHELF-POSITION") en shelfCode y position.
 * Ejemplos: "PRE-E1-01" → { shelfCode: "PRE", position: "E1-01" }
 *           "PRE-001" → { shelfCode: "PRE", position: "001" }
 */
const parseLegacyLocationId = (locationId) => {
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
const resolveShelfPosition = (shelfCode, position, locationId) => {
    if (shelfCode && position) {
        return { shelfCode: normalize(shelfCode), position: position.trim() };
    }
    if (locationId) {
        return parseLegacyLocationId(locationId);
    }
    throw new functions.https.HttpsError('invalid-argument', 'Se requiere shelfCode+position o locationId.');
};
exports.productionOperate = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'auth required');
    const role = (0, authz_1.normalizeRole)(context.auth.token.role || '');
    const uid = context.auth.uid;
    const email = context.auth.token.email || 'unknown';
    const displayName = context.auth.token.name || email;
    const op = data === null || data === void 0 ? void 0 : data.op;
    const payload = (data === null || data === void 0 ? void 0 : data.payload) || {};
    const opId = (data === null || data === void 0 ? void 0 : data.opId) || firebaseAdmin_1.admin.firestore().collection('_ops').doc().id;
    const now = new Date().toISOString();
    const db = firebaseAdmin_1.admin.firestore();
    if (!['ADMIN', 'SUPERADMIN', 'JEFE_SECCION', 'CALIDAD'].includes(role)) {
        throw new functions.https.HttpsError('permission-denied', `Role ${role} cannot perform production operations`);
    }
    // WITHDRAW_TO_WORKING: Quita de shelves/items, añade a workingItems (transacción atómica)
    if (op === 'withdrawToWorking') {
        const { barcode, orderId, itemKey, containerId, presenceId } = payload;
        const { shelfCode, position } = resolveShelfPosition(payload.shelfCode, payload.position, payload.fromLocationId);
        if (!barcode || !orderId) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing barcode or orderId');
        }
        // Validar que el actor pueda operar la estantería
        const actorContext = await (0, authz_1.getUserContext)(context);
        (0, authz_1.assertActorMayOperateShelf)(actorContext, shelfCode);
        const aggregateKey = `${normalize(barcode)}__${normalize(orderId)}`;
        const computedItemKey = itemKey || `${normalize(barcode)}__${normalize(orderId)}${containerId ? `__${normalize(containerId)}` : ''}`;
        const section = (0, authz_1.getWmsSectionForShelf)(shelfCode);
        const locationId = `${shelfCode}-${position}`;
        const locRef = db.collection('shelves').doc(shelfCode).collection('locations').doc(position);
        const aggregateRef = db.collection('itemAggregates').doc(aggregateKey);
        const workingRef = db.collection('workingItems').doc(computedItemKey);
        const historyRef = db.collection('history').doc();
        await db.runTransaction(async (tx) => {
            var _a, _b;
            const [locSnap, aggregateSnap, workingDoc] = await Promise.all([
                tx.get(locRef),
                tx.get(aggregateRef),
                tx.get(workingRef),
            ]);
            if (workingDoc.exists) {
                throw new functions.https.HttpsError('already-exists', 'Item is already in workingItems');
            }
            const locItems = (((_a = locSnap.data()) === null || _a === void 0 ? void 0 : _a.items) || []);
            // Buscar item por presenceId (preferido) o por articleCode+orderFab
            const itemIndex = locItems.findIndex((i) => {
                if (presenceId && i.presenceId)
                    return i.presenceId === presenceId;
                return normalize(i.articleCode) === normalize(barcode) && normalize(i.orderFab) === normalize(orderId);
            });
            if (itemIndex < 0) {
                throw new functions.https.HttpsError('not-found', 'Item not found in shelf location');
            }
            const item = locItems[itemIndex];
            const removedPresenceId = item.presenceId;
            const updatedItems = locItems.filter((_, idx) => idx !== itemIndex);
            // Actualizar ubicación: eliminar item del array
            tx.set(locRef, { position, items: updatedItems, isEmpty: updatedItems.length === 0 }, { merge: true });
            // Desactivar presencia en items/
            if (removedPresenceId) {
                const presenceRef = db.collection('items').doc(removedPresenceId);
                tx.update(presenceRef, { active: false, removedAt: now, removedBy: uid, locationIds: [] });
            }
            // Actualizar aggregate: remover presenceId del array activo
            if (aggregateSnap.exists) {
                const aggregate = aggregateSnap.data();
                const remainingIds = (aggregate.activePresenceIds || []).filter((id) => id !== removedPresenceId);
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
                quantity: (_b = item.quantity) !== null && _b !== void 0 ? _b : 1,
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
            const workingData = workingDoc.data();
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
        const { shelfCode: targetShelfCode, position: targetPosition } = resolveShelfPosition(toShelfCode, toPosition, payload.toLocation);
        if (!itemKey || !barcode || !orderId) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
        }
        // Validar que el actor pueda operar la estantería destino
        const actorContext = await (0, authz_1.getUserContext)(context);
        (0, authz_1.assertActorMayOperateShelf)(actorContext, targetShelfCode);
        const aggregateKey = `${normalize(barcode)}__${normalize(orderId)}`;
        const locationId = `${targetShelfCode}-${targetPosition}`;
        const locRef = db.collection('shelves').doc(targetShelfCode).collection('locations').doc(targetPosition);
        const aggregateRef = db.collection('itemAggregates').doc(aggregateKey);
        const presenceRef = db.collection('items').doc();
        const workingRef = db.collection('workingItems').doc(itemKey);
        const historyRef = db.collection('history').doc();
        await db.runTransaction(async (tx) => {
            var _a;
            const [locSnap, aggregateSnap, workingDoc] = await Promise.all([
                tx.get(locRef),
                tx.get(aggregateRef),
                tx.get(workingRef),
            ]);
            if (!workingDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Item not in workingItems');
            }
            const currentItems = (((_a = locSnap.data()) === null || _a === void 0 ? void 0 : _a.items) || []);
            // Verificar que no exista ya el mismo artículo en la ubicación destino
            const alreadyExists = currentItems.some((i) => normalize(i.articleCode) === normalize(barcode) && normalize(i.orderFab) === normalize(orderId));
            if (alreadyExists) {
                throw new functions.https.HttpsError('already-exists', `El artículo ${barcode} | ${orderId} ya existe en ${locationId}`);
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
                const aggregate = aggregateSnap.data();
                const currentIds = aggregate.activePresenceIds || [];
                tx.set(aggregateRef, {
                    activePresenceIds: [...currentIds, presenceRef.id],
                    totalActivePresences: (aggregate.totalActivePresences || 0) + 1,
                    totalPlacements: (aggregate.totalPlacements || 0) + 1,
                    updatedAt: now,
                }, { merge: true });
            }
            else {
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
//# sourceMappingURL=production.js.map