#!/usr/bin/env node
/**
 * migrate_section_prensas_mecanizado — Actualiza Firestore para reflejar la
 * fusión de las secciones MECANIZADO y PRENSAS en una sola: PRENSAS_MECANIZADO.
 *
 * Cambios que aplica:
 *  1. Kiosk 'kiosko-mecanizado': actualiza el campo `name` a 'Prensas-Mecanizado'
 *     (los `shelves: ['MEC', 'PRE']` se conservan sin cambio).
 *  2. Usuarios con section 'MECANIZADO' o 'PRENSAS': migra a 'PRENSAS_MECANIZADO'.
 *
 * Uso (desde APP/backend):
 *   npm run build && node lib/scripts/migrate_section_prensas_mecanizado.js          # dry-run
 *   npm run build && node lib/scripts/migrate_section_prensas_mecanizado.js --apply  # aplica
 */

import { admin } from '../firebaseAdmin';

const APPLY = process.argv.includes('--apply');
const db = admin.firestore();

const log = (msg: string) => console.log(`[${APPLY ? 'APPLY' : 'DRY-RUN'}] ${msg}`);

async function migrateKiosk() {
  const kioskRef = db.collection('kiosks').doc('kiosko-mecanizado');
  const snap = await kioskRef.get();

  if (!snap.exists) {
    log('Kiosk kiosko-mecanizado: no existe en Firestore (nada que migrar)');
    return;
  }

  const data = snap.data()!;
  if (data.name === 'Prensas-Mecanizado') {
    log('Kiosk kiosko-mecanizado: ya tiene el nombre correcto, sin cambios');
    return;
  }

  log(`Kiosk kiosko-mecanizado: "${data.name}" → "Prensas-Mecanizado"`);
  if (APPLY) {
    await kioskRef.update({ name: 'Prensas-Mecanizado', updatedAt: new Date().toISOString() });
    log('Kiosk actualizado ✓');
  }
}

async function migrateUsers() {
  const usersRef = db.collection('usuarios');
  const oldSections = ['MECANIZADO', 'PRENSAS'];

  let total = 0;
  for (const oldSection of oldSections) {
    const snap = await usersRef.where('section', '==', oldSection).get();
    if (snap.empty) {
      log(`Usuarios con section='${oldSection}': ninguno`);
      continue;
    }

    for (const userDoc of snap.docs) {
      const data = userDoc.data();
      log(`Usuario ${userDoc.id} (${data.displayName || data.email || '?'}): section '${oldSection}' → 'PRENSAS_MECANIZADO'`);
      if (APPLY) {
        await userDoc.ref.update({ section: 'PRENSAS_MECANIZADO' });
      }
      total++;
    }
  }

  if (total === 0) {
    log('No hay usuarios con section MECANIZADO o PRENSAS que migrar');
  } else if (APPLY) {
    log(`${total} usuario(s) migrado(s) a PRENSAS_MECANIZADO ✓`);
  } else {
    log(`${total} usuario(s) serían migrados (ejecuta con --apply para aplicar)`);
  }
}

async function main() {
  log('=== Migración: MECANIZADO + PRENSAS → PRENSAS_MECANIZADO ===');
  if (!APPLY) log('Modo DRY-RUN — no se escribe nada. Añade --apply para ejecutar.');

  await migrateKiosk();
  await migrateUsers();

  log('=== Migración finalizada ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error en la migración:', err);
  process.exit(1);
});
