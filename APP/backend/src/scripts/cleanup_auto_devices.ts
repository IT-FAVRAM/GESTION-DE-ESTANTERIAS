#!/usr/bin/env node
/**
 * cleanup_auto_devices — Elimina dispositivos "Auto-X" basura
 *
 * Estos dispositivos se autoregistraron como CARRETILLERO sin assignedShelf ni kioskId.
 * Son ~37 docs con name patrón "Auto-*".
 *
 * Salvaguardas:
 *  - Nunca tocar docs con kioskId (dispositivos kiosko legítimos)
 *  - Listado previo en dry-run
 *  - Flag --include-legacy para revisar colección legacy `devices`
 *
 * Uso (desde APP/backend):
 *   npm run build && node lib/scripts/cleanup_auto_devices.js          # dry-run
 *   npm run build && node lib/scripts/cleanup_auto_devices.js --apply  # aplica
 *   npm run build && node lib/scripts/cleanup_auto_devices.js --include-legacy  # incluir colección legacy
 */

import { admin } from '../firebaseAdmin';

async function cleanup() {
  const db = admin.firestore();
  const apply = process.argv.includes('--apply');
  const includeLegacy = process.argv.includes('--include-legacy');

  console.log(`🧹 Limpieza de dispositivos Auto-X (${apply ? 'APLICAR' : 'DRY-RUN'})`);
  console.log('='.repeat(60));

  // ── 1. Buscar en colección principal `dispositivos` ──────────────────────
  console.log('\n📦 Buscando en colección "dispositivos"...');
  const dispositivosSnap = await db.collection('dispositivos').get();

  const autoDevices: Array<{ id: string; name: string; type: string; kioskId?: string }> = [];

  for (const doc of dispositivosSnap.docs) {
    const data = doc.data();
    const name = data.name || '';
    const type = data.type || '';
    const kioskId = data.kioskId;

    // Filtrar: nombre "Auto-*" SIN estantería asignada NI kioskId (type-agnóstico:
    // el auto-registro creaba KIOSK o CARRETILLERO). Los kioskos legítimos tienen
    // assignedShelf y/o kioskId y nombres propios, así que quedan protegidos.
    if (name.startsWith('Auto-') && !kioskId && !data.assignedShelf) {
      autoDevices.push({
        id: doc.id,
        name,
        type,
        kioskId,
      });
    }
  }

  console.log(`   Encontrados ${autoDevices.length} dispositivos "Auto-X" en "dispositivos"`);

  if (autoDevices.length > 0) {
    console.log('\n   Listado:');
    for (const device of autoDevices) {
      console.log(`   ${apply ? '🗑️ ' : '❌'} ${device.id}: ${device.name} (${device.type})`);
    }

    if (apply) {
      console.log('\n   Eliminando...');
      const batch = db.batch();
      for (const device of autoDevices) {
        const docRef = db.collection('dispositivos').doc(device.id);
        batch.delete(docRef);
      }
      await batch.commit();
      console.log(`   ✅ ${autoDevices.length} dispositivo(s) eliminado(s)`);
    }
  } else {
    console.log('   ✅ No se encontraron dispositivos "Auto-X"');
  }

  // ── 2. Revisar colección legacy `devices` (opcional) ─────────────────────
  if (includeLegacy) {
    console.log('\n📦 Buscando en colección legacy "devices"...');
    try {
      const devicesSnap = await db.collection('devices').get();

      const legacyAutoDevices: Array<{ id: string; name: string; type: string; kioskId?: string }> = [];

      for (const doc of devicesSnap.docs) {
        const data = doc.data();
        const name = data.name || '';
        const type = data.type || '';
        const kioskId = data.kioskId;

        if (name.startsWith('Auto-') && !kioskId && !data.assignedShelf) {
          legacyAutoDevices.push({
            id: doc.id,
            name,
            type,
            kioskId,
          });
        }
      }

      console.log(`   Encontrados ${legacyAutoDevices.length} dispositivos "Auto-X" en "devices"`);

      if (legacyAutoDevices.length > 0) {
        console.log('\n   Listado:');
        for (const device of legacyAutoDevices) {
          console.log(`   ${apply ? '🗑️ ' : '❌'} ${device.id}: ${device.name} (${device.type})`);
        }

        if (apply) {
          console.log('\n   Eliminando...');
          const batch = db.batch();
          for (const device of legacyAutoDevices) {
            const docRef = db.collection('devices').doc(device.id);
            batch.delete(docRef);
          }
          await batch.commit();
          console.log(`   ✅ ${legacyAutoDevices.length} dispositivo(s) legacy eliminado(s)`);
        }
      } else {
        console.log('   ✅ No se encontraron dispositivos "Auto-X" en legacy');
      }
    } catch (err) {
      console.log('   ⚠️  Colección "devices" no existe o no es accesible');
    }
  }

  // ── 3. Tablet Honor ─────────────────────────────────────────────────────
  console.log('\n📱 Tablet Honor C431E4R2P1:');
  const honorRef = db.collection('dispositivos').doc('C431E4R2P1');
  const honorSnap = await honorRef.get();

  if (honorSnap.exists) {
    const current = honorSnap.data()!;
    const needsUpdate = current.active !== false || current.ownerUid !== 'KlHKtbcUTcc3T4VAfZ7bjmYDuLp1';

    if (needsUpdate) {
      console.log(`   Estado actual: active=${current.active}, ownerUid=${current.ownerUid || '(none)'}`);
      console.log(`   ${apply ? '✍️ ' : '❌'} Actualizando: active=false, owner=Oscar`);

      if (apply) {
        await honorRef.update({
          active: false,
          ownerUid: 'KlHKtbcUTcc3T4VAfZ7bjmYDuLp1',
          ownerName: 'Oscar',
          note: 'Tablet Honor Pad X8a asignada a Oscar (carretillero)',
          updatedAt: new Date().toISOString(),
        });
        console.log('   ✅ Actualizada');
      }
    } else {
      console.log('   ✅ OK — ya configurada correctamente');
    }
  } else {
    console.log('   ⚠️  Documento no encontrado');
  }

  // ── Resumen ──────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  if (!apply) {
    console.log('⚠️  DRY-RUN — nada escrito. Ejecuta con --apply para aplicar.');
  } else {
    console.log('✅ Limpieza completada.');
  }
}

cleanup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error en la limpieza:', err);
    process.exit(1);
  });
