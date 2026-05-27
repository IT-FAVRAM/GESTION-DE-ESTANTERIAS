const fs = require('fs');

const shelfAccess = fs.readFileSync('web/domain/shelves/shelfAccess.ts', 'utf8');
const capabilities = fs.readFileSync('web/domain/auth/authCapabilities.ts', 'utf8');
const calidadView = fs.readFileSync('web/components/app/CalidadView.tsx', 'utf8');

if (!shelfAccess.includes("if (role === 'CALIDAD') return targetShelf === 'CAL';")) {
  throw new Error('CALIDAD shelf access is not restricted to CAL');
}

if (!capabilities.includes("if (role === 'CALIDAD') return shelfCode === 'CAL';")) {
  throw new Error('Capability resolver does not restrict CALIDAD to CAL');
}

if (!calidadView.includes("const SHELF = 'CAL';")) {
  throw new Error('CalidadView is not pinned to CAL');
}

console.log('ok');
