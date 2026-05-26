"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productionOperate = void 0;
const functions = require("firebase-functions");
const firebaseAdmin_1 = require("./firebaseAdmin");
const authz_1 = require("./authz");
const isSameIdentity = (item, barcode, orderId, itemKey, containerId) => {
    const normalize = (value) => (value || '').trim().toUpperCase();
    const byKey = normalize(itemKey || (item === null || item === void 0 ? void 0 : item.itemKey));
    if (byKey)
        return normalize(item === null || item === void 0 ? void 0 : item.itemKey) === byKey;
    const barcodeMatch = normalize(item === null || item === void 0 ? void 0 : item.barcode) === normalize(barcode);
    const orderMatch = !orderId || normalize(item === null || item === void 0 ? void 0 : item.orderId) === normalize(orderId);
    const containerMatch = !containerId || normalize(item === null || item === void 0 ? void 0 : item.containerId) === normalize(containerId);
    return barcodeMatch && orderMatch && containerMatch;
};
const getSectionFromLocation = (locationId) => {
    const parts = locationId.split('-');
    const warehouse = parts[0];
    if (warehouse === 'MEC')
        return 'MECANIZADO';
    if (warehouse === 'PLE')
        return 'PLEGADORA';
    if (warehouse === 'RPL')
        return 'ROBOT_PLEGADO';
    if (['SOL', 'RSO', 'SXP'].includes(warehouse))
        return 'SOLDADURA';
    if (['REP', 'ZIN'].includes(warehouse))
        return 'REPASADO';
    if (warehouse === 'PIN')
        return 'PINTURA';
    return 'OTROS';
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
    if (!['ADMIN', 'SUPERADMIN', 'JEFE_SECCION', 'CALIDAD'].includes(role)) {
        throw new functions.https.HttpsError('permission-denied', `Role ${role} cannot perform production operations`);
    }
    // WITHDRAW_TO_WORKING: Quita de assignments, añade a workingItems (transacción atómica)
    if (op === 'withdrawToWorking') {
        const { barcode, orderId, fromLocationId, itemKey, containerId } = payload;
        if (!barcode || !orderId || !fromLocationId) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing barcode, orderId, or fromLocationId');
        }
        const computedItemKey = itemKey || `${barcode.trim().toUpperCase()}__${orderId.trim().toUpperCase()}${containerId ? `__${containerId.trim().toUpperCase()}` : ''}`;
        const section = getSectionFromLocation(fromLocationId);
        const warehouse = fromLocationId.split('-')[0];
        const sourceRef = firebaseAdmin_1.admin.firestore().collection('assignments').doc(warehouse).collection('locations').doc(fromLocationId);
        const workingRef = firebaseAdmin_1.admin.firestore().collection('workingItems').doc(computedItemKey);
        const historyRef = firebaseAdmin_1.admin.firestore().collection('history').doc();
        await firebaseAdmin_1.admin.firestore().runTransaction(async (tx) => {
            var _a;
            const [sourceDoc, workingDoc] = await Promise.all([tx.get(sourceRef), tx.get(workingRef)]);
            if (workingDoc.exists) {
                throw new functions.https.HttpsError('already-exists', 'Item is already in workingItems');
            }
            const sourceItems = (((_a = sourceDoc.data()) === null || _a === void 0 ? void 0 : _a.items) || []);
            const itemIndex = sourceItems.findIndex((i) => isSameIdentity(i, barcode, orderId, itemKey, containerId));
            if (itemIndex < 0) {
                throw new functions.https.HttpsError('not-found', 'Item not found in location');
            }
            const item = sourceItems[itemIndex];
            const updatedItems = sourceItems.filter((_, idx) => idx !== itemIndex);
            if (updatedItems.length === 0) {
                tx.delete(sourceRef);
            }
            else {
                tx.set(sourceRef, { items: updatedItems, updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
            const workingItem = Object.assign(Object.assign({}, item), { status: 'EN_TRABAJO', section,
                fromLocationId, withdrawnAt: now, withdrawnBy: displayName, itemKey: computedItemKey, assignedAt: item.assignedAt || now });
            tx.set(workingRef, workingItem, { merge: true });
            tx.set(historyRef, {
                id: historyRef.id,
                barcode,
                orderId,
                action: 'moved_to_working',
                fromLocation: fromLocationId,
                toLocation: 'EN_TRABAJO',
                timestamp: now,
                uid,
                role,
                user: displayName,
                opId,
                source: 'productionOperate',
            });
        });
        return { ok: true, opId, itemKey: computedItemKey };
    }
    // FINISH_WORKING: Quita de workingItems, añade a finishedItems
    if (op === 'finishWorking') {
        const { itemKey, barcode, orderId, packageType } = payload;
        if (!itemKey || !barcode || !orderId) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing itemKey, barcode, or orderId');
        }
        const workingRef = firebaseAdmin_1.admin.firestore().collection('workingItems').doc(itemKey);
        const finishedRef = firebaseAdmin_1.admin.firestore().collection('finishedItems').doc(itemKey);
        const historyRef = firebaseAdmin_1.admin.firestore().collection('history').doc();
        await firebaseAdmin_1.admin.firestore().runTransaction(async (tx) => {
            const workingDoc = await tx.get(workingRef);
            if (!workingDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Item not in workingItems');
            }
            const finishedItem = {
                id: itemKey,
                barcode,
                orderId,
                timestamp: now,
                finishedAt: now,
                finishedBy: displayName,
                status: 'FINALIZADO',
                previousStatus: 'EN_TRABAJO',
                packageType: packageType || null,
            };
            tx.set(finishedRef, finishedItem);
            tx.delete(workingRef);
            tx.set(historyRef, {
                id: historyRef.id,
                barcode,
                orderId,
                action: 'process_finished',
                fromLocation: 'EN_TRABAJO',
                toLocation: 'FINALIZADO',
                timestamp: now,
                uid,
                role,
                user: displayName,
                opId,
                source: 'productionOperate',
            });
        });
        return { ok: true, opId, itemKey };
    }
    // LOCATE_WORKING: Quita de workingItems, añade a assignments
    if (op === 'locateWorking') {
        const { itemKey, barcode, orderId, toLocation, packageType, quantity, containerId, notes } = payload;
        if (!itemKey || !barcode || !orderId || !toLocation) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
        }
        const toWarehouse = toLocation.split('-')[0];
        const targetRef = firebaseAdmin_1.admin.firestore().collection('assignments').doc(toWarehouse).collection('locations').doc(toLocation);
        const workingRef = firebaseAdmin_1.admin.firestore().collection('workingItems').doc(itemKey);
        const historyRef = firebaseAdmin_1.admin.firestore().collection('history').doc();
        await firebaseAdmin_1.admin.firestore().runTransaction(async (tx) => {
            var _a;
            const [targetDoc, workingDoc] = await Promise.all([tx.get(targetRef), tx.get(workingRef)]);
            if (!workingDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Item not in workingItems');
            }
            const currentItems = (((_a = targetDoc.data()) === null || _a === void 0 ? void 0 : _a.items) || []);
            const alreadyExists = currentItems.some((i) => i.barcode === barcode && i.orderId === orderId);
            if (!alreadyExists) {
                const assignedItem = {
                    barcode,
                    orderId,
                    timestamp: now,
                    assignedAt: workingDoc.data().assignedAt || now,
                    movedAt: now,
                    packageType: packageType || null,
                    itemKey,
                    quantity: quantity !== null && quantity !== void 0 ? quantity : 1,
                    containerId: containerId || null,
                    notes: notes || null,
                    status: 'UBICADO',
                };
                tx.set(targetRef, { items: [...currentItems, assignedItem], updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
            tx.delete(workingRef);
            tx.set(historyRef, {
                id: historyRef.id,
                barcode,
                orderId,
                action: 'relocated',
                fromLocation: 'EN_TRABAJO',
                toLocation,
                timestamp: now,
                uid,
                role,
                user: displayName,
                opId,
                source: 'productionOperate',
            });
        });
        return { ok: true, opId, itemKey };
    }
    throw new functions.https.HttpsError('invalid-argument', `Unknown operation: ${op}`);
});
//# sourceMappingURL=production.js.map