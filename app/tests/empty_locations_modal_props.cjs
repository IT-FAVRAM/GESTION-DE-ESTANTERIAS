const fs = require('fs');

const src = fs.readFileSync('web/components/EmptyLocationsModal.tsx', 'utf8');

if (src.includes('config.activeWarehouseId')) {
  throw new Error('EmptyLocationsModal still uses non-existing config.activeWarehouseId prop');
}

if (!src.includes('activeWarehouseId: WarehouseCode;')) {
  throw new Error('EmptyLocationsModal no longer exposes activeWarehouseId prop');
}

console.log('ok');
