#!/usr/bin/env node
"use strict";
/**
 * revert_autoplegadora_config — Revierte los cambios hechos al kiosko de autoplegadora
 */
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
async function revertConfig() {
    const db = firebaseAdmin_1.admin.firestore();
    const DEVICE_ID = 'device_1781153902325_5sapp5'; // Kiosko Autoplegadora
    console.log('🔄 Revirtiendo configuración del kiosko de autoplegadora...');
    console.log('='.repeat(60));
    try {
        const deviceDoc = await db.collection('dispositivos').doc(DEVICE_ID).get();
        if (!deviceDoc.exists) {
            console.error(`❌ Dispositivo no encontrado: ${DEVICE_ID}`);
            return { ok: false, error: 'Dispositivo no encontrado' };
        }
        // Eliminar los campos que agregamos
        await db.collection('dispositivos').doc(DEVICE_ID).update({
            excludedCarts: firebaseAdmin_1.admin.firestore.FieldValue.delete(),
            visualOnly: firebaseAdmin_1.admin.firestore.FieldValue.delete(),
            updatedAt: new Date().toISOString(),
        });
        console.log(`✅ Configuración revertida`);
        console.log(`  - Carros excluidos: Eliminados`);
        console.log(`  - Modo visual-only: Eliminado`);
        return { ok: true, deviceId: DEVICE_ID };
    }
    catch (err) {
        console.error('❌ Error:', err);
        return { ok: false, error: String(err) };
    }
}
if (require.main === module) {
    const serviceAccount = require('../../../../serviceAccount.json');
    try {
        if (!firebaseAdmin_1.admin.apps.length) {
            firebaseAdmin_1.admin.initializeApp({
                credential: firebaseAdmin_1.admin.credential.cert(serviceAccount),
                projectId: 'gestion-de-estanterias',
            });
        }
    }
    catch (err) {
        console.warn('Firebase app already initialized, continuing...');
    }
    revertConfig()
        .then((result) => {
        console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
        process.exit(result.ok ? 0 : 1);
    })
        .catch((err) => {
        console.error('❌ Error fatal:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=revert_autoplegadora_config.js.map