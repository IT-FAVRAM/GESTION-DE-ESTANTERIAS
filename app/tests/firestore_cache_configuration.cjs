const fs = require('fs');

const src = fs.readFileSync('web/lib/firebaseV3.ts', 'utf8');

if (src.includes('enableMultiTabIndexedDbPersistence(')) {
  throw new Error('Deprecated Firestore persistence API is still present');
}

if (!src.includes('initializeFirestore')) {
  throw new Error('Firestore is not initialized with the modern API');
}

if (!src.includes('persistentLocalCache')) {
  throw new Error('Firestore is not using persistentLocalCache');
}

console.log('ok');
