#!/usr/bin/env node
/**
 * configure_soldadura_kiosk — Configura el kiosko de Soldadura
 *
 * Tareas:
 *  1. Establecer estanterías accesibles: SOL, SXP
 *  2. Permitir acceso a Carro Soldadura (CS)
 *  3. Permitir acceso a Carro Plegadora Amada (CRP)
 *
 * Uso (desde APP/backend):
 *   npm run build && node lib/scripts/configure_soldadura_kiosk.js
 */

import { admin } from '../firebaseAdmin';

async function configureSoldaduraKiosk() {
  const db = admin.firestore();

  const DEVICE_ID = 'device_1781522236899_ct4wdd'; // Kiosko Soldadura
  const ALLOWED_SHELVES = ['SOL', 'SXP', 'CS', 'CRP']; // Soldadura, Puntos, Carro Soldadura, Carro Plegadora Amada

  console.log('🔧 Configurando kiosko de Soldadura...');
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
      assignedShelf: 'SOL', // Mantener SOL como principal
      allowedShelves: ALLOWED_SHELVES, // Agregar acceso a múltiples
      updatedAt: new Date().toISOString(),
    };

    await db.collection('dispositivos').doc(DEVICE_ID).update(updates);

    console.log(`✅ Dispositivo actualizado:`);
    console.log(`  - Estantería principal: SOL`);
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

  configureSoldaduraKiosk()
    .then((result) => {
      console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ Error fatal:', err);
      process.exit(1);
    });
}
