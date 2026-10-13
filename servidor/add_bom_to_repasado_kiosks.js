// Añade la estantería BOM (Bombo) a allowedShelves de todos los kioskos de REPASADO
// (dispositivos con assignedShelf === 'REP').
//
// Uso: node add_bom_to_repasado_kiosks.js          (dry-run)
//      node add_bom_to_repasado_kiosks.js --apply  (ejecuta)
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccount.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const SHELF = 'BOM';
const APPLY = process.argv.includes('--apply');

async function run() {
  const snap = await db.collection('dispositivos').where('assignedShelf', '==', 'REP').get();
  const batch = db.batch();
  let n = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const current = Array.isArray(d.allowedShelves) && d.allowedShelves.length ? d.allowedShelves : ['REP'];
    if (current.includes(SHELF)) {
      console.log(`  ${doc.id} (${d.name}): ya tiene ${SHELF}`);
      continue;
    }
    const next = [...current, SHELF];
    console.log(`  ${doc.id} (${d.name}): ${JSON.stringify(d.allowedShelves || null)} → ${JSON.stringify(next)}`);
    batch.update(doc.ref, { allowedShelves: next, updatedAt: new Date().toISOString() });
    n++;
  }

  console.log(`\n${n} dispositivo(s) a actualizar.`);
  if (!APPLY) {
    console.log('🔍 DRY-RUN — no se ha escrito nada. Ejecuta con --apply para aplicar.');
    process.exit(0);
  }
  if (n > 0) await batch.commit();
  console.log('✅ Aplicado.');
  process.exit(0);
}

run().catch((e) => { console.error('❌ Error:', e); process.exit(1); });
