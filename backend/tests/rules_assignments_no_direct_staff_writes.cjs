const fs = require('fs');

const src = fs.readFileSync('../firestore.rules', 'utf8');
if (src.includes('allow write: if canWriteAssignments(warehouseId);')) {
  throw new Error('Assignments still allow direct staff writes');
}

console.log('ok');
