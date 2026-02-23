const fs = require('fs');

const src = fs.readFileSync('hooks/useAssignments.ts', 'utf8');
const required = ['status:', 'packageType:', 'itemKey:', 'quantity:', 'containerId:', 'notes:'];

for (const key of required) {
  if (!src.includes(key)) {
    throw new Error(`Missing persisted assignment field: ${key}`);
  }
}

console.log('ok');
