const fs = require('fs');

const rules = fs.readFileSync(require('path').join(__dirname, '../../config/firestore.rules'), 'utf8');
const fn = fs.readFileSync(require('path').join(__dirname, '../src/inventory.ts'), 'utf8');

if (!/match \/history\/\{document=\*\*\}[\s\S]*?allow write: if false;/.test(rules)) {
  throw new Error('Rules no longer keep history writes backend-only');
}
if (!fn.includes('uid:') || !fn.includes('role:') || !fn.includes('opId') || (!fn.includes("source: 'inventoryOperate'") && !fn.includes('source: "inventoryOperate"'))) {
  throw new Error('Backend does not write strong audit fields');
}

console.log('ok');
