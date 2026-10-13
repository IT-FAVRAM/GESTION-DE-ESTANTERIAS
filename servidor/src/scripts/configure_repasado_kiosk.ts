#!/usr/bin/env node
/**
 * configure_repasado_kiosk — Configura el kiosko de Repasado
 *
 * Estanterías accesibles:
 *  - REP: Repasado (estantería principal)
 *  - SXP: Soldadura Puntos
 *
 * Uso (desde servidor):
 *   npm run build && node lib/scripts/configure_repasado_kiosk.js
 */

import { admin } from '../firebaseAdmin';

async function configureRepasadoKiosk() {
  const db = admin.firestore();

  const DEVICE_ID = 'REPASADO-1781607300422'; // Kiosko Repasado
  const ALLOWED_SHELVES = ['REP', 'SXP']; // Repasado, Soldadura Puntos

  console.log('🔧 Configurando kiosko de Repasado...');
  console.log('='.repeat(60));

  try {
    // ── 1. Verificar si el dispositivo existe ─────────────────────────────
    console.log(`\n📱 Buscando dispositivo: ${DEVICE_ID}`);
    const deviceDoc = await db.collection('dispositivos').doc(DEVICE_ID).get();

    if (!deviceDoc.exists) {
      console.error(`❌ Dispositivo no encontrado: ${DEVICE_ID}`);
      return { ok: false, error: 'Dispositivo no encontrado' };
    }

    const device = deviceDoc.data() as any;
    console.log(`✓ Encontrado: ${device.name || 'sin nombre'}`);
    console.log(`  - Tipo: ${device.type || 'N/A'}`);
    console.log(`  - Estantería actual: ${device.assignedShelf || 'N/A'}`);

    // ── 2. Actualizar el dispositivo ──────────────────────────────────────
    console.log(`\n⚙️ Actualizando configuración...`);

    const updates = {
      assignedShelf: 'REP', // Mantener REP como principal
      allowedShelves: ALLOWED_SHELVES, // Agregar acceso a SXP
      updatedAt: new Date().toISOString(),
    };

    await db.collection('dispositivos').doc(DEVICE_ID).update(updates);

    console.log(`✅ Dispositivo actualizado:`);
    console.log(`  - Estantería principal: REP`);
    console.log(`  - Estanterías permitidas: [${ALLOWED_SHELVES.join(', ')}]`);

    return {
      ok: true,
      deviceId: DEVICE_ID,
      updates,
    };
  } catch (err) {
    console.error('❌ Error:', err);
    return { ok: false, error: String(err) };
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const serviceAccount = require('../../../../serviceAccount.json');

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

  configureRepasadoKiosk()
    .then((result) => {
      console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ Error fatal:', err);
      process.exit(1);
    });
}
