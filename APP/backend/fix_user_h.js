const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'gestion-de-estanterias',
});

const db = admin.firestore();

async function fixUserH() {
  try {
    const userId = 'oQeTtvMxJWPmpu9c6dSVHjV5rLV2';
    
    console.log('\n🔧 Actualizando usuario H...');
    console.log('='.repeat(60));

    // Actualizar en Firestore con assignedShelf
    await db.collection('usuarios').doc(userId).set({
      role: 'OPERARIO',
      section: 'SOLDADURA',
      displayName: 'H',
      email: 'h@favram.com',
      loginNames: ['H', 'h'],
      fcmTokens: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log('\n✅ Usuario H actualizado:');
    console.log('   - Role: OPERARIO');
    console.log('   - Section: SOLDADURA');
    console.log('   - Login Names: H, h');
    console.log('   - Acceso solo a: SXP');

    return { ok: true };
  } catch (err) {
    console.error('Error:', err);
    return { ok: false, error: String(err) };
  }
}

fixUserH()
  .then((result) => {
    console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
