/**
 * Script para crear los documentos de carros CP1 y CP2 en Firestore
 * si no existen ya.
 */

import * as admin from 'firebase-admin';

export async function createPlegadoraCarts() {
  const db = admin.firestore();

  const carts = [
    {
      code: 'CP1',
      name: 'Carro Plegadora 1',
      section: 'PLEGADORA',
      type: 'cart',
      locationCount: 4,
    },
    {
      code: 'CP2',
      name: 'Carro Plegadora 2',
      section: 'PLEGADORA',
      type: 'cart',
      locationCount: 4,
    },
  ];

  for (const cart of carts) {
    const shelfRef = db.collection('shelves').doc(cart.code);
    const shelfDoc = await shelfRef.get();

    if (!shelfDoc.exists) {
      console.log(`📝 Creando carro: ${cart.code} (${cart.name})`);

      // Crear estructura de ubicaciones
      const locations: Record<string, unknown> = {};
      for (let i = 1; i <= cart.locationCount; i++) {
        locations[String(i)] = {
          position: String(i),
          items: [],
          occupied: 0,
          available: 0,
          totalCapacity: 1,
        };
      }

      await shelfRef.set({
        ...cart,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Crear documentos de ubicaciones
      const locationsRef = shelfRef.collection('locations');
      for (let i = 1; i <= cart.locationCount; i++) {
        const pos = String(i);
        await locationsRef.doc(pos).set({
          position: pos,
          items: [],
          occupied: 0,
          available: 0,
          totalCapacity: 1,
        });
      }

      console.log(`✅ Carro creado: ${cart.code}`);
    } else {
      console.log(`⏭️ Carro ya existe: ${cart.code}`);
    }
  }

  return {
    ok: true,
    message: 'Carros de PLEGADORA verificados/creados',
  };
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const serviceAccount = require('../../../../../serviceAccount.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'gestion-de-estanterias',
  });

  createPlegadoraCarts()
    .then((result) => {
      console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Error:', err);
      process.exit(1);
    });
}
