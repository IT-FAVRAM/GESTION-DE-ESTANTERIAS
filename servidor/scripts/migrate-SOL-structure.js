"use strict";
/**
 * migrate-SOL-structure.ts - Migración SOLDADURA 54→73 ubicaciones
 * Uso: importado desde admin.ts para ejecutar vía adminOperate
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateSoldaduraStructure = void 0;
const firebaseAdmin_1 = require("../src/firebaseAdmin");
const migrateSoldaduraStructure = async () => {
    const db = firebaseAdmin_1.admin.firestore();
    console.log('🔄 Iniciando migración de SOLDADURA...');
    console.log('📊 De: 54 ubicaciones → A: 73 ubicaciones');
    const SOL_CODE = 'SOL';
    const NEW_LOCATION_COUNT = 73;
    // 1. Eliminar ubicaciones antiguas
    console.log('\n🗑️  Eliminando ubicaciones antiguas...');
    const shelfRef = db.collection('shelves').doc(SOL_CODE);
    const locationsSnap = await shelfRef.collection('locations').get();
    for (const docSnap of locationsSnap.docs) {
        await docSnap.ref.delete();
    }
    console.log(`  ✅ ${locationsSnap.size} ubicaciones eliminadas`);
    // 2. Crear nuevas ubicaciones
    console.log('\n✨ Creando nuevas ubicaciones...');
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let count = 0;
    for (let i = 1; i <= NEW_LOCATION_COUNT; i++) {
        const pos = i.toString().padStart(3, '0');
        const locRef = shelfRef.collection('locations').doc(pos);
        batch.set(locRef, {
            position: pos,
            items: [],
            isEmpty: true,
        });
        count++;
        if (count % BATCH_SIZE === 0) {
            await batch.commit();
            batch = db.batch();
            console.log(`  ✓ ${count} ubicaciones creadas...`);
        }
    }
    // Commit final
    if (count % BATCH_SIZE !== 0) {
        await batch.commit();
    }
    console.log(`  ✅ Total: ${count} ubicaciones creadas`);
    // 3. Actualizar documento de estantería
    console.log('\n📝 Actualizando documento de estantería...');
    await shelfRef.update({
        locationCount: NEW_LOCATION_COUNT,
        updatedAt: new Date().toISOString(),
    });
    console.log(`  ✅ Documento actualizado: locationCount = ${NEW_LOCATION_COUNT}`);
    console.log('\n✅ Migración completada exitosamente');
    return { success: true, newLocationCount: NEW_LOCATION_COUNT };
};
exports.migrateSoldaduraStructure = migrateSoldaduraStructure;
//# sourceMappingURL=migrate-SOL-structure.js.map