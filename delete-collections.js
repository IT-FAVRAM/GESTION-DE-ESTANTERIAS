#!/usr/bin/env node

/**
 * Script para eliminar colecciones deprecated de Firestore
 * Uso: firebase login, luego node delete-collections.js
 */

const admin = require('firebase-admin');

// Inicializar con credenciales de la CLI de Firebase (no requiere serviceAccountKey.json)
const projectId = 'gestion-de-estanterias';

admin.initializeApp({
  projectId: projectId,
});

const db = admin.firestore();

// Colecciones a eliminar
const collectionsToDelete = [
  'tablets',
  'piezas_agregadas',
  'avisos',
  'chat_mensajes',
  'piezas_en_curso',
  'piezas_terminadas'
];

async function deleteCollection(collectionPath) {
  try {
    console.log(`\nEliminando colección: /${collectionPath}/`);

    const collectionRef = db.collection(collectionPath);
    const docs = await collectionRef.listDocuments();

    console.log(`  → Encontrados ${docs.length} documentos`);

    // Eliminar documentos en lotes
    const batchSize = 100;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = docs.slice(i, i + batchSize);

      for (const doc of batchDocs) {
        batch.delete(doc);
      }

      await batch.commit();
      console.log(`  ✓ Eliminados ${Math.min(batchSize, docs.length - i)} documentos`);
    }

    if (docs.length === 0) {
      console.log(`  ✓ Colección vacía (sin documentos para eliminar)`);
    }

    return true;
  } catch (error) {
    console.error(`  ✗ Error eliminando /${collectionPath}/:`, error.message);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Eliminando Colecciones Deprecated de Firestore           ║');
  console.log('║   Proyecto: gestion-de-estanterias                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  let successCount = 0;

  for (const collection of collectionsToDelete) {
    const success = await deleteCollection(collection);
    if (success) successCount++;
  }

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║ RESULTADO: ${successCount}/${collectionsToDelete.length} colecciones procesadas      ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  process.exit(successCount === collectionsToDelete.length ? 0 : 1);
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
