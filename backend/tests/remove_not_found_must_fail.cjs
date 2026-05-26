const fs = require('fs');

const src = fs.readFileSync('web/lib/inventoryTransactions.ts', 'utf8');
if (!src.includes("throw new Error('ITEM_NOT_FOUND')") && !src.includes('throw new Error("ITEM_NOT_FOUND")')) {
  throw new Error('removeItemTransaction still allows not-found as success');
}

console.log('ok');
