/**
 * Audit de Colecciones Firestore
 * Ejecutar: npx ts-node scripts/audit-collections.ts
 *
 * Identifica colecciones legacy, vacías, y con datos potencialmente duplicados
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

// Colecciones definidas en COLLECTIONS de la app
const OFFICIAL_COLLECTIONS = [
  'config', 'shelves', 'locations', 'items', 'itemAggregates',
  'usuarios', 'dispositivos', 'kiosks', 'pickupQueue',
  'history', 'conexion_estado', 'conexion_logs'
];

// Colecciones encontradas en Firestore (algunas son legacy)
const ALL_FIRESTORE_COLLECTIONS = [
  'avisos', 'conexion_estado', 'conexion_logs', 'config', 'configuracion',
  'dispositivos', 'estanterias', 'historial', 'history', 'itemAggregates',
  'items', 'kiosks', 'meta', 'pickupQueue', 'piezas', 'shelves', 'tablets',
  'usuarios'
];

interface CollectionInfo {
  name: string;
  docCount: number;
  isOfficial: boolean;
  isLegacy: boolean;
  isEmpty: boolean;
  sampleDoc?: any;
}

async function auditCollections() {
  console.log('📊 AUDIT DE COLECCIONES FIRESTORE\n');
  console.log('Analizando todas las colecciones...\n');

  const results: CollectionInfo[] = [];

  for (const colName of ALL_FIRESTORE_COLLECTIONS) {
    try {
      // Obtener conteo de documentos
      const countResult = await db.collection(colName).count().get();
      const docCount = countResult.data().count;

      // Obtener muestra de documento
      const sampleSnap = await db.collection(colName).limit(1).get();
      const sampleDoc = sampleSnap.empty ? null : sampleSnap.docs[0].data();

      const isOfficial = OFFICIAL_COLLECTIONS.includes(colName);
      const isLegacy = !isOfficial;
      const isEmpty = docCount === 0;

      results.push({
        name: colName,
        docCount,
        isOfficial,
        isLegacy,
        isEmpty,
        sampleDoc: sampleDoc ? Object.keys(sampleDoc).slice(0, 5) : null,
      });
    } catch (error: any) {
      console.warn(`⚠️  Error al auditar ${colName}: ${error.message}`);
    }
  }

  // Mostrar resultados organizados
  console.log('=== COLECCIONES OFICIALES (v3.0) ===\n');
  for (const col of results.filter((c) => c.isOfficial)) {
    const status = col.isEmpty ? '⚠️ VACÍA' : `✅ ${col.docCount} docs`;
    console.log(`  ${col.name.padEnd(20)} ${status}`);
    if (col.sampleDoc) console.log(`     Campos: ${col.sampleDoc.join(', ')}`);
  }

  console.log('\n=== COLECCIONES LEGACY/OBSOLETAS ===\n');
  for (const col of results.filter((c) => c.isLegacy)) {
    if (col.isEmpty) {
      console.log(`  ✂️  ${col.name.padEnd(20)} — VACÍA, SEGURO ELIMINAR`);
    } else {
      console.log(`  ⚠️  ${col.name.padEnd(20)} — ${col.docCount} docs, REVISAR ANTES DE ELIMINAR`);
      if (col.sampleDoc) console.log(`     Campos: ${col.sampleDoc.join(', ')}`);
    }
  }

  // Posibles duplicados
  console.log('\n=== POSIBLES DUPLICADOS ===\n');
  const duplicates = [
    { official: 'shelves', legacy: 'estanterias' },
    { official: 'history', legacy: 'historial' },
    { official: 'config', legacy: 'configuracion' },
    { official: 'items', legacy: 'piezas' },
    { official: 'kiosks', legacy: 'tablets' },
  ];

  for (const dup of duplicates) {
    const officialInfo = results.find((c) => c.name === dup.official);
    const legacyInfo = results.find((c) => c.name === dup.legacy);

    if (!legacyInfo) continue;

    console.log(`  ${dup.legacy} ← → ${dup.official}`);
    console.log(`    Legacy: ${legacyInfo.docCount} docs`);
    if (officialInfo) console.log(`    Official: ${officialInfo.docCount} docs`);
    console.log('');
  }

  // Resumen
  const legacy = results.filter((c) => c.isLegacy);
  const emptyLegacy = legacy.filter((c) => c.isEmpty).length;
  const activeLegacy = legacy.filter((c) => !c.isEmpty).length;

  console.log('\n=== RESUMEN ===\n');
  console.log(`  Total colecciones: ${results.length}`);
  console.log(`  Oficiales (v3.0): ${results.filter((c) => c.isOfficial).length}`);
  console.log(`  Legacy: ${legacy.length}`);
  console.log(`    - Vacías (seguro borrar): ${emptyLegacy}`);
  console.log(`    - Activas (revisar antes): ${activeLegacy}`);

  return results;
}

auditCollections()
  .then((results) => {
    console.log('\n✅ Audit completado.');
    console.log('\n📝 Próximos pasos:');
    console.log('  1. Revisar las colecciones legacy activas');
    console.log('  2. Migrar datos si es necesario');
    console.log('  3. Eliminar colecciones vacías');
    console.log('  4. Actualizar COLLECTIONS en lib/schema/collections.ts');
  })
  .catch(console.error);
