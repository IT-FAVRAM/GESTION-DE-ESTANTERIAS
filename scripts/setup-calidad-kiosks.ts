/**
 * Registra los 3 kioskos de CALIDAD en Firestore.
 * Ejecutar: npx ts-node scripts/setup-calidad-kiosks.ts
 *
 * Kioskos de calidad:
 * - l.gil@favram.com     → device_1780289745958_unmgki   (Calidad 1)
 * - r.mendieta@favram.com → device_1780389875654_7e9qrj  (Calidad 2)
 * - e.sancetta@favram.com → device_1780389918476_tjtsjj  (Calidad 3)
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccount.json';
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log(`🔑 Credenciales: serviceAccount (${serviceAccountPath})`);
} else {
  admin.initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT || 'gestion-de-estanterias' });
  console.log('🔑 Credenciales: Application Default Credentials (ADC)');
}

const db = admin.firestore();

interface DeviceDoc {
  name: string;
  type: 'KIOSK' | 'CARRETILLERO';
  assignedShelf: string | null;
  kioskId: string | null;
  active: boolean;
  lastSeen: string;
}

const CALIDAD_KIOSKS: Array<{ deviceId: string; email: string; name: string; kioskId: string }> = [
  {
    deviceId: 'device_1780289745958_unmgki',
    email: 'l.gil@favram.com',
    name: 'Kiosko Calidad - L. Gil',
    kioskId: 'kiosko-calidad-1',
  },
  {
    deviceId: 'device_1780389875654_7e9qrj',
    email: 'r.mendieta@favram.com',
    name: 'Kiosko Calidad - R. Mendieta',
    kioskId: 'kiosko-calidad-2',
  },
  {
    deviceId: 'device_1780389918476_tjtsjj',
    email: 'e.sancetta@favram.com',
    name: 'Kiosko Calidad - E. Sancetta',
    kioskId: 'kiosko-calidad-3',
  },
];

async function setupCalidadKiosks() {
  console.log('\n🏭 Registrando kioskos de CALIDAD en Firestore...\n');

  for (const kiosk of CALIDAD_KIOSKS) {
    const deviceDoc: DeviceDoc = {
      name: kiosk.name,
      type: 'KIOSK',
      assignedShelf: 'CAL',
      kioskId: kiosk.kioskId,
      active: true,
      lastSeen: new Date().toISOString(),
    };

    await db.collection('kiosks').doc(kiosk.deviceId).set(deviceDoc, { merge: true });
    console.log(`✅ ${kiosk.email} → ${kiosk.deviceId} [${kiosk.kioskId}] asignado a CAL`);
  }

  console.log('\n✅ Todos los kioskos de calidad configurados.');
  console.log('\nPróximos pasos:');
  console.log('1. Abre la app en cada ordenador de calidad');
  console.log('2. El usuario correspondiente (l.gil / r.mendieta / e.sancetta) inicia sesión');
  console.log('3. La app detectará automáticamente el kiosko y mostrará CalidadView con estantería CAL');
}

setupCalidadKiosks().catch(console.error).finally(() => process.exit());
