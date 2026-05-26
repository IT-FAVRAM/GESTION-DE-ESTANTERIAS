// cleanup.js
// Script to consolidate duplicate Firestore collections.
// Uses firebase-admin SDK. Ensure GOOGLE_APPLICATION_CREDENTIALS is set in the environment
// or that the service account JSON is placed in the project root as "serviceAccountKey.json".

const admin = require('firebase-admin');
const path = require('path');

// Initialize the app
function initFirebase() {
  try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e) {
    // Fallback to application default credentials
    admin.initializeApp();
  }
  return admin.firestore();
}

async function copyAndArchive(srcCol, destCol, archiveCol) {
  const db = initFirebase();
  const srcRef = db.collection(srcCol);
  const destRef = db.collection(destCol);
  const archiveRef = db.collection(archiveCol).doc(srcCol); // sub‑doc for each source collection

  const snapshots = await srcRef.get();
  console.log(`Copying ${snapshots.size} docs from ${srcCol} to ${destCol} (archive ${archiveCol}/${srcCol})`);

  const batch = db.batch();
  snapshots.forEach(doc => {
    const data = doc.data();
    const srcDocPath = `${srcCol}/${doc.id}`;
    // Archive under __archivos_duplicados__/srcCol/docId
    const archiveDoc = archiveRef.collection('docs').doc(doc.id);
    batch.set(archiveDoc, data);
    // Write to destination (set with merge to keep existing fields)
    const destDoc = destRef.doc(doc.id);
    batch.set(destDoc, data, { merge: true });
    // Delete original after copy (will be handled later)
  });
  await batch.commit();
  console.log('Copy & archive batch committed.');
}

async function deleteCollection(col) {
  const db = initFirebase();
  const colRef = db.collection(col);
  const snapshots = await colRef.get();
  console.log(`Deleting ${snapshots.size} docs from ${col}`);
  const batch = db.batch();
  snapshots.forEach(doc => {
    batch.delete(colRef.doc(doc.id));
  });
  await batch.commit();
  console.log(`Collection ${col} deleted.`);
}

async function main() {
  const ARCHIVE_ROOT = '__archivos_duplicados__';

  // users -> usuarios
  await copyAndArchive('users', 'usuarios', ARCHIVE_ROOT);
  await deleteCollection('users');

  // history -> historial
  await copyAndArchive('history', 'historial', ARCHIVE_ROOT);
  await deleteCollection('history');

  // shelves -> pieces (keep pieces unchanged, just archive and delete shelves)
  await copyAndArchive('shelves', 'pieces', ARCHIVE_ROOT);
  await deleteCollection('shelves');

  console.log('Cleanup completed successfully.');
}

main().catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
