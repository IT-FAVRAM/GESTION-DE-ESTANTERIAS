const fs = require('fs');

const src = fs.readFileSync('../firestore.rules', 'utf8');
if (!/match \/shelves\/\{document=\*\*\}[\s\S]*?allow write: if canWriteWarehouseState\(\);/.test(src)) {
  throw new Error('shelves collection no longer routes writes through backend-only gate');
}
if (!/match \/history\/\{document=\*\*\}[\s\S]*?allow write: if canWriteHistory\(\);/.test(src)) {
  throw new Error('history collection no longer routes writes through backend-only gate');
}
if (!src.includes('function canWriteWarehouseState()') || !src.includes('function canWriteHistory()') || !src.includes('return false;')) {
  throw new Error('Backend-only write gates are not explicitly denied in firestore.rules');
}

console.log('ok');
