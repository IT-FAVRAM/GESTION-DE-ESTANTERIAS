/**
 * Prueba el circuito completo sin necesidad de abrir la app.
 *
 * Escribe una petición pendiente en `erp_lookups` igual que haría un kiosko y
 * espera a que el bridge la resuelva.
 *
 *   node -r dotenv/config test-lookup.js OF26-05315
 *   node -r dotenv/config test-lookup.js OF26-05315 --keep   (no borra el doc)
 *
 * Requiere que el bridge esté corriendo en otra ventana (`npm start`) o como
 * servicio de Windows.
 */

'use strict';

const admin = require('firebase-admin');

const of = (process.argv[2] || 'OF26-05315').toUpperCase();
const keep = process.argv.includes('--keep');
const TIMEOUT_MS = 20000;

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function main() {
  const ref = db.collection('erp_lookups').doc(of);

  console.log(`→ Pidiendo ${of}…`);
  const started = Date.now();

  await ref.set(
    {
      of,
      status: 'pending',
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      requestedBy: 'test-lookup.js',
    },
    { merge: true },
  );

  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(
        new Error(
          `El bridge no respondió en ${TIMEOUT_MS / 1000} s. ¿Está corriendo? (npm start / services.msc)`,
        ),
      );
    }, TIMEOUT_MS);

    const unsubscribe = ref.onSnapshot((snap) => {
      const data = snap.data();
      if (!data || data.status === 'pending') return;
      clearTimeout(timer);
      unsubscribe();
      resolve(data);
    }, reject);
  });

  const ms = Date.now() - started;
  console.log(`← Resuelto en ${ms} ms con status="${result.status}"`);

  if (result.status === 'done') {
    console.log(`  Filas del ERP: ${result.rowCount}`);
    for (const article of result.articles) {
      console.log(
        `  • ${article.code}` +
          (article.qFabricar != null ? `  (a fabricar: ${article.qFabricar})` : '') +
          (article.estado ? `  [estado ${article.estado}]` : ''),
      );
    }
    if (result.articles.length > 1) {
      console.log('  ⚠ Varios artículos: la app pedirá al operario que elija.');
    }
  } else if (result.status === 'not_found') {
    console.log('  El ERP no tiene datos de esa OF.');
  } else {
    console.log(`  Error: ${result.error}`);
  }

  if (!keep) {
    await ref.delete();
    console.log('  (documento de prueba borrado — usa --keep para conservarlo)');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
