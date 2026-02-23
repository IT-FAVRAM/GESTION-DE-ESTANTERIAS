const fs = require('fs');

const src = fs.readFileSync('hooks/useAppLogic.ts', 'utf8');

if (!src.includes('const handleScanActionResult = useCallback')) {
  throw new Error('Missing scan action dispatcher in useAppLogic');
}

for (const action of ["case 'remove'", "case 'request'", "case 'finish'", "case 'duplicate'", "case 'assign_to_target'"]) {
  if (!src.includes(action)) {
    throw new Error(`Missing dispatcher branch: ${action}`);
  }
}

if (!src.includes('const scanResult = processScanInput(barcode, orderId);')) {
  throw new Error('Photo analysis path is not dispatching workflow result');
}

if (!src.includes("const scanResult = processScanInput(code, 'PENDIENTE');")) {
  throw new Error('Scanner path is not dispatching workflow result');
}

console.log('ok');
