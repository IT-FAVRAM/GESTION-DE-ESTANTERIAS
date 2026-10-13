const fs = require('fs');

const pickupSrc = fs.readFileSync(require('path').join(__dirname, '../../aplicacion/hooks/usePickupQueue.ts'), 'utf8');
const rulesSrc = fs.readFileSync(require('path').join(__dirname, '../../base-de-datos/firestore.rules'), 'utf8');

if (!pickupSrc.includes("status: 'COMPLETED' as PickupStatus") || !pickupSrc.includes('completeRequest')) {
  throw new Error('Pickup queue hook is not managing completed status centrally');
}

if (!/match \/pickupQueue\/\{document=\*\*\}[\s\S]*?allow write: if false;/.test(rulesSrc)) {
  throw new Error('Firestore rules no longer keep pickup queue writes backend-only');
}

console.log('ok');
