const fs = require('fs');

const rules = fs.readFileSync('../firestore.rules', 'utf8');
const fn = fs.readFileSync('functions/src/inventory.ts', 'utf8');

if (!rules.includes('function canWriteHistory()') || !rules.includes('return false;')) {
  throw new Error('Rules no longer keep history writes backend-only');
}
if (!fn.includes('uid:') || !fn.includes('role:') || !fn.includes('opId') || (!fn.includes("source: 'inventoryOperate'") && !fn.includes('source: "inventoryOperate"'))) {
  throw new Error('Backend does not write strong audit fields');
}

console.log('ok');
