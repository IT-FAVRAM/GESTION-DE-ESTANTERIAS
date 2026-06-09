"use strict";
/**
 * Cloud Function: Migra PRE → PME
 * Endpoint: /migratPreToPme
 *
 * URGENTE: Los datos están en shelves/PRE pero el frontend busca en shelves/PME
 * Esto debe ejecutarse UNA SOLA VEZ para copiar los datos.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.migratPreToPme = void 0;
const functions = require("firebase-functions");
const firebaseAdmin_1 = require("../firebaseAdmin");
const db = firebaseAdmin_1.admin.firestore();
exports.migratPreToPme = functions.https.onCall(async (data, context) => {
    // Verificar que el usuario es admin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Debes estar autenticado');
    }
    const operarioId = context.auth.uid;
    console.log(`[MigratPreToPme] Iniciado por operario: ${operarioId}`);
    try {
        // 1. Obtener documento PRE
        const preRef = db.collection('shelves').doc('PRE');
        const preDoc = await preRef.get();
        if (!preDoc.exists) {
            return {
                success: false,
                error: 'No se encontró shelves/PRE',
            };
        }
        console.log('[MigratPreToPme] PRE encontrado, iniciando migración...');
        const preData = preDoc.data();
        // 2. Crear PME con datos de PRE
        const pmeData = Object.assign(Object.assign({}, preData), { code: 'PME', name: 'Prensas - Mecanizado', updatedAt: new Date(), migratedFrom: 'PRE', migrationDate: new Date().toISOString() });
        await db.collection('shelves').doc('PME').set(pmeData);
        console.log('[MigratPreToPme] PME creado');
        // 3. Copiar todas las locations
        const locationsSnapshot = await db
            .collection('shelves')
            .doc('PRE')
            .collection('locations')
            .get();
        let locationCount = 0;
        let itemCount = 0;
        for (const locDoc of locationsSnapshot.docs) {
            const locId = locDoc.id;
            const locData = locDoc.data();
            // Copiar location
            await db
                .collection('shelves')
                .doc('PME')
                .collection('locations')
                .doc(locId)
                .set(locData);
            locationCount++;
            // Copiar items de esta location
            const itemsSnapshot = await locDoc.ref.collection('items').get();
            for (const itemDoc of itemsSnapshot.docs) {
                const itemId = itemDoc.id;
                const itemData = itemDoc.data();
                await db
                    .collection('shelves')
                    .doc('PME')
                    .collection('locations')
                    .doc(locId)
                    .collection('items')
                    .doc(itemId)
                    .set(itemData);
                itemCount++;
            }
        }
        console.log(`[MigratPreToPme] Migración completada: ${locationCount} locations, ${itemCount} items`);
        return {
            success: true,
            message: `Migración completada: ${locationCount} locations y ${itemCount} items`,
            locationCount,
            itemCount,
        };
    }
    catch (error) {
        console.error('[MigratPreToPme] Error:', error);
        return {
            success: false,
            error: `Error durante la migración: ${error}`,
        };
    }
});
//# sourceMappingURL=migratePreToPme.js.map