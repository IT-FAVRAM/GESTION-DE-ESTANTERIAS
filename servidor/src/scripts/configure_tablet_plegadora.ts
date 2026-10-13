#!/usr/bin/env node
/**
 * configure_tablet_plegadora — Configura la tablet de Plegadora en Firestore
 *
 * Transforma la tablet que anteriormente era de PINTURA en un kiosko de PLEGADORA.
 *
 * Tareas:
 *  1. Actualizar el dispositivo en 'dispositivos' con los campos de plegadora
 *  2. Crear/actualizar el documento del kiosk en 'kiosks'
 *
 * Uso (desde servidor):
 *   npm run build && node lib/scripts/configure_tablet_plegadora.js
 */

import { admin } from '../firebaseAdmin';

const DEVICE_ID = 'device_1781787230852_y56p4q';
const KIOSK_ID = 'device_1781787230852_y56p4q';
const ASSIGNED_SHELF = 'PLE';
const ALLOWED_SHELVES = ['PLE', 'CP1', 'CP2', 'CAM', 'CRP', 'RPL'];

async function configureTabletPlegadora() {
  const db = admin.firestore();

  console.log('🔧 Configurando tablet de Plegadora...');
  console.log('='.repeat(60));
  console.log(`📱 Device ID: ${DEVICE_ID}`);
  console.log(`📦 Shelf: ${ASSIGNED_SHELF}`);
  console.log(`📋 Allowed: [${ALLOWED_SHELVES.join(', ')}]`);

  try {
    // ── 1. Verificar si el dispositivo existe ─────────────────────────────
    console.log(`\n1️⃣  Buscando dispositivo en Firestore...`);
    const deviceDoc = await db.collection('dispositivos').doc(DEVICE_ID).get();

    if (!deviceDoc.exists) {
      console.error(`❌ Dispositivo no encontrado: ${DEVICE_ID}`);
      return { ok: false, error: 'Dispositivo no encontrado' };
    }

    const device = deviceDoc.data() as any;
    console.log(`✓ Encontrado: ${device.name || 'sin nombre'}`);
    console.log(`  - KioskId actual: ${device.kioskId || 'N/A'}`);
    console.log(`  - Shelf actual: ${device.assignedShelf || 'N/A'}`);

    // ── 2. Actualizar el dispositivo ──────────────────────────────────────
    console.log(`\n2️⃣  Actualizando dispositivo...`);

    const deviceUpdates = {
      name: 'Tablet Plegadora',
      type: 'KIOSK',
      active: true,
      kioskId: KIOSK_ID,
      assignedShelf: ASSIGNED_SHELF,
      allowedShelves: ALLOWED_SHELVES,
      note: 'Tablet asignada al kiosko de Plegadora',
      updatedAt: new Date().toISOString(),
    };

    await db.collection('dispositivos').doc(DEVICE_ID).update(deviceUpdates);

    console.log(`✅ Dispositivo actualizado:`);
    console.log(`  - Nombre: ${deviceUpdates.name}`);
    console.log(`  - KioskId: ${deviceUpdates.kioskId}`);
    console.log(`  - Shelf: ${deviceUpdates.assignedShelf}`);
    console.log(`  - Allowed: [${deviceUpdates.allowedShelves.join(', ')}]`);

    // ── 3. Crear/actualizar documento del kiosk ───────────────────────────
    console.log(`\n3️⃣  Actualizando documento kiosk...`);

    const kioskRef = db.collection('kiosks').doc(KIOSK_ID);
    const kioskDoc = await kioskRef.get();

    if (!kioskDoc.exists) {
      console.log(`  Creando nuevo documento kiosk...`);
      await kioskRef.set({
        id: KIOSK_ID,
        name: 'Kiosko Plegadora',
        shelves: ALLOWED_SHELVES,
        location: 'Plegadora',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log(`✅ Kiosk creado con estanterías: ${ALLOWED_SHELVES.join(', ')}`);
    } else {
      console.log(`  Actualizando kiosk existente...`);
      await kioskRef.update({
        name: 'Kiosko Plegadora',
        shelves: ALLOWED_SHELVES,
        isActive: true,
        updatedAt: new Date().toISOString(),
      });
      console.log(`✅ Kiosk actualizado con estanterías: ${ALLOWED_SHELVES.join(', ')}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Configuración completada con éxito');

    return {
      ok: true,
      deviceId: DEVICE_ID,
      kioskId: KIOSK_ID,
      shelves: ALLOWED_SHELVES,
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

  configureTabletPlegadora()
    .then((result) => {
      console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ Error fatal:', err);
      process.exit(1);
    });
}
