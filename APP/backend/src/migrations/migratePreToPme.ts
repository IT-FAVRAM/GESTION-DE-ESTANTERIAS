/**
 * @deprecated ESTA MIGRACIÓN YA FUE EJECUTADA. NO VOLVER A EJECUTAR.
 * Cloud Function deshabilitada — eliminada de index.ts exports.
 * Archivo mantenido solo como referencia histórica.
 *
 * Uso original: Copiar datos de shelves/PRE → shelves/PME (una sola vez).
 */

import * as functions from 'firebase-functions';
import { admin } from '../firebaseAdmin';

const db = admin.firestore();

export const migratPreToPme = functions.https.onCall(async (data, context) => {
  // Verificar que el usuario es admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes estar autenticado');
  }

  const operarioId = context.auth.uid;
  console.log(`[MigratPreToPme] Iniciado por operario: ${operarioId}`);

  try {
    // 1. Obtener documento PRE
    const preRef = db.collection('shelves').doc('PRE');
    const preDoc = await preRef.get();

    if (!preDoc.exists) {
      return {
        success: false,
        error: 'No se encontró shelves/PRE',
      };
    }

    console.log('[MigratPreToPme] PRE encontrado, iniciando migración...');

    const preData = preDoc.data();

    // 2. Crear PME con datos de PRE
    const pmeData = {
      ...preData,
      code: 'PME',
      name: 'Prensas - Mecanizado',
      updatedAt: new Date(),
      migratedFrom: 'PRE',
      migrationDate: new Date().toISOString(),
    };

    await db.collection('shelves').doc('PME').set(pmeData);
    console.log('[MigratPreToPme] PME creado');

    // 3. Copiar todas las locations
    const locationsSnapshot = await db
      .collection('shelves')
      .doc('PRE')
      .collection('locations')
      .get();

    let locationCount = 0;
    let itemCount = 0;

    for (const locDoc of locationsSnapshot.docs) {
      const locId = locDoc.id;
      const locData = locDoc.data();

      // Copiar location
      await db
        .collection('shelves')
        .doc('PME')
        .collection('locations')
        .doc(locId)
        .set(locData);

      locationCount++;

      // Copiar items de esta location
      const itemsSnapshot = await locDoc.ref.collection('items').get();

      for (const itemDoc of itemsSnapshot.docs) {
        const itemId = itemDoc.id;
        const itemData = itemDoc.data();

        await db
          .collection('shelves')
          .doc('PME')
          .collection('locations')
          .doc(locId)
          .collection('items')
          .doc(itemId)
          .set(itemData);

        itemCount++;
      }
    }

    console.log(`[MigratPreToPme] Migración completada: ${locationCount} locations, ${itemCount} items`);

    return {
      success: true,
      message: `Migración completada: ${locationCount} locations y ${itemCount} items`,
      locationCount,
      itemCount,
    };
  } catch (error) {
    console.error('[MigratPreToPme] Error:', error);
    return {
      success: false,
      error: `Error durante la migración: ${error}`,
    };
  }
});
