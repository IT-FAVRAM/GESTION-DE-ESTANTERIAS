const fs = require('fs');

const shelfGrid = fs.readFileSync('web/components/kiosk/ShelfGrid.tsx', 'utf8');

if (shelfGrid.includes('Colapsar tarjetas') || shelfGrid.includes('Expandir tarjetas')) {
  throw new Error('ShelfGrid still renders local expand/collapse controls per estanteria');
}

if (!shelfGrid.includes('Contraer todo')) {
  throw new Error('Global "Contraer todo" button missing from ShelfGrid stats bar');
}
if (!shelfGrid.includes('Expandir todo')) {
  throw new Error('Global "Expandir todo" button missing from ShelfGrid stats bar');
}

if (!shelfGrid.includes('useState(true)')) {
  throw new Error('ShelfGrid is not defaulting to expanded cards');
}

if (!shelfGrid.includes('forceExpanded={globalExpanded}')) {
  throw new Error('ShelfGrid is not driving cards from the global expand/collapse control');
}

console.log('ok');
