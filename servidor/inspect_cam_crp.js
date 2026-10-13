// Inspección de contenido de carros CAM y CRP antes de migrar
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function dumpShelf(code) {
  console.log(`\n===== shelves/${code}/locations =====`);
  const snap = await db.collection('shelves').doc(code).collection('locations').get();
  if (snap.empty) {
    console.log('(vacío / sin docs)');
    return;
  }
  snap.docs.forEach((doc) => {
    const d = doc.data();
    const items = (d.items || []).map((it) =>
      `${it.articleCode || '?'} OF:${it.orderFab || '?'} presenceId:${it.presenceId || '?'}`
    );
    console.log(`  ${doc.id}: isEmpty=${d.isEmpty}  items=${items.length}`);
    items.forEach((s) => console.log(`      - ${s}`));
  });
}

async function dumpItems(code) {
  console.log(`\n===== items (presencias activas) con shelfCodes contains ${code} =====`);
  const snap = await db.collection('items')
    .where('shelfCodes', 'array-contains', code)
    .where('active', '==', true)
    .get();
  if (snap.empty) {
    console.log('(ninguna)');
    return;
  }
  snap.docs.forEach((doc) => {
    const d = doc.data();
    console.log(`  ${doc.id}: ${d.articleCode} OF:${d.orderFab} shelfCode=${d.shelfCode} shelfCodes=${JSON.stringify(d.shelfCodes)} locationIds=${JSON.stringify(d.locationIds)}`);
  });
}

async function dumpLegacyCart(code) {
  console.log(`\n===== carts/${code}/items (legacy) =====`);
  const snap = await db.collection('carts').doc(code).collection('items').get();
  if (snap.empty) {
    console.log('(vacío)');
    return;
  }
  snap.docs.forEach((doc) => {
    const d = doc.data();
    console.log(`  ${doc.id}: shelfId=${d.shelfId} desc=${d.description} barcode=${d.barcode || '-'}`);
  });
}

async function run() {
  for (const code of ['CAM', 'CRP']) {
    await dumpShelf(code);
    await dumpItems(code);
    await dumpLegacyCart(code);
  }
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
