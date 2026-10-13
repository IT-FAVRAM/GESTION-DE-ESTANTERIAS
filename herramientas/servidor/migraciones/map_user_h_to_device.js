const admin = require('../../../servidor/node_modules/firebase-admin');
const serviceAccount = require('../../../servidor/serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'gestion-de-estanterias',
});

const db = admin.firestore();

async function mapUserToDevice() {
  try {
    // Agregar metadata en el usuario que lo asocie al device
    await db.collection('usuarios').doc('oQeTtvMxJWPmpu9c6dSVHjV5rLV2').set({
      preferredDevice: 'user-h-device-sxp', // Mapeo usuario -> device
    }, { merge: true });

    console.log('✅ Usuario H mapeado al device user-h-device-sxp');
    return { ok: true };
  } catch (err) {
    console.error('Error:', err);
    return { ok: false };
  }
}

mapUserToDevice().then(() => process.exit(0)).catch(() => process.exit(1));
