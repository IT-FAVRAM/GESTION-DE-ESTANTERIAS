#!/usr/bin/env node
/**
 * migrate_mec_positions — Renumera las ubicaciones de la estantería MEC.
 *
 * La estantería MEC pasa de iniciar en 001 a iniciar en 014.
 * Mapeo completo (solo cuerpos 1 y 2; cuerpo3 001-021 → +13):
 *   001-021  →  014-034  (offset +13)
 *
 * NOTA: Los docs en Firestore usan solo la posición como ID (ej. "003"),
 * NO el formato "MEC-003". El locationId "MEC-003" solo aparece en la
 * colección `items` (campo locationIds[]).
 *
 * SEGURIDAD: Lee todos los docs ANTES de escribir para evitar colisiones
 * cuando un oldId coincide con el newId de otro (ej. "016" es a la vez
 * destino de "003" y origen hacia "029").
 *
 * El cuerpo3 (posiciones 022-030) estaba vacío intencionalmente y ya ha sido
 * renumerado en el schema a 038-046, pero sus documentos de Firestore no
 * necesitan migración (estaban vacíos). Si en el futuro tuviesen datos,
 * re-ejecutar con --include-cuerpo3 para también migrarlos.
 *
 * También actualiza los ItemDoc.locationIds que referencien los IDs antiguos.
 *
 * Uso (desde APP/backend):
 *   npm run build && node lib/scripts/migrate_mec_positions.js          # dry-run
 *   npm run build && node lib/scripts/migrate_mec_positions.js --apply  # aplica
 */

import { admin } from '../firebaseAdmin';

const SHELF = 'MEC';

/** Mapeo posición numérica antigua → nueva */
const POSITION_MAP: Record<number, number> = {};
// Cuerpos 1 y 2: offset +13
for (let i = 1; i <= 21; i++) POSITION_MAP[i] = i + 13;
// Cuerpo 3: offset +16 (incluir solo si --include-cuerpo3)
for (let i = 22; i <= 30; i++) POSITION_MAP[i] = i + 16;

const pad3 = (n: number) => String(n).padStart(3, '0');

// ID del documento en Firestore (shelves/MEC/locations/{id}) — solo la posición
const oldLocDocId = (pos: number) => pad3(pos);                                   // "003"
const newLocDocId = (pos: number) => pad3(POSITION_MAP[pos]);                     // "016"

// locationId usado en la colección `items` (campo locationIds[])
const oldLocationId = (pos: number) => `${SHELF}-${pad3(pos)}`;                   // "MEC-003"
const newLocationId = (pos: number) => `${SHELF}-${pad3(POSITION_MAP[pos])}`;     // "MEC-016"

const newPosStr = (pos: number) => pad3(POSITION_MAP[pos]);

async function migrate() {
  const apply = process.argv.includes('--apply');
  const includeCuerpo3 = process.argv.includes('--include-cuerpo3');
  const db = admin.firestore();

  console.log(`🔄 Migración MEC positions (${apply ? 'APLICAR' : 'DRY-RUN'})`);
  if (!includeCuerpo3) console.log('   (cuerpo3 = 022-030 omitido — use --include-cuerpo3 si tiene datos)');
  console.log('='.repeat(60));

  const maxPos = includeCuerpo3 ? 30 : 21;

  // ── PASO 1: Leer TODOS los docs existentes antes de escribir ─────────────
  // Esto evita colisiones cuando un newId coincide con otro oldId.
  console.log('📖 Leyendo todos los docs existentes...');
  const docsToMigrate: Array<{
    oldDocId: string;
    newDocId: string;
    oldLocId: string;
    newLocId: string;
    data: FirebaseFirestore.DocumentData;
    oldPos: number;
  }> = [];

  for (let oldPos = 1; oldPos <= maxPos; oldPos++) {
    const oldDocId = oldLocDocId(oldPos);
    const newDocId = newLocDocId(oldPos);
    const oldRef = db.collection('shelves').doc(SHELF).collection('locations').doc(oldDocId);
    const oldSnap = await oldRef.get();

    if (!oldSnap.exists) {
      console.log(`   ⬜ ${oldDocId} → ${newDocId}  (no existe, saltar)`);
      continue;
    }

    const data = oldSnap.data()!;
    const items: any[] = data.items || [];
    const isEmpty: boolean = data.isEmpty ?? items.length === 0;
    console.log(`   📋 ${oldDocId} (${oldLocationId(oldPos)}) → ${newDocId} (${newLocationId(oldPos)})  (${items.length} artículo(s), isEmpty=${isEmpty})`);

    docsToMigrate.push({
      oldDocId,
      newDocId,
      oldLocId: oldLocationId(oldPos),
      newLocId: newLocationId(oldPos),
      data,
      oldPos,
    });
  }

  console.log(`\n   Total a migrar: ${docsToMigrate.length}\n`);

  // ── PASO 2: Escribir nuevos docs y eliminar antiguos ──────────────────────
  if (apply) {
    for (const { oldDocId, newDocId, data, oldPos } of docsToMigrate) {
      const oldRef = db.collection('shelves').doc(SHELF).collection('locations').doc(oldDocId);
      const newRef = db.collection('shelves').doc(SHELF).collection('locations').doc(newDocId);
      console.log(`   ✍️  ${oldDocId} → ${newDocId}`);
      await newRef.set({ ...data, position: newPosStr(oldPos) });
      await oldRef.delete();
    }
  }

  // ── PASO 3: Actualizar locationIds en la colección `items` ────────────────
  console.log('\n🔍 Escaneando colección items para actualizar locationIds...');

  const replacements: Record<string, string> = {};
  for (const { oldLocId, newLocId } of docsToMigrate) {
    replacements[oldLocId] = newLocId;
  }

  let itemDocsUpdated = 0;

  try {
    const rootItemsSnap = await db.collection('items')
      .where('shelfCode', '==', SHELF)
      .get();

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of rootItemsSnap.docs) {
      const locs: string[] = doc.data().locationIds || [];
      const newLocs = locs.map((l) => replacements[l] ?? l);
      const changed = newLocs.some((l, i) => l !== locs[i]);

      if (changed) {
        const changes = locs
          .filter((l) => replacements[l])
          .map((l) => `${l} → ${replacements[l]}`)
          .join(', ');
        console.log(`   ${apply ? '✍️ ' : '👀'} items/${doc.id}  ${changes}`);
        if (apply) {
          batch.update(doc.ref, { locationIds: newLocs });
          batchCount++;
        }
        itemDocsUpdated++;
      }
    }

    if (apply && batchCount > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.warn('⚠️  No se pudo escanear colección items:', (err as Error).message);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Ubicaciones a migrar: ${docsToMigrate.length}  |  ItemDocs actualizados: ${itemDocsUpdated}`);
  if (!apply) {
    console.log('\n⚠️  DRY-RUN — nada escrito. Ejecuta con --apply para aplicar.');
  } else {
    console.log('\n✅ Migración completada.');
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error en la migración:', err);
    process.exit(1);
  });
