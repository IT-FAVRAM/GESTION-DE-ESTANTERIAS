const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'gestion-de-estanterias',
});

const db = admin.firestore();
const auth = admin.auth();

async function checkUser() {
  try {
    // Buscar usuario por email
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              VERIFICACIÓN DE USUARIO H                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Desde Auth
    console.log('📱 Firebase Auth:');
    try {
      const userRecord = await auth.getUserByEmail('h@favram.com');
      console.log('   ✓ Email encontrado: h@favram.com');
      console.log('   ✓ UID:', userRecord.uid);
      console.log('   ✓ Display Name:', userRecord.displayName);
    } catch (err) {
      console.log('   ✗ No encontrado por email:', err.message);
    }

    // Desde Firestore
    console.log('\n📄 Firestore (usuarios):');
    const snapshot = await db.collection('usuarios').where('email', '==', 'h@favram.com').get();
    if (!snapshot.empty) {
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log('   ✓ UID:', doc.id);
        console.log('   ✓ Email:', data.email);
        console.log('   ✓ Role:', data.role);
        console.log('   ✓ Display Name:', data.displayName);
        console.log('   ✓ Login Names:', data.loginNames);
      });
    } else {
      console.log('   ✗ No encontrado en Firestore');
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

checkUser().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
