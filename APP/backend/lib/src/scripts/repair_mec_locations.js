#!/usr/bin/env node
"use strict";
/**
 * repair_mec_locations — Reconstruye los docs de ubicación de MEC desde
 * la colección `items` (fuente de verdad).
 *
 * Necesario después de una migración con colisión de IDs: cuando el script
 * de migración renombra OLD "003" → "016" y luego procesa OLD "016" → "029",
 * el segundo paso lee el doc "016" que ya contenía los datos de "003", dando
 * lugar a location docs incorrectos (016-020 eliminados, 029-033 con datos
 * erróneos).
 *
 * Este script:
 *  1. Lee todos los ItemDocs activos de MEC desde la colección `items`
 *  2. Agrupa los artículos por posición (extraída de locationIds[])
 *  3. Compara el estado actual de cada doc de ubicación con el esperado
 *  4. Actualiza / crea los docs que difieran
 *
 * Uso (desde APP/backend):
 *   npm run build && node lib/scripts/repair_mec_locations.js          # dry-run
 *   npm run build && node lib/scripts/repair_mec_locations.js --apply  # aplica
 */
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
const SHELF = 'MEC';
async function repair() {
    var _a;
    const db = firebaseAdmin_1.admin.firestore();
    const apply = process.argv.includes('--apply');
    console.log(`🔧 Reparación de ubicaciones MEC (${apply ? 'APLICAR' : 'DRY-RUN'})`);
    console.log('='.repeat(60));
    // ── 1. Leer todos los ItemDocs activos de MEC ─────────────────────────────
    const itemsSnap = await db.collection('items')
        .where('shelfCode', '==', SHELF)
        .where('active', '==', true)
        .get();
    console.log(`📦 ${itemsSnap.size} ItemDocs activos encontrados en MEC`);
    // ── 2. Agrupar por posición ───────────────────────────────────────────────
    const byPosition = {};
    for (const doc of itemsSnap.docs) {
        const data = doc.data();
        const locationIds = data.locationIds || [];
        for (const locId of locationIds) {
            const match = locId.match(/^MEC-(\d+)$/);
            if (!match)
                continue; // saltar URG MEC-PRE y otros especiales
            const pos = match[1]; // "016", "029", etc.
            if (!byPosition[pos])
                byPosition[pos] = [];
            byPosition[pos].push({
                presenceId: doc.id,
                articleCode: data.articleCode || '',
                orderFab: data.orderFab || '',
                locatedBy: data.locatedBy || '',
                locatedByName: data.locatedByName || '',
                locatedAt: data.locatedAt || '',
            });
        }
    }
    const expectedPositions = Object.keys(byPosition).sort();
    console.log(`📍 Posiciones esperadas: ${expectedPositions.join(', ')}\n`);
    // ── 3. Comparar con el estado actual y reparar ────────────────────────────
    let fixed = 0;
    let ok = 0;
    for (const pos of expectedPositions) {
        const expectedItems = byPosition[pos];
        const docRef = db.collection('shelves').doc(SHELF).collection('locations').doc(pos);
        const docSnap = await docRef.get();
        const currentItems = docSnap.exists ? (((_a = docSnap.data()) === null || _a === void 0 ? void 0 : _a.items) || []) : [];
        // Comparar artículos (independientemente del orden)
        const toKey = (i) => `${i.articleCode}__${i.orderFab}`;
        const currentKeys = new Set(currentItems.map(toKey));
        const expectedKeys = new Set(expectedItems.map(toKey));
        const same = currentKeys.size === expectedKeys.size &&
            [...expectedKeys].every((k) => currentKeys.has(k));
        if (same) {
            console.log(`   ✅ ${pos}: ${expectedItems.length} artículo(s) — OK`);
            ok++;
        }
        else {
            const currentList = currentItems.map((i) => i.articleCode).join(', ') || '(vacío)';
            const expectedList = expectedItems.map((i) => i.articleCode).join(', ');
            console.log(`   ${apply ? '✍️ ' : '❌'} ${pos}: DIFERENTE`);
            console.log(`      Actual:   ${currentList}`);
            console.log(`      Esperado: ${expectedList}`);
            if (apply) {
                await docRef.set({
                    position: pos,
                    items: expectedItems,
                    isEmpty: false,
                });
            }
            fixed++;
        }
    }
    // ── 4. Detectar docs "fantasma" (existen en Firestore pero no en items) ───
    console.log('\n🔍 Verificando docs huérfanos en shelves/MEC/locations...');
    const locSnap = await db.collection('shelves').doc(SHELF).collection('locations').get();
    for (const locDoc of locSnap.docs) {
        const pos = locDoc.id;
        if (pos.startsWith('URG'))
            continue; // no tocar URG MEC-PRE
        if (!byPosition[pos]) {
            const items = locDoc.data().items || [];
            if (items.length > 0) {
                console.log(`   ⚠️  ${pos}: doc con ${items.length} artículo(s) pero no hay ItemDocs activos apuntando aquí — posible huérfano`);
                // No eliminamos automáticamente — requiere revisión manual
            }
        }
    }
    console.log('\n' + '='.repeat(60));
    console.log(`Correctos: ${ok}  |  ${apply ? 'Reparados' : 'A reparar'}: ${fixed}`);
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
//# sourceMappingURL=repair_mec_locations.js.map