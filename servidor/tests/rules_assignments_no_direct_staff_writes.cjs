const fs = require('fs');

const src = fs.readFileSync(require('path').join(__dirname, '../../base-de-datos/firestore.rules'), 'utf8');
if (src.includes('allow write: if canWriteAssignments(warehouseId);')) {
  throw new Error('Assignments still allow direct staff writes');
}

console.log('ok');
