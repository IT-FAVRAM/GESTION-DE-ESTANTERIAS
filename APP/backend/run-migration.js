/**
 * Script para ejecutar la migración PRE → PME desde el cliente
 * Llama a la Cloud Function migratPreToPme
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccount.json');

// Inicializar Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function runMigration() {
  console.log('\n🔄 EJECUTANDO MIGRACIÓN: PRE → PME');
  console.log('━'.repeat(60));

  try {
    // Obtener la función callable
    const functions = admin.functions('us-central1');
    const migratPreToPme = functions.httpsCallable('migratPreToPme');

    // Ejecutar la función
    console.log('📡 Llamando a Cloud Function migratPreToPme...\n');
    const result = await migratPreToPme();

    console.log('✅ RESULTADO:');
    console.log(JSON.stringify(result.data, null, 2));

    if (result.data.success) {
      console.log('\n✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
      console.log(`   - ${result.data.locationCount} locations migradas`);
      console.log(`   - ${result.data.itemCount} items migrados`);
      console.log('\n🎉 Los artículos de PRENSAS ya deberían aparecer en el sistema');
    } else {
      console.log('\n❌ MIGRACIÓN FALLÓ:');
      console.log(result.data.error);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error);
    process.exit(1);
  }
}

runMigration();
