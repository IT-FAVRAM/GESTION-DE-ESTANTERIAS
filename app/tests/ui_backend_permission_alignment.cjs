const fs = require('fs');

const src = fs.readFileSync('web/hooks/useInventoryOperations.ts', 'utf8');
if (!src.includes('permission-denied')) {
  throw new Error('UI does not map backend RBAC denials explicitly');
}

console.log('ok');
