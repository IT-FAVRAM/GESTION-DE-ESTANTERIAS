#!/usr/bin/env node
/**
 * configure_autoplegadora_kiosk — Configura el kiosko de autoplegadora
 *
 * Tareas:
 *  1. Excluir el carro CRP (Amada) del kiosko de autoplegadora
 *  2. Configurar el dispositivo device_1781329826263_q6upe7 como visual-only
 *
 * Uso (desde APP/backend):
 *   npm run build && node lib/scripts/configure_autoplegadora_kiosk.js
 */

import { admin } from '../firebaseAdmin';

async function configureKiosk() {
  const db = admin.firestore();

  const DEVICE_ID = 'device_1781153902325_5sapp5'; // Kiosko Autoplegadora
  const EXCLUDED_CART = 'CRP'; // Amada

  console.log('🔧 Configurando kiosko de autoplegadora...');
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
    console.log(`  - Activo: ${device.active !== false ? 'Sí' : 'No'}`);
    console.log(`  - KioskId: ${device.kioskId || 'N/A'}`);

    // ── 2. Actualizar el dispositivo ──────────────────────────────────────
    console.log(`\n⚙️ Actualizando configuración...`);

    const updates = {
      excludedCarts: [EXCLUDED_CART],
      visualOnly: true,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('dispositivos').doc(DEVICE_ID).update(updates);

    console.log(`✅ Dispositivo actualizado:`);
    console.log(`  - Carros excluidos: [${EXCLUDED_CART}]`);
    console.log(`  - Modo visual-only: Sí`);

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

  configureKiosk()
    .then((result) => {
      console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ Error fatal:', err);
      process.exit(1);
    });
}
