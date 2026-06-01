/**
 * Script: Actualizar qualityEmails en config/app
 * Añade a Elisabetta (e.sancetta@favram.com) a la lista de notificaciones de CALIDAD
 *
 * Ejecutar: npx ts-node scripts/update-quality-emails.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccount.json';
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT || 'gestion-de-estanterias' });
}

const db = admin.firestore();

async function updateQualityEmails() {
  console.log('📧 ACTUALIZAR NOTIFICACIONES DE CALIDAD\n');
  console.log('Objetivo: Incluir a Roberto, Luis y Elisabetta\n');

  try {
    const configDoc = await db.collection('config').doc('app').get();
    const currentConfig = configDoc.data() || {};

    const currentEmails = currentConfig.qualityEmails || [];
    console.log('📍 Emails actuales en qualityEmails:');
    if (currentEmails.length === 0) {
      console.log('  (vacío)');
    } else {
      currentEmails.forEach((email: string) => {
        console.log(`  ✓ ${email}`);
      });
    }

    // Lista completa de CALIDAD
    const qualityUsers = [
      { email: 'r.mendieta@favram.com', name: 'Roberto Mendieta' },
      { email: 'l.gil@favram.com', name: 'Luis Gil' },
      { email: 'e.sancetta@favram.com', name: 'Elisabetta Sancetta' },
    ];

    console.log('\n📋 Usuarios de CALIDAD (target):');
    qualityUsers.forEach((u) => {
      const isCurrent = currentEmails.includes(u.email);
      const icon = isCurrent ? '✓' : '✗';
      console.log(`  ${icon} ${u.email.padEnd(25)} — ${u.name}`);
    });

    const newEmails = qualityUsers.map((u) => u.email);

    // Actualizar si hay diferencias
    const hasChanges =
      newEmails.length !== currentEmails.length ||
      newEmails.some((e) => !currentEmails.includes(e));

    if (!hasChanges) {
      console.log('\n✅ qualityEmails ya contiene todos los emails correctos');
      return;
    }

    console.log('\n🔄 Actualizando config/app...');
    await db.collection('config').doc('app').update({
      qualityEmails: newEmails,
    });

    console.log('✅ ¡Actualizado!');
    console.log(`   Ahora los 3 de CALIDAD (${newEmails.join(', ')}) recibirán notificaciones`);
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

updateQualityEmails();
