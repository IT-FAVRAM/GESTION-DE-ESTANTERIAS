const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'gestion-de-estanterias',
});

const db = admin.firestore();

async function setupUserH() {
  try {
    const deviceId = 'user-h-device-sxp';
    
    console.log('\n🔧 Configurando device para usuario H...');
    console.log('='.repeat(60));

    await db.collection('dispositivos').doc(deviceId).set({
      name: 'Usuario H - SXP',
      type: 'KIOSK',
      assignedShelf: 'SXP',
      active: true,
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log('\n✅ Device creado para H:');
    console.log('   - Device ID: user-h-device-sxp');
    console.log('   - Shelf: SXP');
    console.log('   - Type: KIOSK');

    // También actualizar usuario H para que no tenga section específica
    await db.collection('usuarios').doc('oQeTtvMxJWPmpu9c6dSVHjV5rLV2').set({
      role: 'OPERARIO',
      section: null,  // Sin sección específica
      displayName: 'H',
      email: 'h@favram.com',
      loginNames: ['H', 'h'],
      fcmTokens: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log('\n✅ Usuario H actualizado:');
    console.log('   - Section: null (acceso solo por device)');
    console.log('   - Acceso solo a: SXP');

    return { ok: true };
  } catch (err) {
    console.error('Error:', err);
    return { ok: false, error: String(err) };
  }
}

setupUserH()
  .then((result) => {
    console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
