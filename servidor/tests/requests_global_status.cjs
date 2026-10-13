const fs = require('fs');

const viewSrc = fs.readFileSync(require('path').join(__dirname, '../../aplicacion/components/views/CarretilleroRequestsView.tsx'), 'utf8');
const pickupSrc = fs.readFileSync(require('path').join(__dirname, '../../aplicacion/hooks/usePickupQueue.ts'), 'utf8');
const rulesSrc = fs.readFileSync(require('path').join(__dirname, '../../config/firestore.rules'), 'utf8');

if (!viewSrc.includes("status: 'COMPLETED'")) {
  throw new Error('Carretillero request completion does not write global status');
}

if (!viewSrc.includes("const pendingRequests = requests.filter(r => r.status !== 'COMPLETED');")) {
  throw new Error('Pending requests are not driven by global status');
}

if (!pickupSrc.includes("status: 'COMPLETED' as PickupStatus") || !pickupSrc.includes('completeRequest')) {
  throw new Error('Pickup queue hook is not managing completed status centrally');
}

if (!/match \/pickupQueue\/\{document=\*\*\}[\s\S]*?allow write: if false;/.test(rulesSrc)) {
  throw new Error('Firestore rules no longer keep pickup queue writes backend-only');
}

console.log('ok');
