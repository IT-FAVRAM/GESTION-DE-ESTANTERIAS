const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function setupKiosko() {
  try {
    // 1. Crear el kiosko "kiosko-mecanizado"
    await db.collection('kiosks').doc('kiosko-mecanizado').set({
      name: 'Mecanizado-Prensas',
      shelves: ['MEC', 'PRE'],
      description: 'Kiosko para secciones de mecanizado y prensas',
      location: 'Planta 2',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✓ Kiosko creado: kiosko-mecanizado');

    // 2. Crear/actualizar el documento del dispositivo
    await db.collection('devices').doc('C431E4R2P1').set({
      kioskId: 'kiosko-mecanizado',
      name: 'Honor Pad X8a - Mecanizado',
      model: 'Honor Pad X8a',
      buildNumber: '8.0.0.309',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('✓ Dispositivo asociado: C431E4R2P1 → kiosko-mecanizado');

    console.log('\n✅ Setup completado. La tablet está lista.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setupKiosko();
