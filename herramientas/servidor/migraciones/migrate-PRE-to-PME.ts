/**
 * MIGRACIÓN URGENTE: PRE → PME
 *
 * Los datos ubicados en PRENSAS (PRE) necesitan ser migrados a la nueva estantería
 * consolidada PME (PRENSAS-MECANIZADO) porque el frontend ahora busca en PME.
 *
 * Este script:
 * 1. Copia todas las locations de shelves/PRE a shelves/PME
 * 2. Copia todos los items dentro de cada location
 * 3. Copia la metadata de shelf
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';

// Inicializar Firebase Admin SDK
const SA_PATH = require('path').resolve(__dirname, '../../../serviceAccount.json');
const serviceAccount = JSON.parse(fs.readFileSync(SA_PATH, 'utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migratePreToPme() {
  console.log('🔄 INICIANDO MIGRACIÓN: PRE → PME');
  console.log('─'.repeat(60));

  try {
    // 1. Obtener documento de PRE
    console.log('📋 Paso 1: Leyendo shelves/PRE...');
    const preDocRef = db.collection('shelves').doc('PRE');
    const preDoc = await preDocRef.get();

    if (!preDoc.exists) {
      console.error('❌ ERROR: No se encontró shelves/PRE');
      process.exit(1);
    }

    const preData = preDoc.data();
    console.log(`✓ PRE encontrado: ${preData?.name || 'sin nombre'}`);

    // 2. Crear documento PME con los datos de PRE
    console.log('\n📝 Paso 2: Creando shelves/PME con datos de PRE...');
    const pmeData = {
      ...preData,
      code: 'PME',
      name: 'Prensas - Mecanizado',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedFrom: 'PRE',
      migrationDate: new Date().toISOString(),
    };

    await db.collection('shelves').doc('PME').set(pmeData);
    console.log('✓ PME creado');

    // 3. Copiar todas las locations de PRE a PME
    console.log('\n📍 Paso 3: Copiando locations...');
    const locationsSnapshot = await db.collection('shelves').doc('PRE').collection('locations').get();

    if (locationsSnapshot.empty) {
      console.log('⚠️  No hay locations en PRE para copiar');
    } else {
      console.log(`Encontradas ${locationsSnapshot.size} locations`);

      let successCount = 0;
      let itemCount = 0;

      for (const locDoc of locationsSnapshot.docs) {
        const locData = locDoc.data();
        const position = locDoc.id;

        // Copiar location a PME
        await db
          .collection('shelves')
          .doc('PME')
          .collection('locations')
          .doc(position)
          .set(locData);

        // Copiar todos los items de esta location
        const itemsSnapshot = await locDoc.ref.collection('items').get();
        for (const itemDoc of itemsSnapshot.docs) {
          await db
            .collection('shelves')
            .doc('PME')
            .collection('locations')
            .doc(position)
            .collection('items')
            .doc(itemDoc.id)
            .set(itemDoc.data());
          itemCount++;
        }

        successCount++;
      }

      console.log(`✓ ${successCount} locations copiadas`);
      console.log(`✓ ${itemCount} items copiados`);
    }

    // 4. Verificar integridad
    console.log('\n✔️  Paso 4: Verificando integridad...');
    const pmeLocations = await db.collection('shelves').doc('PME').collection('locations').get();
    console.log(`Total de locations en PME: ${pmeLocations.size}`);

    let totalItemsInPme = 0;
    for (const loc of pmeLocations.docs) {
      const items = await loc.ref.collection('items').get();
      totalItemsInPme += items.size;
    }
    console.log(`Total de items en PME: ${totalItemsInPme}`);

    console.log('\n' + '─'.repeat(60));
    console.log('✅ MIGRACIÓN COMPLETADA CON ÉXITO');
    console.log('\nProximos pasos:');
    console.log('1. Verificar que PME funciona correctamente en la app');
    console.log('2. Si todo OK, ejecutar: node scripts/cleanup-old-shelves.ts');
    console.log('   (para eliminar PRE y MEC si es necesario)');

    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR DURANTE LA MIGRACIÓN:', error);
    process.exit(1);
  }
}

migratePreToPme();
