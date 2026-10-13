#!/usr/bin/env node
"use strict";
/**
 * register_repasado_kiosk — Registra el ordenador como kiosko de REPASADO
 *
 * Uso (desde servidor):
 *   npm run build && node lib/scripts/register_repasado_kiosk.js [--deviceId DEVICE_ID] [--apply]
 *
 * Sin --apply, hace dry-run. Sin --deviceId, genera uno aleatorio para pruebas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
async function registerKiosk() {
    var _a;
    const apply = process.argv.includes('--apply');
    const customDeviceId = (_a = process.argv.find(arg => arg.startsWith('--deviceId='))) === null || _a === void 0 ? void 0 : _a.split('=')[1];
    // Generar deviceId si no se proporciona
    const deviceId = customDeviceId || `REPASADO-${Date.now()}`;
    console.log('🖥️  Registrando kiosko de REPASADO');
    console.log('='.repeat(60));
    console.log(`   Device ID: ${deviceId}`);
    console.log(`   Tipo: KIOSK`);
    console.log(`   Estantería: REP (REPASADO)`);
    console.log(`   ${apply ? '✍️  APLICAR' : '❌ DRY-RUN'}`);
    console.log('='.repeat(60));
    try {
        const db = firebaseAdmin_1.admin.firestore();
        if (apply) {
            console.log('\n1️⃣  Creando dispositivo en Firestore...');
            await db.collection('dispositivos').doc(deviceId).set({
                type: 'KIOSK',
                assignedShelf: 'REP',
                name: 'Kiosko REPASADO',
                active: true,
                createdAt: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
            });
            console.log('   ✅ Dispositivo registrado');
            console.log('\n' + '='.repeat(60));
            console.log('✅ Kiosko de REPASADO registrado exitosamente');
            console.log('\n📋 URL para acceder desde el ordenador:');
            console.log(`   http://localhost:5173/?deviceId=${deviceId}`);
            console.log(`   o en producción:`);
            console.log(`   https://tu-dominio.com/?deviceId=${deviceId}`);
            console.log('\n💡 El ordenador se identificará automáticamente como kiosko de REPASADO');
            console.log('='.repeat(60));
        }
        else {
            console.log('\n⚠️  DRY-RUN — nada escrito.');
            console.log('   Ejecuta con --apply para registrar el dispositivo');
            console.log(`\n   npm run build && node lib/scripts/register_repasado_kiosk.js --apply`);
        }
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ Error al registrar kiosko:');
        console.error(`   ${error.message}`);
        process.exit(1);
    }
}
registerKiosk();
//# sourceMappingURL=register_repasado_kiosk.js.map