const admin = require('firebase-admin');
const path = require('path');

// Load service account from root
const serviceAccountPath = path.join(__dirname, '..', '..', 'serviceAccount.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function updateKiosk() {
  try {
    console.log('Actualizando kiosks/kiosko-mecanizado...');
    const kioskRef = db.collection('kiosks').doc('kiosko-mecanizado');
    
    await kioskRef.update({
      shelves: ['PRE'],
      updatedAt: new Date().toISOString(),
    });
    
    console.log('✅ Kiosko kiosko-mecanizado actualizado: shelves = ["PRE"]');
    
    // Verify the update
    const snap = await kioskRef.get();
    const data = snap.data();
    console.log('✅ Verificación: shelves =', data?.shelves);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  }
}

updateKiosk();
