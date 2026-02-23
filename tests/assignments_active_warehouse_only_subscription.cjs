const fs = require('fs');

const src = fs.readFileSync('hooks/useAssignments.ts', 'utf8');
if (src.includes('WAREHOUSES.forEach')) {
  throw new Error('Still subscribing to all warehouses');
}
if (!src.includes('warehousesToSubscribe')) {
  throw new Error('Active warehouse scoped subscription not found');
}

console.log('ok');
