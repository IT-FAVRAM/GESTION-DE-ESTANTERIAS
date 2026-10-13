// Migración: mover TODO el contenido del carro CAM (Plegadora Amada)
// al carro CRP (Robot de Plegado), manteniendo las mismas posiciones (001, 002...).
//
// - shelves/CAM/locations/{pos} → shelves/CRP/locations/{pos} (mismos datos)
// - items activos con shelfCodes contains CAM → shelfCode/shelfCodes/locationIds re-etiquetados a CRP
// - CAM queda vacío (items: [], isEmpty: true)
// - Traza en history (action MOVER, source migration_cam_to_crp)
//
// Uso: node migrate_cam_to_crp.js          (dry-run, solo muestra)
//      node migrate_cam_to_crp.js --apply  (ejecuta)
const fs = require('fs');
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const FROM = 'CAM';
const TO = 'CRP';
const APPLY = process.argv.includes('--apply');

const relabel = (v) => (typeof v === 'string' ? v.replace(new RegExp(`^${FROM}(?=-)`), TO) : v);

async function run() {
  const now = new Date().toISOString();

  // ── 1. Leer estado actual ──────────────────────────────────────────────
  const locSnap = await db.collection('shelves').doc(FROM).collection('locations').get();
  const presSnap = await db.collection('items')
    .where('shelfCodes', 'array-contains', FROM)
    .where('active', '==', true)
    .get();
  const crpLocSnap = await db.collection('shelves').doc(TO).collection('locations').get();

  // Seguridad: CRP debe estar vacío (sin items) para copiar posiciones 1:1
  const crpOccupied = crpLocSnap.docs.filter((d) => (d.data().items || []).length > 0);
  if (crpOccupied.length > 0) {
    console.error(`❌ ABORTADO: ${TO} tiene posiciones ocupadas: ${crpOccupied.map((d) => d.id).join(', ')}`);
    process.exit(1);
  }

  // ── 2. Backup ──────────────────────────────────────────────────────────
  const backup = {
    timestamp: now,
    locations: locSnap.docs.map((d) => ({ id: d.id, data: d.data() })),
    presences: presSnap.docs.map((d) => ({ id: d.id, data: d.data() })),
  };
  const backupFile = `backup_CAM_to_CRP_${now.replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`💾 Backup guardado: ${backupFile}`);
  console.log(`   Locations CAM: ${locSnap.size} | Presencias activas CAM: ${presSnap.size}`);

  // ── 3. Preparar batch ──────────────────────────────────────────────────
  const batch = db.batch();
  let historyCount = 0;

  for (const doc of locSnap.docs) {
    const data = doc.data();
    const items = data.items || [];
    const toRef = db.collection('shelves').doc(TO).collection('locations').doc(doc.id);
    const fromRef = doc.ref;

    // Copiar el doc entero a CRP (misma posición, mismos items)
    batch.set(toRef, { ...data, position: doc.id }, { merge: false });
    // Vaciar CAM
    batch.set(fromRef, { position: doc.id, items: [], isEmpty: true }, { merge: false });

    console.log(`  ${FROM}-${doc.id} → ${TO}-${doc.id}  (${items.length} items)`);

    // Traza en history por cada artículo visible
    for (const it of items) {
      const historyRef = db.collection('history').doc();
      batch.set(historyRef, {
        id: historyRef.id,
        action: 'MOVER',
        articleCode: it.articleCode || null,
        orderFab: it.orderFab || null,
        fromLocation: `${FROM}-${doc.id}`,
        toLocation: `${TO}-${doc.id}`,
        shelfCode: TO,
        operarioId: 'MIGRACION',
        operarioName: 'Migración CAM→CRP (admin)',
        timestamp: now,
        uid: 'admin-script',
        role: 'SUPERADMIN',
        user: 'Migración CAM→CRP',
        source: 'migration_cam_to_crp',
      });
      historyCount++;
    }
  }

  for (const doc of presSnap.docs) {
    const d = doc.data();
    const updates = {
      shelfCode: d.shelfCode === FROM ? TO : d.shelfCode,
      shelfCodes: (d.shelfCodes || []).map((c) => (c === FROM ? TO : c)),
      locationIds: (d.locationIds || []).map(relabel),
    };
    batch.update(doc.ref, updates);
    console.log(`  presencia ${doc.id}: ${d.articleCode} ${JSON.stringify(d.locationIds)} → ${JSON.stringify(updates.locationIds)}`);
  }

  console.log(`\nResumen: ${locSnap.size} locations, ${presSnap.size} presencias, ${historyCount} entradas de history`);

  if (!APPLY) {
    console.log('\n🔍 DRY-RUN — no se ha escrito nada. Ejecuta con --apply para aplicar.');
    process.exit(0);
  }

  // ── 4. Ejecutar ────────────────────────────────────────────────────────
  await batch.commit();
  console.log('\n✅ Migración aplicada.');

  // ── 5. Verificación ────────────────────────────────────────────────────
  const verifyCam = await db.collection('items').where('shelfCodes', 'array-contains', FROM).where('active', '==', true).get();
  const verifyCrp = await db.collection('items').where('shelfCodes', 'array-contains', TO).where('active', '==', true).get();
  const verifyCamLoc = await db.collection('shelves').doc(FROM).collection('locations').get();
  const camItemsLeft = verifyCamLoc.docs.reduce((n, d) => n + (d.data().items || []).length, 0);
  console.log(`Verificación: presencias CAM activas=${verifyCam.size} (esperado 0) | presencias CRP activas=${verifyCrp.size} (esperado ${presSnap.size}) | items en locations CAM=${camItemsLeft} (esperado 0)`);
  process.exit(0);
}

run().catch((e) => { console.error('❌ Error:', e); process.exit(1); });
