const fs = require('fs');

const src = fs.readFileSync('functions/src/index.ts', 'utf8');
if (!src.includes('ALLOWED_AI_TYPES_BY_ROLE')) {
  throw new Error('AI callable does not enforce role/type allowlist');
}
if (!src.includes('permission-denied')) {
  throw new Error('AI callable role denial path not found');
}

console.log('ok');
