const fs = require('fs');

const src = fs.readFileSync('lib/production.ts', 'utf8');

for (const field of ['itemKey', 'quantity', 'containerId', 'notes']) {
  if (!src.includes(`${field}:`)) {
    throw new Error(`locateWorkingItem is not preserving ${field}`);
  }
}

console.log('ok');
