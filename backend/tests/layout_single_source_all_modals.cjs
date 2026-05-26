const fs = require('fs');

const files = [
  'web/components/MoveItemModal.tsx',
  'web/components/RelocateLocationModal.tsx',
  'web/components/MultiLocationSelector.tsx',
  'web/components/EmptyLocationsModal.tsx'
];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('generateLayoutLocations')) {
    throw new Error(`${file} is not using centralized layout generation`);
  }
}

console.log('ok');
