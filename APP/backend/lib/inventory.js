"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateReproceso = exports.cartOperate = exports.shelfOperate = exports.inventoryOperate = exports.onShelfLocationWrite = exports.onAssignmentWrite = void 0;
const functions = require("firebase-functions");
const firebaseAdmin_1 = require("./firebaseAdmin");
const authz_1 = require("./authz");
const normalize = (value) => (value || '').trim().toUpperCase();
const isSameIdentity = (item, barcode, orderId, itemKey, containerId) => {
    const byKey = normalize(itemKey || (item === null || item === void 0 ? void 0 : item.itemKey));
    if (byKey)
        return normalize(item === null || item === void 0 ? void 0 : item.itemKey) === byKey;
    const barcodeMatch = normalize(item === null || item === void 0 ? void 0 : item.barcode) === normalize(barcode);
    const orderMatch = !orderId || normalize(item === null || item === void 0 ? void 0 : item.orderId) === normalize(orderId);
    const containerMatch = !containerId || normalize(item === null || item === void 0 ? void 0 : item.containerId) === normalize(containerId);
    return barcodeMatch && orderMatch && containerMatch;
};
const samePresence = (item, presenceId, articleCode, orderFab) => {
    if (item === null || item === void 0 ? void 0 : item.presenceId) {
        return item.presenceId === presenceId;
    }
    return normalize(item === null || item === void 0 ? void 0 : item.articleCode) === normalize(articleCode) && normalize(item === null || item === void 0 ? void 0 : item.orderFab) === normalize(orderFab);
};
const sectionForWarehouse = (warehouseId) => (0, authz_1.getWmsSectionForShelf)(warehouseId);
const canOperateWarehouse = (role, section, warehouseId) => {
    if (['ADMIN', 'CARRETILLERO', 'SUPERADMIN', 'CALIDAD'].includes(role))
        return true;
    if (role === 'JEFE_SECCION')
        return !!section && section === sectionForWarehouse(warehouseId);
    return false;
};
exports.onAssignmentWrite = functions.firestore
    .document('assignments/{warehouseId}/locations/{locationId}')
    .onWrite(async (change) => {
    const afterData = change.after.exists ? change.after.data() : null;
    const beforeData = change.before.exists ? change.before.data() : null;
    if (!afterData || !Array.isArray(afterData.items))
        return;
    const afterItems = afterData.items;
    const beforeItems = Array.isArray(beforeData === null || beforeData === void 0 ? void 0 : beforeData.items) ? beforeData.items : [];
    const beforeKeys = new Set(beforeItems.map((item) => `${item.barcode}_${item.orderId}`));
    const newItems = afterItems.filter((item) => !beforeKeys.has(`${item.barcode}_${item.orderId}`));
    if (newItems.length === 0)
        return;
    const ordersToUpdate = new Set();
    newItems.forEach((item) => {
        if (item.orderId && item.orderId !== 'PENDIENTE')
            ordersToUpdate.add(item.orderId);
    });
    await Promise.all(Array.from(ordersToUpdate).map(async (orderId) => {
        try {
            const docRef = firebaseAdmin_1.admin.firestore().collection('inboundOrders').doc(orderId);
            const doc = await docRef.get();
            if (!doc.exists)
                return;
            await docRef.update({
                fecha_disponible_estanteria: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                status: 'DISPONIBLE',
            });
        }
        catch (error) {
            console.error(`Failed to update InboundOrder ${orderId}:`, error);
        }
    }));
});
// Trigger for the new shelfOperate path (shelves/{shelfCode}/locations/{position})
// Updates inboundOrders to DISPONIBLE when articles are placed via shelfOperate.
exports.onShelfLocationWrite = functions.firestore
    .document('shelves/{shelfCode}/locations/{position}')
    .onWrite(async (change) => {
    const afterData = change.after.exists ? change.after.data() : null;
    const beforeData = change.before.exists ? change.before.data() : null;
    if (!afterData || !Array.isArray(afterData.items))
        return;
    const afterItems = afterData.items;
    const beforeItems = Array.isArray(beforeData === null || beforeData === void 0 ? void 0 : beforeData.items) ? beforeData.items : [];
    const beforeKeys = new Set(beforeItems.map((item) => `${item.articleCode}_${item.orderFab}`));
    const newItems = afterItems.filter((item) => !beforeKeys.has(`${item.articleCode}_${item.orderFab}`));
    if (newItems.length === 0)
        return;
    const ordersToUpdate = new Set();
    newItems.forEach((item) => {
        if (item.orderFab && item.orderFab !== 'PENDIENTE')
            ordersToUpdate.add(item.orderFab);
    });
    await Promise.all(Array.from(ordersToUpdate).map(async (orderFab) => {
        try {
            const docRef = firebaseAdmin_1.admin.firestore().collection('inboundOrders').doc(orderFab);
            const doc = await docRef.get();
            if (!doc.exists)
                return;
            await docRef.update({
                fecha_disponible_estanteria: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                status: 'DISPONIBLE',
            });
        }
        catch (error) {
            console.error(`Failed to update InboundOrder ${orderFab}:`, error);
        }
    }));
});
exports.inventoryOperate = functions.https.onCall(async (data, context) => {
    const userCtx = await (0, authz_1.requireAllowedRoles)(context, ['ADMIN', 'SUPERADMIN', 'JEFE_SECCION', 'CARRETILLERO', 'CALIDAD']);
    const uid = userCtx.uid;
    const role = userCtx.role;
    const section = userCtx.section;
    const user = userCtx.email || 'unknown';
    const op = data === null || data === void 0 ? void 0 : data.op;
    const payload = (data === null || data === void 0 ? void 0 : data.payload) || {};
    const opId = (data === null || data === void 0 ? void 0 : data.opId) || firebaseAdmin_1.admin.firestore().collection('_ops').doc().id;
    const now = new Date().toISOString();
    const writeHistory = (tx, entry) => {
        const historyRef = firebaseAdmin_1.admin.firestore().collection('history').doc();
        tx.set(historyRef, Object.assign(Object.assign({}, entry), { id: historyRef.id, timestamp: now, uid, role, user, opId, source: 'inventoryOperate' }));
    };
    if (op === 'emptyShelf') {
        if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
            throw new functions.https.HttpsError('permission-denied', 'Only admin can empty shelves');
        }
        const warehouse = payload === null || payload === void 0 ? void 0 : payload.warehouse;
        const shelf = payload === null || payload === void 0 ? void 0 : payload.shelf;
        if (!warehouse || !shelf)
            throw new functions.https.HttpsError('invalid-argument', 'Missing warehouse/shelf');
        const prefix = `${warehouse}-E${shelf}-`;
        const snapshot = await firebaseAdmin_1.admin.firestore().collection('assignments').doc(warehouse).collection('locations').get();
        const docs = snapshot.docs.filter((doc) => doc.id.startsWith(prefix));
        await firebaseAdmin_1.admin.firestore().runTransaction(async (tx) => {
            var _a;
            for (const doc of docs) {
                const items = (((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.items) || []);
                tx.delete(doc.ref);
                items.forEach((item) => writeHistory(tx, {
                    barcode: item.barcode || '', orderId: item.orderId || '', action: 'removed', fromLocation: doc.id, toLocation: null,
                }));
            }
        });
        return { ok: true, opId, removedLocations: docs.length };
    }
    const barcode = (payload === null || payload === void 0 ? void 0 : payload.barcode) || '';
    const orderId = (payload === null || payload === void 0 ? void 0 : payload.orderId) || '';
    if (op === 'assign') {
        const locationId = payload === null || payload === void 0 ? void 0 : payload.locationId;
        if (!locationId || !barcode || !orderId)
            throw new functions.https.HttpsError('invalid-argument', 'Missing assign payload');
        const warehouseId = locationId.split('-')[0];
        if (!canOperateWarehouse(role, section, warehouseId))
            throw new functions.https.HttpsError('permission-denied', 'Warehouse out of scope');
        const locRef = firebaseAdmin_1.admin.firestore().collection('assignments').doc(warehouseId).collection('locations').doc(locationId);
        await firebaseAdmin_1.admin.firestore().runTransaction(async (tx) => {
            var _a, _b;
            const doc = await tx.get(locRef);
            const items = (((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.items) || []);
            const exists = items.some((item) => isSameIdentity(item, barcode, orderId, payload === null || payload === void 0 ? void 0 : payload.itemKey, payload === null || payload === void 0 ? void 0 : payload.containerId));
            if (exists)
                return;
            tx.set(locRef, {
                items: [...items, { barcode, orderId, timestamp: now, assignedAt: now, movedAt: null, packageType: (payload === null || payload === void 0 ? void 0 : payload.packageType) || null, itemKey: (payload === null || payload === void 0 ? void 0 : payload.itemKey) || null, quantity: (_b = payload === null || payload === void 0 ? void 0 : payload.quantity) !== null && _b !== void 0 ? _b : 1, containerId: (payload === null || payload === void 0 ? void 0 : payload.containerId) || null, notes: (payload === null || payload === void 0 ? void 0 : payload.notes) || null, status: 'UBICADO' }],
                updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            writeHistory(tx, { barcode, orderId, action: 'assigned', fromLocation: null, toLocation: locationId });
        });
        return { ok: true, opId };
    }
    if (op === 'remove') {
        const locationId = payload === null || payload === void 0 ? void 0 : payload.locationId;
        if (!locationId || !barcode)
            throw new functions.https.HttpsError('invalid-argument', 'Missing remove payload');
        const warehouseId = locationId.split('-')[0];
        if (!canOperateWarehouse(role, section, warehouseId))
            throw new functions.https.HttpsError('permission-denied', 'Warehouse out of scope');
        const locRef = firebaseAdmin_1.admin.firestore().collection('assignments').doc(warehouseId).collection('locations').doc(locationId);
        await firebaseAdmin_1.admin.firestore().runTransaction(async (tx) => {
            var _a;
            const doc = await tx.get(locRef);
            if (!doc.exists)
                throw new functions.https.HttpsError('not-found', 'LOCATION_NOT_FOUND');
            const items = (((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.items) || []);
            const idx = items.findIndex((item) => isSameIdentity(item, barcode, orderId, payload === null || payload === void 0 ? void 0 : payload.itemKey, payload === null || payload === void 0 ? void 0 : payload.containerId));
            if (idx < 0)
                throw new functions.https.HttpsError('not-found', 'ITEM_NOT_FOUND');
            const item = items[idx];
            const next = [...items];
            next.splice(idx, 1);
            if (next.length === 0)
                tx.delete(locRef);
            else
                tx.set(locRef, { items: next, updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp() });
            writeHistory(tx, { barcode, orderId: orderId || (item === null || item === void 0 ? void 0 : item.orderId) || '', action: 'removed', fromLocation: locationId, toLocation: null });
        });
        return { ok: true, opId };
    }
    if (op === 'move') {
        const fromLoc = payload === null || payload === void 0 ? void 0 : payload.fromLoc;
        const toLoc = payload === null || payload === void 0 ? void 0 : payload.toLoc;
        if (!fromLoc || !toLoc || !barcode || !orderId)
            throw new functions.https.HttpsError('invalid-argument', 'Missing move payload');
        const fromWh = fromLoc.split('-')[0];
        const toWh = toLoc.split('-')[0];
        if (!canOperateWarehouse(role, section, fromWh) || !canOperateWarehouse(role, section, toWh)) {
            throw new functions.https.HttpsError('permission-denied', 'Warehouse out of scope');
        }
        const fromRef = firebaseAdmin_1.admin.firestore().collection('assignments').doc(fromWh).collection('locations').doc(fromLoc);
        const toRef = firebaseAdmin_1.admin.firestore().collection('assignments').doc(toWh).collection('locations').doc(toLoc);
        await firebaseAdmin_1.admin.firestore().runTransaction(async (tx) => {
            var _a, _b;
            const [fromDoc, toDoc] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
            if (!fromDoc.exists)
                throw new functions.https.HttpsError('not-found', 'SOURCE_NOT_FOUND');
            const fromItems = (((_a = fromDoc.data()) === null || _a === void 0 ? void 0 : _a.items) || []);
            const idx = fromItems.findIndex((item) => isSameIdentity(item, barcode, orderId, payload === null || payload === void 0 ? void 0 : payload.itemKey, payload === null || payload === void 0 ? void 0 : payload.containerId));
            if (idx < 0)
                throw new functions.https.HttpsError('not-found', 'ITEM_NOT_FOUND');
            const item = fromItems[idx];
            const nextSource = [...fromItems];
            nextSource.splice(idx, 1);
            if (nextSource.length === 0)
                tx.delete(fromRef);
            else
                tx.set(fromRef, { items: nextSource, updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp() });
            const toItems = (((_b = toDoc.data()) === null || _b === void 0 ? void 0 : _b.items) || []);
            const existsInTarget = toItems.some((target) => isSameIdentity(target, barcode, orderId, item === null || item === void 0 ? void 0 : item.itemKey, item === null || item === void 0 ? void 0 : item.containerId));
            if (!existsInTarget) {
                tx.set(toRef, { items: [...toItems, Object.assign(Object.assign({}, item), { timestamp: now, movedAt: now })], updatedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp() });
            }
            writeHistory(tx, { barcode, orderId, action: 'relocated', fromLocation: fromLoc, toLocation: toLoc });
        });
        return { ok: true, opId };
    }
    throw new functions.https.HttpsError('invalid-argument', `Unknown op: ${op}`);
});
exports.shelfOperate = functions.https.onCall(async (data, context) => {
    const actor = await (0, authz_1.resolveOperationalActor)(context, data === null || data === void 0 ? void 0 : data.session);
    const op = String((data === null || data === void 0 ? void 0 : data.op) || '');
    const payload = (data === null || data === void 0 ? void 0 : data.payload) || {};
    const shelfCode = normalize((payload === null || payload === void 0 ? void 0 : payload.shelfCode) || actor.assignedShelf);
    const articleCode = String((payload === null || payload === void 0 ? void 0 : payload.articleCode) || '').trim();
    const orderFab = String((payload === null || payload === void 0 ? void 0 : payload.orderFab) || '').trim();
    const operarioId = String((payload === null || payload === void 0 ? void 0 : payload.operarioId) || actor.operarioId || actor.uid).trim();
    const operarioName = String((payload === null || payload === void 0 ? void 0 : payload.operarioName) || actor.operarioName || actor.email || actor.uid).trim();
    const now = new Date().toISOString();
    const db = firebaseAdmin_1.admin.firestore();
    if (!shelfCode) {
        throw new functions.https.HttpsError('invalid-argument', 'shelfCode requerido.');
    }
    (0, authz_1.assertActorMayOperateShelf)(actor, shelfCode);
    const writeHistory = (tx, entry) => {
        const historyRef = db.collection('history').doc();
        tx.set(historyRef, Object.assign(Object.assign({}, entry), { id: historyRef.id, timestamp: now, uid: actor.uid, role: actor.role, user: operarioName, source: 'shelfOperate' }));
    };
    if (op === 'ubicar') {
        const position = String((payload === null || payload === void 0 ? void 0 : payload.position) || '').trim();
        if (!position || !articleCode || !orderFab) {
            throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para ubicar.');
        }
        const locationId = `${shelfCode}-${position}`;
        const aggregateKey = `${normalize(articleCode)}__${normalize(orderFab)}`;
        const locRef = db.collection('shelves').doc(shelfCode).collection('locations').doc(position);
        const presenceRef = db.collection('items').doc();
        const aggregateRef = db.collection('itemAggregates').doc(aggregateKey);
        await db.runTransaction(async (tx) => {
            var _a;
            const [locSnap, aggregateSnap] = await Promise.all([tx.get(locRef), tx.get(aggregateRef)]);
            const currentItems = locSnap.exists ? (((_a = locSnap.data()) === null || _a === void 0 ? void 0 : _a.items) || []) : [];
            tx.set(locRef, {
                position,
                items: [...currentItems, { presenceId: presenceRef.id, articleCode, orderFab, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now }],
                isEmpty: false,
            }, { merge: true });
            tx.set(presenceRef, { presenceId: presenceRef.id, aggregateKey, articleCode, orderFab, locationIds: [locationId], shelfCode, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now, active: true });
            if (aggregateSnap.exists) {
                const aggregate = aggregateSnap.data();
                const currentIds = aggregate.activePresenceIds || [];
                if (currentIds.length >= 500) {
                    throw new functions.https.HttpsError('resource-exhausted', `El agregado ${aggregateKey} ha alcanzado el limite de 500 presencias activas simultaneas.`);
                }
                tx.set(aggregateRef, { activePresenceIds: [...currentIds, presenceRef.id], totalActivePresences: (aggregate.totalActivePresences || 0) + 1, totalPlacements: (aggregate.totalPlacements || 0) + 1, updatedAt: now }, { merge: true });
            }
            else {
                tx.set(aggregateRef, { aggregateKey, articleCode, orderFab, activePresenceIds: [presenceRef.id], totalActivePresences: 1, totalPlacements: 1, updatedAt: now });
            }
            writeHistory(tx, { action: 'UBICAR', articleCode, orderFab, fromLocation: null, toLocation: locationId, shelfCode, operarioId, operarioName });
        });
        console.log(`[shelfOperate] ubicar SUCCESS: ${articleCode} ${orderFab} → ${shelfCode}-${position}`);
        // Comprobar si el articulo esta en otras estanterias (aviso informativo)
        let warning = null;
        try {
            const otherPresences = await db.collection('items')
                .where('aggregateKey', '==', aggregateKey)
                .where('active', '==', true)
                .limit(10)
                .get();
            const otherShelves = [...new Set(otherPresences.docs
                    .map(d => d.data().shelfCode)
                    .filter(sc => sc && sc !== shelfCode))];
            if (otherShelves.length > 0) {
                warning = `Este articulo tambien esta en: ${otherShelves.join(', ')}`;
            }
        }
        catch ( /* non-critical */_a) { /* non-critical */ }
        return { ok: true, warning };
    }
    if (op === 'ubicarMulti') {
        const rawPositions = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.positions) ? payload.positions : [];
        const positions = rawPositions.map((value) => String(value).trim()).filter(Boolean);
        const importe = payload === null || payload === void 0 ? void 0 : payload.importe;
        const cantidad = payload === null || payload === void 0 ? void 0 : payload.cantidad;
        if (!articleCode || !orderFab || positions.length === 0) {
            throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para ubicar múltiple.');
        }
        const db2 = firebaseAdmin_1.admin.firestore();
        const results = [];
        await db2.runTransaction(async (tx) => {
            var _a;
            const aggregateKey = `${normalize(articleCode)}__${normalize(orderFab)}`;
            const aggregateRef = db2.collection('itemAggregates').doc(aggregateKey);
            // Pre-build all refs and pre-read all docs before any writes
            const locRefs = positions.map((pos) => db2.collection('shelves').doc(shelfCode).collection('locations').doc(pos));
            const presenceRefs = positions.map(() => db2.collection('items').doc());
            const [aggregateSnap, ...locSnaps] = await Promise.all([
                tx.get(aggregateRef),
                ...locRefs.map((ref) => tx.get(ref)),
            ]);
            let totalPresencesAdded = 0;
            const presenceIdsToAdd = [];
            for (let i = 0; i < positions.length; i++) {
                const position = positions[i];
                const locationId = `${shelfCode}-${position}`;
                const locRef = locRefs[i];
                const locSnap = locSnaps[i];
                const presenceRef = presenceRefs[i];
                const currentItems = locSnap.exists ? (((_a = locSnap.data()) === null || _a === void 0 ? void 0 : _a.items) || []) : [];
                const locationItem = { presenceId: presenceRef.id, articleCode, orderFab, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now };
                if (importe !== undefined)
                    locationItem.unitCost = importe;
                if (cantidad !== undefined)
                    locationItem.quantity = cantidad;
                tx.set(locRef, {
                    position,
                    items: [...currentItems, locationItem],
                    isEmpty: false,
                }, { merge: true });
                const presenceDoc = { presenceId: presenceRef.id, aggregateKey, articleCode, orderFab, locationIds: [locationId], shelfCode, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now, active: true };
                if (importe !== undefined)
                    presenceDoc.unitCost = importe;
                if (cantidad !== undefined)
                    presenceDoc.quantity = cantidad;
                tx.set(presenceRef, presenceDoc);
                totalPresencesAdded++;
                presenceIdsToAdd.push(presenceRef.id);
                results.push(locationId);
            }
            if (aggregateSnap.exists) {
                const aggregate = aggregateSnap.data();
                const currentIds = aggregate.activePresenceIds || [];
                const totalActive = (currentIds.length + totalPresencesAdded);
                if (totalActive > 500) {
                    throw new functions.https.HttpsError('resource-exhausted', `El agregado ${aggregateKey} ha alcanzado el limite de 500 presencias activas simultaneas.`);
                }
                tx.set(aggregateRef, { activePresenceIds: [...currentIds, ...presenceIdsToAdd], totalActivePresences: (aggregate.totalActivePresences || 0) + totalPresencesAdded, totalPlacements: (aggregate.totalPlacements || 0) + totalPresencesAdded, updatedAt: now }, { merge: true });
            }
            else {
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
        const presenceSnapshot = await db.collection('items')
            .where('aggregateKey', '==', aggregateKey)
            .where('active', '==', true)
            .where('shelfCode', '==', shelfCode)
            .get();
        const activePresences = presenceSnapshot.docs.map((snap) => ({ ref: snap.ref, data: snap.data() }));
        if (activePresences.length === 0) {
            throw new functions.https.HttpsError('not-found', 'Articulo no encontrado.');
        }
        const positions = [];
        await db.runTransaction(async (tx) => {
            // Pre-compute all location refs from presence data
            const presenceLocData = activePresences.map((presence) => {
                var _a;
                const locationId = String(((_a = presence.data.locationIds) === null || _a === void 0 ? void 0 : _a[0]) || '');
                const position = locationId.split('-').slice(1).join('-');
                const locRef = db.collection('shelves').doc(shelfCode).collection('locations').doc(position);
                return { presence, position, locRef };
            });
            // All reads before any writes
            const [aggregateSnap, ...locSnaps] = await Promise.all([
                tx.get(aggregateRef),
                ...presenceLocData.map(({ locRef }) => tx.get(locRef)),
            ]);
            const aggregate = aggregateSnap.exists ? aggregateSnap.data() : null;
            const removedPresenceIds = [];
            for (let i = 0; i < presenceLocData.length; i++) {
                const { presence, position, locRef } = presenceLocData[i];
                const locSnap = locSnaps[i];
                positions.push(position);
                if (locSnap.exists) {
                    const locData = locSnap.data();
                    const updatedItems = (locData.items || []).filter((item) => !samePresence(item, presence.data.presenceId, articleCode, orderFab));
                    tx.set(locRef, { position, items: updatedItems, isEmpty: updatedItems.length === 0 }, { merge: true });
                }
                tx.update(presence.ref, { active: false, removedAt: now, removedBy: operarioId, locationIds: [] });
                removedPresenceIds.push(presence.ref.id);
            }
            if (aggregate) {
                const remainingPresenceIds = (aggregate.activePresenceIds || []).filter((id) => !removedPresenceIds.includes(id));
                tx.set(aggregateRef, { activePresenceIds: remainingPresenceIds, totalActivePresences: remainingPresenceIds.length, totalPlacements: aggregate.totalPlacements, updatedAt: now }, { merge: true });
            }
            writeHistory(tx, { action: 'RETIRAR', articleCode, orderFab, fromLocation: positions.map((position) => `${shelfCode}-${position}`).join(', '), toLocation: null, shelfCode, operarioId, operarioName });
        });
        console.log(`[shelfOperate] retirar SUCCESS: ${articleCode} ${orderFab} from ${shelfCode}, positions: ${positions.join(', ')}`);
        return { ok: true, positions };
    }
    if (op === 'retirarDeUbicacion') {
        const position = String((payload === null || payload === void 0 ? void 0 : payload.position) || '').trim();
        if (!articleCode || !orderFab || !position) {
            throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para retirar de ubicacion.');
        }
        const locRef = db.collection('shelves').doc(shelfCode).collection('locations').doc(position);
        const aggregateKey = `${normalize(articleCode)}__${normalize(orderFab)}`;
        const aggregateRef = db.collection('itemAggregates').doc(aggregateKey);
        await db.runTransaction(async (tx) => {
            // All reads must come before writes in a Firestore transaction
            const [locSnap, aggregateSnap] = await Promise.all([tx.get(locRef), tx.get(aggregateRef)]);
            if (!locSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Ubicacion no encontrada.');
            }
            const locData = locSnap.data();
            const items = locData.items || [];
            const itemIndex = items.findIndex((i) => normalize(i.articleCode) === normalize(articleCode) &&
                normalize(i.orderFab) === normalize(orderFab));
            if (itemIndex === -1) {
                throw new functions.https.HttpsError('not-found', 'Articulo no encontrado en esta ubicacion.');
            }
            const removedItem = items[itemIndex];
            const presenceId = removedItem.presenceId;
            const newItems = items.filter((_, idx) => idx !== itemIndex);
            // Writes after all reads
            tx.set(locRef, { position, items: newItems, isEmpty: newItems.length === 0 }, { merge: true });
            if (presenceId) {
                const presenceRef = db.collection('items').doc(presenceId);
                tx.update(presenceRef, { active: false, removedAt: now, removedBy: operarioId, locationIds: [] });
            }
            if (aggregateSnap.exists) {
                const aggregate = aggregateSnap.data();
                const newActiveIds = (aggregate.activePresenceIds || []).filter((id) => id !== presenceId);
                tx.set(aggregateRef, { activePresenceIds: newActiveIds, totalActivePresences: newActiveIds.length, totalPlacements: aggregate.totalPlacements, updatedAt: now }, { merge: true });
            }
            writeHistory(tx, { action: 'RETIRAR_DE_UBICACION', articleCode, orderFab, fromLocation: `${shelfCode}-${position}`, toLocation: null, shelfCode, operarioId, operarioName });
        });
        console.log(`[shelfOperate] retirarDeUbicacion SUCCESS: ${articleCode} ${orderFab} from ${shelfCode}-${position}`);
        return { ok: true, positions: [position] };
    }
    if (op === 'mover') {
        const rawPositions = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.newPositions) ? payload.newPositions : [];
        const newPositions = rawPositions.map((value) => String(value).trim()).filter(Boolean);
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
        const activePresences = presenceSnapshot.docs.map((snap) => ({ ref: snap.ref, data: snap.data() }));
        if (activePresences.length === 0 || activePresences.length !== newPositions.length) {
            throw new functions.https.HttpsError('failed-precondition', 'Las presencias activas no coinciden con los destinos.');
        }
        await db.runTransaction(async (tx) => {
            var _a;
            // Pre-compute all old and new location refs
            const oldLocData = activePresences.map((presence) => {
                var _a;
                const locationId = String(((_a = presence.data.locationIds) === null || _a === void 0 ? void 0 : _a[0]) || '');
                const position = locationId.split('-').slice(1).join('-');
                const locRef = db.collection('shelves').doc(shelfCode).collection('locations').doc(position);
                return { presence, locationId, position, locRef };
            });
            const newLocData = newPositions.map((position, index) => ({
                position,
                locationId: `${shelfCode}-${position}`,
                locRef: db.collection('shelves').doc(shelfCode).collection('locations').doc(position),
                presence: activePresences[index],
            }));
            // Deduplicate refs by path, then read all in one pass before any writes
            const refByPath = new Map();
            refByPath.set(aggregateRef.path, aggregateRef);
            for (const d of oldLocData)
                refByPath.set(d.locRef.path, d.locRef);
            for (const d of newLocData)
                refByPath.set(d.locRef.path, d.locRef);
            const refEntries = [...refByPath.entries()];
            const allSnaps = await Promise.all(refEntries.map(([, ref]) => tx.get(ref)));
            const snapByPath = new Map();
            for (let i = 0; i < refEntries.length; i++)
                snapByPath.set(refEntries[i][0], allSnaps[i]);
            const aggregateSnap = snapByPath.get(aggregateRef.path);
            const oldLocationIds = [];
            const newLocationIds = [];
            // Remove article from old positions
            for (const { presence, locationId, position, locRef } of oldLocData) {
                oldLocationIds.push(locationId);
                const locSnap = snapByPath.get(locRef.path);
                if (locSnap === null || locSnap === void 0 ? void 0 : locSnap.exists) {
                    const locData = locSnap.data();
                    const updatedItems = (locData.items || []).filter((item) => !samePresence(item, presence.data.presenceId, articleCode, orderFab));
                    tx.set(locRef, { position, items: updatedItems, isEmpty: updatedItems.length === 0 }, { merge: true });
                }
            }
            // Add article to new positions
            for (const { position, locationId, locRef, presence } of newLocData) {
                newLocationIds.push(locationId);
                const locSnap = snapByPath.get(locRef.path);
                const currentItems = (locSnap === null || locSnap === void 0 ? void 0 : locSnap.exists) ? (((_a = locSnap.data()) === null || _a === void 0 ? void 0 : _a.items) || []) : [];
                tx.set(locRef, { position, items: [...currentItems, { presenceId: presence.data.presenceId, articleCode, orderFab, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now }], isEmpty: false }, { merge: true });
                tx.update(presence.ref, { locationIds: [locationId], shelfCode, locatedBy: operarioId, locatedByName: operarioName, locatedAt: now });
            }
            if (aggregateSnap === null || aggregateSnap === void 0 ? void 0 : aggregateSnap.exists) {
                tx.set(aggregateRef, { updatedAt: now }, { merge: true });
            }
            writeHistory(tx, { action: 'MOVER', articleCode, orderFab, fromLocation: oldLocationIds.join(', '), toLocation: newLocationIds.join(', '), shelfCode, operarioId, operarioName });
        });
        console.log(`[shelfOperate] mover SUCCESS: ${articleCode} ${orderFab} → ${newPositions.join(', ')} (en ${shelfCode})`);
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
        const presenceSnapshot = await db.collection('items')
            .where('aggregateKey', '==', aggregateKey)
            .where('active', '==', true)
            .where('shelfCode', '==', shelfCode)
            .get();
        if (presenceSnapshot.empty) {
            throw new functions.https.HttpsError('not-found', 'Articulo no encontrado en esta estanteria.');
        }
        const removedFromLocations = [];
        await db.runTransaction(async (tx) => {
            const aggregateRef = db.collection('itemAggregates').doc(aggregateKey);
            // Pre-compute all location refs from presence data
            const presLocData = presenceSnapshot.docs.map((presSnap) => {
                var _a;
                const presData = presSnap.data();
                const locId = String(((_a = presData.locationIds) === null || _a === void 0 ? void 0 : _a[0]) || '');
                const parts = locId.split('-');
                const sc = parts[0] || '';
                const pos = parts.slice(1).join('-');
                const locRef = sc && pos ? db.collection('shelves').doc(sc).collection('locations').doc(pos) : null;
                return { presSnap, presData, locId, pos, locRef };
            });
            // All reads before any writes: aggregate + all location docs
            const validLocData = presLocData.filter(({ locRef }) => locRef !== null);
            const [aggregateSnap, ...locSnaps] = await Promise.all([
                tx.get(aggregateRef),
                ...validLocData.map(({ locRef }) => tx.get(locRef)),
            ]);
            const locSnapByPath = new Map();
            for (let i = 0; i < validLocData.length; i++) {
                locSnapByPath.set(validLocData[i].locRef.path, locSnaps[i]);
            }
            // All writes
            for (const { presSnap, presData, locId, pos, locRef } of presLocData) {
                if (locRef) {
                    const locSnap = locSnapByPath.get(locRef.path);
                    if (locSnap === null || locSnap === void 0 ? void 0 : locSnap.exists) {
                        const locData = locSnap.data();
                        const updatedItems = (locData.items || []).filter((item) => !samePresence(item, presData.presenceId, articleCode, orderFab));
                        tx.set(locRef, { position: pos, items: updatedItems, isEmpty: updatedItems.length === 0 }, { merge: true });
                    }
                    removedFromLocations.push(locId);
                }
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
        return { ok: true, removedFrom: presenceSnapshot.size, locations: removedFromLocations };
    }
    if (op === 'emptyShelf') {
        if (!['ADMIN', 'SUPERADMIN'].includes(actor.role)) {
            throw new functions.https.HttpsError('permission-denied', 'Solo admin puede vaciar estanterias.');
        }
        const snapshot = await db
            .collection('shelves').doc(shelfCode)
            .collection('locations').get();
        const CHUNK = 30;
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += CHUNK) {
            const batchWrite = db.batch();
            docs.slice(i, i + CHUNK).forEach((d) => batchWrite.delete(d.ref));
            await batchWrite.commit();
        }
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
        return { ok: true, deleted: docs.length };
    }
    throw new functions.https.HttpsError('invalid-argument', `Operacion desconocida: ${op}`);
});
exports.cartOperate = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    const actor = await (0, authz_1.resolveOperationalActor)(context, data === null || data === void 0 ? void 0 : data.session);
    if (!['CARRETILLERO', 'ADMIN', 'SUPERADMIN'].includes(actor.role)) {
        throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para editar carros.');
    }
    const cartCode = String(((_a = data === null || data === void 0 ? void 0 : data.payload) === null || _a === void 0 ? void 0 : _a.cartCode) || '').trim().toUpperCase();
    const position = String(((_b = data === null || data === void 0 ? void 0 : data.payload) === null || _b === void 0 ? void 0 : _b.position) || '').trim();
    const description = String(((_c = data === null || data === void 0 ? void 0 : data.payload) === null || _c === void 0 ? void 0 : _c.description) || '').trim();
    if (!cartCode || !position) {
        throw new functions.https.HttpsError('invalid-argument', 'cartCode y position son obligatorios.');
    }
    const now = new Date().toISOString();
    const locRef = firebaseAdmin_1.admin.firestore().collection('shelves').doc(cartCode).collection('locations').doc(position);
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
    }
    else {
        await locRef.set({
            position,
            items: [],
            isEmpty: true,
        }, { merge: true });
    }
    await firebaseAdmin_1.admin.firestore().collection('history').add({
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
exports.updateReproceso = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f;
    const actor = await (0, authz_1.resolveOperationalActor)(context, data === null || data === void 0 ? void 0 : data.session);
    if (!['CALIDAD', 'ADMIN', 'SUPERADMIN'].includes(actor.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Sin permisos para editar reprocesos.');
    }
    const position = String(((_a = data === null || data === void 0 ? void 0 : data.payload) === null || _a === void 0 ? void 0 : _a.position) || '').trim();
    const presenceId = String(((_b = data === null || data === void 0 ? void 0 : data.payload) === null || _b === void 0 ? void 0 : _b.presenceId) || '').trim();
    const articleCode = String(((_c = data === null || data === void 0 ? void 0 : data.payload) === null || _c === void 0 ? void 0 : _c.articleCode) || '').trim();
    const orderFab = String(((_d = data === null || data === void 0 ? void 0 : data.payload) === null || _d === void 0 ? void 0 : _d.orderFab) || '').trim();
    const quantity = Number((_e = data === null || data === void 0 ? void 0 : data.payload) === null || _e === void 0 ? void 0 : _e.quantity) || 0;
    const unitCost = Number((_f = data === null || data === void 0 ? void 0 : data.payload) === null || _f === void 0 ? void 0 : _f.unitCost) || 0;
    const posNum = parseInt(position, 10);
    if (isNaN(posNum) || posNum < 1 || posNum > 22) {
        throw new functions.https.HttpsError('invalid-argument', 'Solo se pueden editar reprocesos en CAL 001-022.');
    }
    const db = firebaseAdmin_1.admin.firestore();
    const locRef = db.collection('shelves').doc('CAL').collection('locations').doc(position);
    await db.runTransaction(async (tx) => {
        const locSnap = await tx.get(locRef);
        const locData = locSnap.exists ? locSnap.data() : { position, items: [], isEmpty: true };
        let found = false;
        const items = (locData.items || []).map((item) => {
            var _a, _b;
            const matchByPresence = presenceId && item.presenceId === presenceId;
            const matchByCode = !presenceId
                && ((_a = item.articleCode) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === articleCode.toUpperCase()
                && ((_b = item.orderFab) === null || _b === void 0 ? void 0 : _b.toUpperCase()) === orderFab.toUpperCase();
            if (matchByPresence || matchByCode) {
                found = true;
                return Object.assign(Object.assign({}, item), { quantity, unitCost });
            }
            return item;
        });
        if (!found && articleCode && orderFab) {
            items.push({
                presenceId: `repro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                articleCode,
                orderFab,
                quantity,
                unitCost,
                locatedBy: actor.operarioId || actor.uid || actor.role,
                locatedByName: actor.operarioName || actor.email || actor.role,
                locatedAt: new Date().toISOString(),
            });
        }
        tx.set(locRef, {
            position,
            isEmpty: items.length === 0,
            items,
        }, { merge: true });
    });
    return { ok: true };
});
//# sourceMappingURL=inventory.js.map