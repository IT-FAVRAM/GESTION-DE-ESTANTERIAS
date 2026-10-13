// Migración: renombrar las posiciones PLE 031/032/033 → "AMADA 1/2/3" (misma estantería PLE).
//
// - shelves/PLE/locations/031 → shelves/PLE/locations/AMADA 1 (idem 032→AMADA 2, 033→AMADA 3)
// - items activos con locationIds "PLE-031" → "PLE-AMADA 1"
// - Las posiciones antiguas se eliminan (los 3 huecos pasan a llamarse AMADA)
// - Backup JSON previo + traza en history (MOVER, source migration_ple_amada)
//
// Uso: node migrate_ple_amada.js          (dry-run, solo muestra)
//      node migrate_ple_amada.js --apply  (ejecuta)
const fs = require('fs');
const admin = require('../../../servidor/node_modules/firebase-admin');
const serviceAccount = require('../../../serviceAccount.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const SHELF = 'PLE';
const MAP = { '031': 'AMADA 1', '032': 'AMADA 2', '033': 'AMADA 3' };
const APPLY = process.argv.includes('--apply');

const relabel = (v) => {
  if (typeof v !== 'string') return v;
  for (const [from, to] of Object.entries(MAP)) {
    if (v === `${SHELF}-${from}`) return `${SHELF}-${to}`;
  }
  return v;
};

async function run() {
  const now = new Date().toISOString();
  const locCol = db.collection('shelves').doc(SHELF).collection('locations');

  const locDocs = [];
  for (const from of Object.keys(MAP)) {
    const snap = await locCol.doc(from).get();
    if (snap.exists) locDocs.push(snap);
    else console.log(`  (sin doc de ubicación ${SHELF}-${from})`);
  }

  // Seguridad: los destinos no deben existir ya con contenido
  for (const to of Object.values(MAP)) {
    const t = await locCol.doc(to).get();
    if (t.exists && (t.data().items || []).length > 0) {
      console.error(`❌ ABORTADO: ${SHELF}-${to} ya tiene items.`);
      process.exit(1);
    }
  }

  const presSnap = await db.collection('items')
    .where('shelfCodes', 'array-contains', SHELF)
    .where('active', '==', true)
    .get();
  const presAffected = presSnap.docs.filter((d) =>
    (d.data().locationIds || []).some((l) => relabel(l) !== l));

  const backup = {
    timestamp: now,
    locations: locDocs.map((d) => ({ id: d.id, data: d.data() })),
    presences: presAffected.map((d) => ({ id: d.id, data: d.data() })),
  };
  const backupFile = `backup_PLE_AMADA_${now.replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`💾 Backup guardado: ${backupFile}`);

  const batch = db.batch();
  let historyCount = 0;

  for (const doc of locDocs) {
    const data = doc.data();
    const to = MAP[doc.id];
    const items = data.items || [];
    batch.set(locCol.doc(to), { ...data, position: to }, { merge: false });
    batch.delete(doc.ref);
    console.log(`  ${SHELF}-${doc.id} → ${SHELF}-${to}  (${items.length} items)`);

    for (const it of items) {
      const h = db.collection('history').doc();
      batch.set(h, {
        id: h.id,
        action: 'MOVER',
        articleCode: it.articleCode || null,
        orderFab: it.orderFab || null,
        fromLocation: `${SHELF}-${doc.id}`,
        toLocation: `${SHELF}-${to}`,
        shelfCode: SHELF,
        operarioId: 'MIGRACION',
        operarioName: 'Renombrado PLE→AMADA (admin)',
        timestamp: now,
        uid: 'admin-script',
        role: 'SUPERADMIN',
        user: 'Renombrado PLE→AMADA',
        source: 'migration_ple_amada',
      });
      historyCount++;
    }
  }

  for (const doc of presAffected) {
    const d = doc.data();
    const locationIds = (d.locationIds || []).map(relabel);
    batch.update(doc.ref, { locationIds });
    console.log(`  presencia ${doc.id}: ${d.articleCode} ${JSON.stringify(d.locationIds)} → ${JSON.stringify(locationIds)}`);
  }

  console.log(`\nResumen: ${locDocs.length} locations, ${presAffected.length} presencias, ${historyCount} entradas de history`);

  if (!APPLY) {
    console.log('\n🔍 DRY-RUN — no se ha escrito nada. Ejecuta con --apply para aplicar.');
    process.exit(0);
  }

  await batch.commit();
  console.log('\n✅ Migración aplicada.');
  process.exit(0);
}

run().catch((e) => { console.error('❌ Error:', e); process.exit(1); });
