#!/usr/bin/env node
/**
 * update_user_h_role — Cambia el rol de H a CARRETILLERO
 */

import { admin } from '../firebaseAdmin';

async function updateUserH() {
  const db = admin.firestore();

  console.log('🔧 Actualizando rol de usuario H...');
  console.log('='.repeat(60));

  try {
    await db.collection('usuarios').doc('oQeTtvMxJWPmpu9c6dSVHjV5rLV2').set({
      role: 'CARRETILLERO',
      section: null,
      displayName: 'H',
      email: 'h@favram.com',
      loginNames: ['H', 'h'],
      fcmTokens: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log('\n✅ Usuario H actualizado:');
    console.log('   - Nuevo rol: CARRETILLERO');
    console.log('   - Acceso a: SXP (mediante device allowedShelves)');

    return { ok: true };
  } catch (err) {
    console.error('❌ Error:', err);
    return { ok: false, error: String(err) };
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const serviceAccount = require('../../../../../serviceAccount.json');

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'gestion-de-estanterias',
      });
    }
  } catch (err) {
    console.warn('Firebase app already initialized, continuing...');
  }

  updateUserH()
    .then((result) => {
      console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ Error fatal:', err);
      process.exit(1);
    });
}
