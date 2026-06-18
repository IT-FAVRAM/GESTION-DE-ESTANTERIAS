const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'gestion-de-estanterias',
});

const db = admin.firestore();

async function getUser() {
  try {
    const snapshot = await db.collection('usuarios').where('email', '==', 'a.aguado@favram.com').get();
    
    if (snapshot.empty) {
      console.log('Usuario no encontrado');
      return;
    }

    snapshot.forEach(doc => {
      console.log('═══════════════════════════════════════════');
      console.log('A. AGUADO USER DATA:');
      console.log('═══════════════════════════════════════════');
      console.log('UID:', doc.id);
      const data = doc.data();
      console.log('Email:', data.email);
      console.log('Role:', data.role);
      console.log('Section:', data.section);
      console.log('Additional Sections:', data.additionalSections);
      console.log('Display Name:', data.displayName);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

getUser().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
