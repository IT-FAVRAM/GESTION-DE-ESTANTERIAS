const fs = require('fs');

const src = fs.readFileSync('components/AppModals.tsx', 'utf8');

if (src.includes('config.activeWarehouseId')) {
  throw new Error('AppModals still uses non-existing config.activeWarehouseId prop');
}

if (!src.includes('activeWarehouseId={props.activeWarehouse as WarehouseCode}')) {
  throw new Error('EmptyLocationsModal is not wired to active warehouse prop');
}

console.log('ok');
