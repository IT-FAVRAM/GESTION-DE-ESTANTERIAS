const fs = require('fs');

const rules = fs.readFileSync('firestore.rules', 'utf8');
const fn = fs.readFileSync('functions/src/index.ts', 'utf8');

if (!rules.includes('uid') || !rules.includes('role') || !rules.includes('opId') || !rules.includes('source')) {
  throw new Error('Rules do not enforce strong audit contract');
}
if (!fn.includes('uid:') || !fn.includes('role:') || !fn.includes('opId') || !fn.includes('source: "inventoryOperate"')) {
  throw new Error('Backend does not write strong audit fields');
}

console.log('ok');
