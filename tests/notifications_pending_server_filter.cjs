const fs = require('fs');

const src = fs.readFileSync('hooks/useSystemNotifications.ts', 'utf8');
if (!src.includes(".where('status', '==', 'PENDING')")) {
  throw new Error('Pending request query still filters status on client');
}

console.log('ok');
