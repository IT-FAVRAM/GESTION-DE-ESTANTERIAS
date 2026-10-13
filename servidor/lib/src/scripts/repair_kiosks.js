#!/usr/bin/env node
"use strict";
/**
 * repair_kiosks — Repara la configuración de kioskos en Firestore
 *
 * Problemas a corregir:
 *  1. kiosks/kiosko-mecanizado fue sobrescrito con datos de tablet Honor
 *     y tiene shelves: [] → restaurar shelves: ['MEC','PRE']
 *  2. kiosks/kiosko-prensas solo tiene shelves: ['PRE'] → ampliar a ['MEC','PRE']
 *  3. Verificar que los 3 dispositivos kiosko conservan su kioskId
 *
 * Uso (desde servidor):
 *   npm run build && node lib/scripts/repair_kiosks.js          # dry-run
 *   npm run build && node lib/scripts/repair_kiosks.js --apply  # aplica
 */
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
const KIOSK_MECANIZADO_ID = 'kiosko-mecanizado';
const KIOSK_PRENSAS_ID = 'kiosko-prensas';
// Tras la consolidación PRENSAS-MECANIZADO (2026-06-10), MEC se fusionó en la
// vista combinada 'PRE'. Los kioskos deben exponer SOLO ['PRE']; incluir 'MEC'
// hace que el kiosko arranque en una estantería no navegable y muestre un
// selector espurio. Ver lib/schema/sections.ts (DATA_ONLY_SHELVES).
const KIOSK_MECANIZADO_EXPECTED = {
    name: 'Prensas-Mecanizado',
    description: 'Kiosko sección Prensas-Mecanizado',
    shelves: ['PRE'],
    isActive: true,
};
const KIOSK_PRENSAS_EXPECTED = {
    shelves: ['PRE'],
};
const KIOSK_DEVICES = [
    'device_178031040273_3vj0pn',
    'device_1780310509115_ow9t6y',
    'device_1780466221766_no8p85',
];
async function repair() {
    const db = firebaseAdmin_1.admin.firestore();
    const apply = process.argv.includes('--apply');
    console.log(`🔧 Reparación de kioskos (${apply ? 'APLICAR' : 'DRY-RUN'})`);
    console.log('='.repeat(60));
    // ── 1. Reparar kiosko-mecanizado ─────────────────────────────────────────
    console.log('\n📦 Kiosko Mecanizado:');
    const kioskoMecRef = db.collection('kiosks').doc(KIOSK_MECANIZADO_ID);
    const kioskoMecSnap = await kioskoMecRef.get();
    if (kioskoMecSnap.exists) {
        const current = kioskoMecSnap.data();
        const needsRepair = !current.shelves || current.shelves.length === 0 ||
            JSON.stringify(current.shelves.sort()) !== JSON.stringify(KIOSK_MECANIZADO_EXPECTED.shelves.sort());
        if (needsRepair) {
            console.log(`   ❌ Estado actual: shelves=${JSON.stringify(current.shelves)}`);
            console.log(`   ${apply ? '✍️ ' : '❌'} Estado esperado: shelves=${JSON.stringify(KIOSK_MECANIZADO_EXPECTED.shelves)}`);
            if (apply) {
                await kioskoMecRef.update({
                    name: KIOSK_MECANIZADO_EXPECTED.name,
                    description: KIOSK_MECANIZADO_EXPECTED.description,
                    shelves: KIOSK_MECANIZADO_EXPECTED.shelves,
                    isActive: KIOSK_MECANIZADO_EXPECTED.isActive,
                    updatedAt: new Date().toISOString(),
                });
                console.log('   ✅ Reparado');
            }
        }
        else {
            console.log('   ✅ OK — shelves ya correcto');
        }
    }
    else {
        console.log('   ⚠️  Documento no existe — creando...');
        if (apply) {
            await kioskoMecRef.set(Object.assign(Object.assign({}, KIOSK_MECANIZADO_EXPECTED), { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
            console.log('   ✅ Creado');
        }
    }
    // ── 2. Reparar kiosko-prensas ────────────────────────────────────────────
    console.log('\n📦 Kiosko Prensas:');
    const kioskoPreRef = db.collection('kiosks').doc(KIOSK_PRENSAS_ID);
    const kioskoPreSnap = await kioskoPreRef.get();
    if (kioskoPreSnap.exists) {
        const current = kioskoPreSnap.data();
        const needsRepair = !current.shelves ||
            JSON.stringify(current.shelves.sort()) !== JSON.stringify(KIOSK_PRENSAS_EXPECTED.shelves.sort());
        if (needsRepair) {
            console.log(`   ❌ Estado actual: shelves=${JSON.stringify(current.shelves)}`);
            console.log(`   ${apply ? '✍️ ' : '❌'} Estado esperado: shelves=${JSON.stringify(KIOSK_PRENSAS_EXPECTED.shelves)}`);
            if (apply) {
                await kioskoPreRef.update({
                    shelves: KIOSK_PRENSAS_EXPECTED.shelves,
                    updatedAt: new Date().toISOString(),
                });
                console.log('   ✅ Reparado');
            }
        }
        else {
            console.log('   ✅ OK — shelves ya correcto');
        }
    }
    else {
        console.log('   ⚠️  Documento no existe — creando...');
        if (apply) {
            await kioskoPreRef.set({
                name: 'Prensas',
                description: 'Kiosko sección Prensas',
                shelves: KIOSK_PRENSAS_EXPECTED.shelves,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            console.log('   ✅ Creado');
        }
    }
    // ── 3. Verificar dispositivos kiosko ─────────────────────────────────────
    console.log('\n🔍 Verificando dispositivos kiosko:');
    let devicesOk = 0;
    let devicesMissing = 0;
    for (const deviceId of KIOSK_DEVICES) {
        const deviceRef = db.collection('dispositivos').doc(deviceId);
        const deviceSnap = await deviceRef.get();
        if (deviceSnap.exists) {
            const device = deviceSnap.data();
            const hasKioskId = device.kioskId === KIOSK_MECANIZADO_ID || device.kioskId === KIOSK_PRENSAS_ID;
            if (hasKioskId) {
                console.log(`   ✅ ${deviceId}: kioskId=${device.kioskId}`);
                devicesOk++;
            }
            else {
                console.log(`   ⚠️  ${deviceId}: kioskId=${device.kioskId || '(none)'} — verificar manualmente`);
                devicesMissing++;
            }
        }
        else {
            console.log(`   ❌ ${deviceId}: documento no encontrado`);
            devicesMissing++;
        }
    }
    // ── Resumen ──────────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log(`Dispositivos kiosko verificados: ${devicesOk}/${KIOSK_DEVICES.length}`);
    if (devicesMissing > 0) {
        console.log(`⚠️  ${devicesMissing} dispositivo(s) requieren verificación manual`);
    }
    if (!apply) {
        console.log('\n⚠️  DRY-RUN — nada escrito. Ejecuta con --apply para aplicar.');
    }
    else {
        console.log('\n✅ Reparación completada.');
    }
}
repair()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error('❌ Error en la reparación:', err);
    process.exit(1);
});
//# sourceMappingURL=repair_kiosks.js.map