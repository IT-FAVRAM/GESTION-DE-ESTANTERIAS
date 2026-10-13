#!/usr/bin/env node
/**
 * configure_autoplegadora_kiosk — Configura el kiosko de autoplegadora
 *
 * Tareas:
 *  1. Habilitar acciones (UBICAR/RETIRAR/MOVER) quitando visualOnly
 *  2. Configurar allowedShelves para que el OPERARIO acceda a RPL, ARO y CAM
 *
 * Uso (desde servidor):
 *   npm run build && node lib/scripts/configure_autoplegadora_kiosk.js
 */

import { admin } from '../firebaseAdmin';

async function configureKiosk() {
  const db = admin.firestore();

  const DEVICE_ID = 'device_1781153902325_5sapp5'; // Kiosko Autoplegadora
  const ALLOWED_SHELVES = ['RPL', 'ARO', 'CAM']; // Autoplegadora, Autoroscadora, Carro Amada

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
      excludedCarts: [],
      visualOnly: false,
      allowedShelves: ALLOWED_SHELVES,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('dispositivos').doc(DEVICE_ID).update(updates);

    console.log(`✅ Dispositivo actualizado:`);
    console.log(`  - Carros excluidos: [] (todos visibles)`);
    console.log(`  - Modo visual-only: No (acciones habilitadas)`);
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
