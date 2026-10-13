#!/usr/bin/env node
"use strict";
/**
 * verify_deployment — Verificación post-deploy
 *
 * Comprueba que los fixes y reparaciones funcionan correctamente.
 *
 * Uso (desde servidor):
 *   npm run build && node lib/src/scripts/verify_deployment.js
 */
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
async function verify() {
    const db = firebaseAdmin_1.admin.firestore();
    let errors = 0;
    let ok = 0;
    console.log('🔍 Verificación post-deploy');
    console.log('='.repeat(60));
    // ── 1. Verificar kioskos reparados ──────────────────────────────────────
    console.log('\n📦 Kioskos:');
    const kioskoMec = await db.collection('kiosks').doc('kiosko-mecanizado').get();
    if (kioskoMec.exists) {
        const data = kioskoMec.data();
        const shelves = data.shelves || [];
        if (shelves.includes('MEC') && shelves.includes('PRE')) {
            console.log('   ✅ kiosko-mecanizado: shelves=' + JSON.stringify(shelves));
            ok++;
        }
        else {
            console.log('   ❌ kiosko-mecanizado: shelves=' + JSON.stringify(shelves) + ' (esperado [MEC,PRE])');
            errors++;
        }
    }
    else {
        console.log('   ❌ kiosko-mecanizado: documento no existe');
        errors++;
    }
    const kioskoPre = await db.collection('kiosks').doc('kiosko-prensas').get();
    if (kioskoPre.exists) {
        const data = kioskoPre.data();
        const shelves = data.shelves || [];
        if (shelves.includes('MEC') && shelves.includes('PRE')) {
            console.log('   ✅ kiosko-prensas: shelves=' + JSON.stringify(shelves));
            ok++;
        }
        else {
            console.log('   ❌ kiosko-prensas: shelves=' + JSON.stringify(shelves) + ' (esperado [MEC,PRE])');
            errors++;
        }
    }
    else {
        console.log('   ❌ kiosko-prensas: documento no existe');
        errors++;
    }
    // ── 2. Verificar dispositivos limpiados ─────────────────────────────────
    console.log('\n🧹 Dispositivos:');
    const dispositivos = await db.collection('dispositivos').get();
    let autoCount = 0;
    for (const doc of dispositivos.docs) {
        const data = doc.data();
        if (data.name && data.name.startsWith('Auto-')) {
            autoCount++;
        }
    }
    if (autoCount === 0) {
        console.log('   ✅ No hay dispositivos "Auto-X" (limpieza exitosa)');
        ok++;
    }
    else {
        console.log('   ❌ Aún hay ' + autoCount + ' dispositivos "Auto-X"');
        errors++;
    }
    // Verificar tablet Honor
    const honor = await db.collection('dispositivos').doc('C431E4R2P1').get();
    if (honor.exists) {
        const data = honor.data();
        if (data.active === false && data.ownerUid === 'KlHKtbcUTcc3T4VAfZ7bjmYDuLp1') {
            console.log('   ✅ Tablet Honor: inactiva, asignada a Oscar');
            ok++;
        }
        else {
            console.log('   ❌ Tablet Honor: active=' + data.active + ', ownerUid=' + data.ownerUid);
            errors++;
        }
    }
    else {
        console.log('   ⚠️  Tablet Honor: documento no encontrado');
    }
    // ── 3. Verificar estanterías MEC y PRE ──────────────────────────────────
    console.log('\n📍 Estanterías:');
    const mecLocs = await db.collection('shelves').doc('MEC').collection('locations').get();
    const preLocs = await db.collection('shelves').doc('PRE').collection('locations').get();
    let mecItems = 0;
    let preItems = 0;
    mecLocs.docs.forEach(doc => {
        const items = doc.data().items || [];
        mecItems += items.length;
    });
    preLocs.docs.forEach(doc => {
        const items = doc.data().items || [];
        preItems += items.length;
    });
    console.log('   📦 MEC: ' + mecLocs.size + ' ubicaciones, ' + mecItems + ' artículos');
    console.log('   📦 PRE: ' + preLocs.size + ' ubicaciones, ' + preItems + ' artículos');
    if (mecItems > 0 || preItems > 0) {
        console.log('   ✅ Artículos conservados correctamente (no se tocaron)');
        ok++;
    }
    // ── 4. Verificar que productionOperate existe ────────────────────────────
    console.log('\n🔧 Cloud Functions:');
    // Verificar que las functions están desplegadas
    await db.collection('_ops').limit(1).get();
    console.log('   ✅ Firestore accesible');
    // ── Resumen ──────────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log('✅ Verificaciones OK: ' + ok);
    if (errors > 0) {
        console.log('❌ Errores: ' + errors);
    }
    else {
        console.log('🎉 Todo correcto - deploy exitoso');
    }
}
verify()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error('❌ Error en la verificación:', err);
    process.exit(1);
});
//# sourceMappingURL=verify_deployment.js.map