const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'APP/backend/serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://gestion-de-estanterias.firebaseio.com',
});

const db = admin.firestore();

async function updateUrgentLocations() {
  try {
    console.log('📍 Actualizando ubicaciones urgentes...');
    
    const configRef = db.collection('config').doc('app');
    const snap = await configRef.get();
    const config = snap.exists ? snap.data() : {};
    
    const current = Array.isArray(config.urgentLocations) ? [...config.urgentLocations] : [];
    const solUrgent = ['SOL-001', 'SOL-002', 'SOL-003', 'SOL-004'];
    const newUrgent = [...new Set([...current, ...solUrgent])];
    
    await configRef.update({
      urgentLocations: newUrgent,
      updatedAt: new Date().toISOString(),
    });
    
    console.log(`✅ Ubicaciones urgentes: ${newUrgent.length}`);
    console.log(newUrgent.join(', '));
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

updateUrgentLocations();
