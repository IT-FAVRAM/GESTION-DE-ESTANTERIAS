const admin = require('firebase-admin');
const serviceAccount = require('./app/functions/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkCollections() {
  try {
    console.log('=== COLECCIÓN tablets ===');
    const tabletsSnap = await db.collection('tablets').get();
    tabletsSnap.forEach(doc => {
      console.log(`Documento: ${doc.id}`);
      console.log('Datos:', JSON.stringify(doc.data(), null, 2));
    });

    console.log('\n=== COLECCIÓN kiosks ===');
    const kiosksSnap = await db.collection('kiosks').get();
    kiosksSnap.forEach(doc => {
      console.log(`Documento: ${doc.id}`);
      console.log('Datos:', JSON.stringify(doc.data(), null, 2));
    });

    console.log('\n=== COLECCIÓN dispositivos (devices) ===');
    const devicesSnap = await db.collection('dispositivos').get();
    devicesSnap.forEach(doc => {
      console.log(`Documento: ${doc.id}`);
      console.log('Datos:', JSON.stringify(doc.data(), null, 2));
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCollections();
