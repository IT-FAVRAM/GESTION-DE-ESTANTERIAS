#!/usr/bin/env node
"use strict";
/**
 * migrate_repasado_dentro — Agregar ubicaciones 040-053 para REPASADO (DENTRO)
 *
 * REPASADO se amplía de 39 a 53 ubicaciones:
 * - URGENTES: 001-004
 * - ALUMINIO 1: 005-009
 * - ALUMINIO 2: 010-014
 * - NORMAL INDIVIDUAL 1: 015-019
 * - NORMAL INDIVIDUAL 2: 020-024
 * - FUERA: 025-039
 * - DENTRO: 040-051 (NUEVAS)
 *
 * Uso (desde APP/backend):
 *   npm run build && node lib/scripts/migrate_repasado_dentro.js          # dry-run
 *   npm run build && node lib/scripts/migrate_repasado_dentro.js --apply  # aplica
 */
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
const SHELF = 'REP';
const NEW_POSITIONS = Array.from({ length: 12 }, (_, i) => i + 40); // 040-051
const pad3 = (n) => String(n).padStart(3, '0');
async function migrateRepasadoDentro() {
    const db = firebaseAdmin_1.admin.firestore();
    const isApply = process.argv.includes('--apply');
    console.log(`\n[REPASADO DENTRO] Agregar ubicaciones 040-051`);
    console.log(`Modo: ${isApply ? '✏️ APPLY' : '📋 DRY RUN'}`);
    console.log(`Posiciones a crear: ${NEW_POSITIONS.map(pad3).join(', ')} (${NEW_POSITIONS.length} ubicaciones)\n`);
    if (!isApply) {
        console.log('Ejecuta con --apply para aplicar los cambios.\n');
        return;
    }
    const shelfRef = db.collection('shelves').doc(SHELF);
    const locationsRef = shelfRef.collection('locations');
    let created = 0;
    let failed = 0;
    for (const pos of NEW_POSITIONS) {
        const docId = pad3(pos);
        try {
            const snap = await locationsRef.doc(docId).get();
            if (snap.exists) {
                console.log(`✓ ${SHELF}-${docId} ya existe`);
            }
            else {
                await locationsRef.doc(docId).set({
                    position: pos,
                    status: 'libre',
                    reserved: false,
                    items: [],
                    updatedAt: new Date().toISOString(),
                });
                console.log(`✅ Creado ${SHELF}-${docId}`);
                created++;
            }
        }
        catch (err) {
            console.error(`❌ Error en ${SHELF}-${docId}:`, err);
            failed++;
        }
    }
    console.log(`\nResultado: ${created} creadas, ${failed} errores`);
}
migrateRepasadoDentro().catch((err) => {
    console.error('Error fatal:', err);
    process.exit(1);
});
//# sourceMappingURL=migrate_repasado_dentro.js.map