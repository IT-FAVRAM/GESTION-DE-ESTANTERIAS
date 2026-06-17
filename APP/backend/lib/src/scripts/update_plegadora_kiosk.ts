/**
 * Script para actualizar el kiosk de PLEGADORA (device_1781522157962_dp474z)
 * y agregar acceso a AUTOPLEGADORA (CRP, RPL)
 */

import * as admin from 'firebase-admin';

export async function updatePlegadoraKiosk() {
  const db = admin.firestore();

  // Paso 0: Listar dispositivos para encontrar PLEGADORA
  console.log('🔍 Buscando dispositivos de PLEGADORA...');
  const devicesSnap = await db.collection('dispositivos').get();
  let targetDevice = null;
  let deviceId = '';

  for (const doc of devicesSnap.docs) {
    const data = doc.data() as any;
    if (data.name?.includes('Plegador') || data.assignedShelf === 'PLE' || doc.id.includes('ple') || doc.id.includes('plegador')) {
      console.log(`  ✓ Encontrado: ${doc.id} (${data.name || 'sin nombre'}, shelf: ${data.assignedShelf || 'N/A'})`);
      targetDevice = { id: doc.id, ...data };
      deviceId = doc.id;
      break;
    }
  }

  if (!targetDevice) {
    console.log('  Listando todos los dispositivos:');
    for (const doc of devicesSnap.docs) {
      const data = doc.data() as any;
      console.log(`  - ${doc.id}: ${data.name || 'sin nombre'} (shelf: ${data.assignedShelf || 'N/A'})`);
    }
    return { ok: false, error: 'No PLEGADORA device found', availableDevices: devicesSnap.docs.map(d => ({ id: d.id, ...d.data() })) };
  }

  // Paso 1: Usar el dispositivo encontrado
  const deviceDoc = await db.collection('dispositivos').doc(deviceId).get();

  if (!deviceDoc.exists) {
    console.error(`❌ Dispositivo no encontrado: ${deviceId}`);
    return { ok: false, error: 'Device not found' };
  }

  const device = deviceDoc.data() as any;
  let kioskId = device.kioskId;
  const assignedShelf = device.assignedShelf; // Probablemente 'PLE'

  console.log(`📱 Device: ${deviceId}`);
  console.log(`🏷️ KioskId: ${kioskId}`);
  console.log(`📦 Assigned Shelf: ${assignedShelf}`);

  // Si no tiene kioskId, usar el deviceId como kioskId
  if (!kioskId) {
    console.log(`⚠️ Dispositivo sin kioskId, usando deviceId como kioskId`);
    kioskId = deviceId;
    // Actualizar el dispositivo con el kioskId
    await db.collection('dispositivos').doc(deviceId).update({ kioskId });
    console.log(`✅ Dispositivo actualizado con kioskId: ${kioskId}`);
  }

  // Paso 2: Actualizar el documento del kiosk
  const kioskRef = db.collection('kiosks').doc(kioskId);
  const kioskDoc = await kioskRef.get();

  if (!kioskDoc.exists) {
    console.log(`⚠️ Kiosk no existe, creando...`);
    // Crear el documento del kiosk si no existe
    const shelves = [assignedShelf, 'CRP', 'RPL'].filter(Boolean);
    await kioskRef.set({
      id: kioskId,
      name: 'Plegadora',
      shelves,
      location: 'Plegadora',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`✅ Kiosk creado con estanterías: ${shelves.join(', ')}`);
  } else {
    // Actualizar el documento existente
    const kioskData = kioskDoc.data() as any;
    const currentShelves = kioskData.shelves || [assignedShelf];
    const newShelves = Array.from(new Set([...currentShelves, 'CRP', 'RPL'])).filter(Boolean);

    console.log(`📝 Estanterías actuales: ${currentShelves.join(', ')}`);
    console.log(`📝 Nuevas estanterías: ${newShelves.join(', ')}`);

    await kioskRef.update({
      shelves: newShelves,
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ Kiosk actualizado`);
  }

  return {
    ok: true,
    deviceId,
    kioskId,
    shelves: ['PLE', 'CRP', 'RPL'],
  };
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const serviceAccount = require('../../../../../serviceAccount.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'gestion-de-estanterias',
  });

  updatePlegadoraKiosk()
    .then((result) => {
      console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Error:', err);
      process.exit(1);
    });
}
