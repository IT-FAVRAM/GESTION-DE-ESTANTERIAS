#!/usr/bin/env node
"use strict";
/**
 * fix_kiosks_config — Corrige la configuración de los kiosks SOLDADURA y REPASADO
 */
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
async function fixKiosksConfig() {
    const db = firebaseAdmin_1.admin.firestore();
    const SOLDADURA_ID = 'device_1781522236899_ct4wdd';
    const REPASADO_ID = 'device_1781612490504_ral0ku';
    console.log('🔧 Corrigiendo configuración de kiosks...');
    console.log('='.repeat(60));
    try {
        // ── 1. Configurar KIOSK SOLDADURA ────────────────────────────────
        console.log('\n📱 1. Configurando KIOSK SOLDADURA...');
        const soldaduraUpdates = {
            assignedShelf: 'SOL',
            allowedShelves: ['SOL', 'SXP', 'CS'],
            name: 'Kiosko Soldadura',
            type: 'KIOSK',
            active: true,
            updatedAt: new Date().toISOString(),
        };
        await db.collection('dispositivos').doc(SOLDADURA_ID).set(soldaduraUpdates, { merge: true });
        console.log('   ✅ Soldadura actualizado');
        console.log('      - assignedShelf: SOL');
        console.log('      - allowedShelves: [SOL, SXP, CS]');
        // ── 2. Configurar KIOSK REPASADO ─────────────────────────────────
        console.log('\n📱 2. Configurando KIOSK REPASADO...');
        const repasadoUpdates = {
            assignedShelf: 'REP',
            allowedShelves: ['REP', 'SXP'],
            name: 'Kiosko REPASADO',
            type: 'KIOSK',
            active: true,
            updatedAt: new Date().toISOString(),
        };
        await db.collection('dispositivos').doc(REPASADO_ID).set(repasadoUpdates, { merge: true });
        console.log('   ✅ Repasado actualizado');
        console.log('      - assignedShelf: REP');
        console.log('      - allowedShelves: [REP, SXP]');
        console.log('\n✅ Configuración completada exitosamente');
        return { ok: true };
    }
    catch (err) {
        console.error('❌ Error:', err);
        return { ok: false, error: String(err) };
    }
}
// Ejecutar si es llamado directamente
if (require.main === module) {
    const serviceAccount = require('../../../../../serviceAccount.json');
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
    fixKiosksConfig()
        .then((result) => {
        console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
        process.exit(result.ok ? 0 : 1);
    })
        .catch((err) => {
        console.error('❌ Error fatal:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=fix_kiosks_config.js.map