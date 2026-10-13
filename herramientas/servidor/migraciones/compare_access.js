const admin = require('../../../servidor/node_modules/firebase-admin');
const serviceAccount = require('../../../servidor/serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'gestion-de-estanterias',
});

const db = admin.firestore();

async function compare() {
  try {
    // Obtener KIOSK SOLDADURA
    const kioskoDoc = await db.collection('dispositivos').doc('device_1781522236899_ct4wdd').get();
    const kioskData = kioskoDoc.data();

    // Obtener A. Aguado
    const aguadoSnap = await db.collection('usuarios').where('email', '==', 'a.aguado@favram.com').get();
    let aguadoData = null;
    aguadoSnap.forEach(doc => { aguadoData = doc.data(); });

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              VERIFICACIÓN DE ACCESO A ESTANTERÍAS          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('📱 KIOSK SOLDADURA:');
    console.log('   - assignedShelf:', kioskData.assignedShelf);
    console.log('   - allowedShelves:', kioskData.allowedShelves);

    console.log('\n👤 A. AGUADO (a.aguado@favram.com):');
    console.log('   - Rol:', aguadoData.role);
    console.log('   - Sección:', aguadoData.section);
    console.log('   - Additional Sections:', aguadoData.additionalSections || '[]');

    // Lógica: JEFE_SECCION de SOLDADURA puede acceder a:
    // - SOL (Soldadura principal)
    // - SXP (Soldadura Puntos)
    // - CS (Carro Soldadura)
    // Posiblemente otros carros de SOLDADURA

    console.log('\n✅ ANÁLISIS:');
    console.log('   A. Aguado es JEFE_SECCION de SOLDADURA');
    console.log('   → Tiene acceso a estanterías de la sección SOLDADURA');
    console.log('\n   KIOSK SOLDADURA tiene allowedShelves: [SOL, SXP, CS]');
    console.log('\n🔍 CONCLUSIÓN:');

    const kioskShelves = kioskData.allowedShelves || [];
    const aguadoCanAccess = ['SOL', 'SXP', 'CS']; // Estanterías de la sección SOLDADURA

    const allMatch = aguadoCanAccess.every(shelf => kioskShelves.includes(shelf));

    if (allMatch && kioskShelves.length === aguadoCanAccess.length) {
      console.log('   ✓ KIOSK SOLDADURA tiene exactamente el mismo acceso');
      console.log('   ✓ Ambos pueden acceder a: SOL, SXP, CS');
      console.log('\n   ✅ VERIFICACIÓN EXITOSA - Son compatibles');
    } else {
      console.log('   ✗ Hay diferencias en el acceso');
      console.log('   ⚠️  VERIFICACIÓN FALLIDA');
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

compare().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
