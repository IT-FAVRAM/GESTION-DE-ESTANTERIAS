const admin = require('../../../servidor/node_modules/firebase-admin');
const serviceAccount = require('../../../servidor/serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'gestion-de-estanterias',
});

const db = admin.firestore();

async function addAllowedShelves() {
  await db.collection('dispositivos').doc('user-h-device-sxp').update({
    allowedShelves: ['SXP'],
    updatedAt: new Date().toISOString(),
  });

  console.log('✅ Device H actualizado con allowedShelves: [SXP]');
}

addAllowedShelves().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
