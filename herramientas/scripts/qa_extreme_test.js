const admin = require('../../APP/backend/node_modules/firebase-admin');
const assert = require('assert');

admin.initializeApp({
  credential: admin.credential.cert(require('../../serviceAccount.json'))
});

const { shelfOperate } = require('../../APP/backend/lib/src/index.js');

const ARTICLE = 'QA-EXTREME-X';
const ORDER = 'OF-EXTREME-1';
const SHELF = 'PME';

const context = {
  auth: {
    uid: 'test-admin',
    token: { role: 'ADMIN', email: 'admin@test.com', firebase: { sign_in_provider: 'password' } }
  }
};

async function cleanup() {
  const db = admin.firestore();
  console.log('--- Cleaning up ---');
  const aggRef = db.collection('itemAggregates').doc(`${ARTICLE}__${ORDER}`);
  const aggSnap = await aggRef.get();
  if (aggSnap.exists) {
    const pids = aggSnap.data().activePresenceIds || [];
    for (const pid of pids) await db.collection('items').doc(pid).delete();
    await aggRef.delete();
  }
  
  // Limpiar estanterías de test
  for (const pos of ['URG MEC-PRE 001', 'URG MEC-PRE 002', 'URG MEC-PRE 003']) {
    const locRef = db.collection('shelves').doc(SHELF).collection('locations').doc(pos);
    await locRef.update({ items: [], isEmpty: true }).catch(() => {});
    
    // Y las gemelas para que no molesten
    for (const twinShelf of ['PRE', 'MEC']) {
      await db.collection('shelves').doc(twinShelf).collection('locations').doc(pos)
        .update({ items: [], isEmpty: true }).catch(() => {});
    }
  }
}

async function getLocItems(pos) {
  const snap = await admin.firestore().collection('shelves').doc(SHELF).collection('locations').doc(pos).get();
  return snap.exists ? (snap.data().items || []) : [];
}

async function getTwinItems(shelf, pos) {
  const snap = await admin.firestore().collection('shelves').doc(shelf).collection('locations').doc(pos).get();
  return snap.exists ? (snap.data().items || []) : [];
}

async function run() {
  await cleanup();
  
  console.log('\n--- TEST 1: Triple ubicarMulti en la misma caja ---');
  await shelfOperate.run({
    op: 'ubicarMulti',
    payload: {
      shelfCode: SHELF,
      articleCode: ARTICLE,
      orderFab: ORDER,
      positions: ['URG MEC-PRE 001', 'URG MEC-PRE 001', 'URG MEC-PRE 001']
    }
  }, context);
  
  let items001 = await getLocItems('URG MEC-PRE 001');
  console.log(`> Items en URG MEC-PRE 001: ${items001.length}`);
  assert.strictEqual(items001.length, 3, "TEST 1 FALLÓ: No hay 3 items en la ubicación primaria");
  console.log('✅ TEST 1 OK');

  console.log('\n--- TEST 2: retirar masivo de las 3 unidades ---');
  await shelfOperate.run({
    op: 'retirar',
    payload: {
      shelfCode: SHELF,
      articleCode: ARTICLE,
      orderFab: ORDER
    }
  }, context);
  
  items001 = await getLocItems('URG MEC-PRE 001');
  console.log(`> Items en URG MEC-PRE 001: ${items001.length}`);
  assert.strictEqual(items001.length, 0, "TEST 2 FALLÓ: Quedan items fantasma en la ubicación primaria");
  console.log('✅ TEST 2 OK');

  console.log('\n--- TEST 3: mover convergente ---');
  // 1. Ubicar 1 en 001 y 1 en 002
  await shelfOperate.run({
    op: 'ubicarMulti',
    payload: {
      shelfCode: SHELF,
      articleCode: ARTICLE,
      orderFab: ORDER,
      positions: ['URG MEC-PRE 001', 'URG MEC-PRE 002']
    }
  }, context);
  
  // 2. Mover AMBAS a 003 simultáneamente
  await shelfOperate.run({
    op: 'mover',
    payload: {
      shelfCode: SHELF,
      articleCode: ARTICLE,
      orderFab: ORDER,
      newPositions: ['URG MEC-PRE 003', 'URG MEC-PRE 003']
    }
  }, context);
  
  const items003 = await getLocItems('URG MEC-PRE 003');
  console.log(`> Items en URG MEC-PRE 003: ${items003.length}`);
  assert.strictEqual(items003.length, 2, "TEST 3 FALLÓ: No hay 2 items en el destino (se sobrescribió)");

  items001 = await getLocItems('URG MEC-PRE 001');
  const items002 = await getLocItems('URG MEC-PRE 002');
  assert.strictEqual(items001.length, 0, "TEST 3 FALLÓ: Origen 001 no se vació");
  assert.strictEqual(items002.length, 0, "TEST 3 FALLÓ: Origen 002 no se vació");
  
  console.log('✅ TEST 3 OK');
  
  await cleanup();
  console.log('\n🚀 TODOS LOS TEST EXTREMOS SUPERADOS CON ÉXITO');
  process.exit(0);
}

run().catch(e => {
  console.error('❌ ERROR FATAL EN TEST:', e);
  process.exit(1);
});
