#!/usr/bin/env node
"use strict";
/**
 * list_devices — Lista todos los dispositivos registrados
 */
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
async function listDevices() {
    const db = firebaseAdmin_1.admin.firestore();
    console.log('📱 Listando dispositivos...');
    console.log('='.repeat(80));
    try {
        const devicesSnap = await db.collection('dispositivos').get();
        if (devicesSnap.empty) {
            console.log('No hay dispositivos registrados');
            return { ok: true, devices: [] };
        }
        const devices = [];
        devicesSnap.forEach(doc => {
            const data = doc.data();
            devices.push({
                id: doc.id,
                name: data.name || 'sin nombre',
                type: data.type || 'N/A',
                active: data.active !== false ? 'Sí' : 'No',
                kioskId: data.kioskId || 'N/A',
                assignedShelf: data.assignedShelf || 'N/A',
                excludedCarts: data.excludedCarts || [],
                visualOnly: data.visualOnly || false,
            });
        });
        // Ordenar por nombre
        devices.sort((a, b) => a.name.localeCompare(b.name));
        console.log(`\n✓ Total de dispositivos: ${devices.length}\n`);
        devices.forEach((device, idx) => {
            console.log(`${idx + 1}. ${device.name} (${device.type})`);
            console.log(`   ID: ${device.id}`);
            console.log(`   KioskId: ${device.kioskId}`);
            console.log(`   Estantería: ${device.assignedShelf}`);
            console.log(`   Activo: ${device.active}`);
            if (device.excludedCarts.length > 0) {
                console.log(`   Carros excluidos: [${device.excludedCarts.join(', ')}]`);
            }
            if (device.visualOnly) {
                console.log(`   🔒 Solo visual`);
            }
            console.log();
        });
        return { ok: true, devices };
    }
    catch (err) {
        console.error('❌ Error:', err);
        return { ok: false, error: String(err) };
    }
}
// Ejecutar si es llamado directamente
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
    listDevices()
        .then((result) => {
        process.exit(result.ok ? 0 : 1);
    })
        .catch((err) => {
        console.error('❌ Error fatal:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=list_devices.js.map