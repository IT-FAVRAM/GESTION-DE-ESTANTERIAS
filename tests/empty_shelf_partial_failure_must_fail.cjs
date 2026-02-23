const fs = require('fs');

const src = fs.readFileSync('hooks/useInventoryOperations.ts', 'utf8');
if (!src.includes('inventoryApi.emptyShelf')) {
  throw new Error('emptyShelf is not routed through backend gateway');
}
if (!src.includes('if (!result.success)')) {
  throw new Error('emptyShelf does not validate operation result');
}

console.log('ok');
