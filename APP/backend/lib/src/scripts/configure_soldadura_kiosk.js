#!/usr/bin/env node
"use strict";
/**
 * configure_soldadura_kiosk — Configura el kiosko de Soldadura
 *
 * Estanterías accesibles:
 *  - SOL: Soldadura (estantería principal)
 *  - SXP: Soldadura Puntos
 *  - CS: Carro Soldadura (robot de soldadura)
 *
 * Uso (desde APP/backend):
 *   npm run build && node lib/scripts/configure_soldadura_kiosk.js
 */
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
async function configureSoldaduraKiosk() {
    const db = firebaseAdmin_1.admin.firestore();
    const DEVICE_ID = 'device_1781522236899_ct4wdd'; // Kiosko Soldadura
    const ALLOWED_SHELVES = ['SOL', 'SXP', 'CS']; // Soldadura, Puntos, Carro Soldadura
    console.log('🔧 Configurando kiosko de Soldadura...');
    console.log('='.repeat(60));
    try {
        // ── 1. Verificar si el dispositivo existe ─────────────────────────────
        console.log(`\n📱 Buscando dispositivo: ${DEVICE_ID}`);
        const deviceDoc = await db.collection('dispositivos').doc(DEVICE_ID).get();
        if (!deviceDoc.exists) {
            console.error(`❌ Dispositivo no encontrado: ${DEVICE_ID}`);
            return { ok: false, error: 'Dispositivo no encontrado' };
        }
        const device = deviceDoc.data();
        console.log(`✓ Encontrado: ${device.name || 'sin nombre'}`);
        console.log(`  - Tipo: ${device.type || 'N/A'}`);
        console.log(`  - Estantería actual: ${device.assignedShelf || 'N/A'}`);
        // ── 2. Actualizar el dispositivo ──────────────────────────────────────
        console.log(`\n⚙️ Actualizando configuración...`);
        const updates = {
            assignedShelf: 'SOL',
            allowedShelves: ALLOWED_SHELVES,
            updatedAt: new Date().toISOString(),
        };
        await db.collection('dispositivos').doc(DEVICE_ID).update(updates);
        console.log(`✅ Dispositivo actualizado:`);
        console.log(`  - Estantería principal: SOL`);
        console.log(`  - Estanterías permitidas: [${ALLOWED_SHELVES.join(', ')}]`);
        return {
            ok: true,
            deviceId: DEVICE_ID,
            updates,
        };
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
    configureSoldaduraKiosk()
        .then((result) => {
        console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
        process.exit(result.ok ? 0 : 1);
    })
        .catch((err) => {
        console.error('❌ Error fatal:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=configure_soldadura_kiosk.js.map