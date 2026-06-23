#!/usr/bin/env node
/**
 * Cambia contraseñas de FAVRAMXXX → XXX (solo números)
 * EXCEPTO Oscar y Raul (carretilleros)
 *
 * Uso:
 *   npm run build && node lib/src/scripts/change_passwords_format.js
 */

import { admin } from '../firebaseAdmin';

async function changePasswordsFormat() {
  try {
    const auth = admin.auth();
    const db = admin.firestore();

    console.log('🔍 Obteniendo lista de usuarios...\n');

    // 1. Listar todos los usuarios en Firebase Auth
    let allUsers: any[] = [];
    let pageToken: string | undefined;

    do {
      const result = await auth.listUsers(1000, pageToken);
      allUsers = allUsers.concat(result.users);
      pageToken = result.pageToken;
    } while (pageToken);

    // 2. Obtener docs de usuarios en Firestore
    const usuariosSnap = await db.collection('usuarios').get();
    const usuariosMap: Record<string, any> = {};
    usuariosSnap.forEach(doc => {
      usuariosMap[doc.id] = doc.data();
    });

    // Excepciones: Oscar y Raul mantienen sus contraseñas
    const EXCEPTIONS = new Set([
      'oscar@carretillero.wms.local',
      'raul@carretillero.wms.local'
    ]);

    console.log('📊 Procesando cambios de contraseña...\n');

    // Mapear email → nueva contraseña (solo números)
    const passwordMap: Record<string, string> = {
      'a.aguado@favram.com': '014',
      'e.sancetta@favram.com': '015',
      'a.barrientos@favram.com': '016',
      'r.mendieta@favram.com': '017',
      'd.soler@favram.com': '018',
      'v.torbellino@favram.com': '019',
      'i.hernandez@favram.com': '020',
      'calidad@favram.com': '021',
      'k.rodriguez@favram.com': '022',
      'h.juvera@favram.com': '023',
      'l.asensio@favram.com': '024',
      'f.espinosa@favram.com': '025',
      'j.jimenez@favram.com': '026',
      'a.cuevas@favram.com': '027',
      'jc.rodriguez@favram.com': '028',
      'l.gil@favram.com': '029',
      'd.fernandez@favram.com': '030',
      'jm.gomez@favram.com': '031',
      's.raboso@favram.com': '032',
      'administracion@favram.com': '033',
      'j.diaz@favram.com': '034',
      // Mario
      'mario@jefe-soldadura.wms.local': '047',
    };

    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of allUsers) {
      if (!user.email) continue;

      // Omitir excepciones
      if (EXCEPTIONS.has(user.email)) {
        console.log(`⏭️  ${user.email} - Omitido (carretillero, excepción)`);
        skippedCount++;
        continue;
      }

      const newPassword = passwordMap[user.email];
      if (!newPassword) {
        console.log(`⏭️  ${user.email} - No en mapa de conversión`);
        continue;
      }

      // Firebase requiere 6+ caracteres: rellenar a 6 dígitos con ceros al inicio
      const finalPassword = newPassword.padStart(6, '0');

      try {
        await auth.updateUser(user.uid, {
          password: finalPassword,
        });
        console.log(`✅ ${user.email} → ${finalPassword}`);
        updatedCount++;
      } catch (error: any) {
        console.log(`❌ ${user.email} - Error: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 Resumen de cambios');
    console.log('='.repeat(70));
    console.log(`✅ Actualizadas: ${updatedCount}`);
    console.log(`⏭️  Omitidas: ${skippedCount}`);
    console.log('='.repeat(70));

    console.log('\n⚠️  NOTA: Nuevas contraseñas son solo números (XXX)');
    console.log('   Excepciones: Oscar y Raul mantienen FAVRAMXXX');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error general:');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

changePasswordsFormat();
