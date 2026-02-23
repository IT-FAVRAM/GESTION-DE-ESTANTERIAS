const fs = require('fs');

const viewSrc = fs.readFileSync('components/CarretilleroRequestsView.tsx', 'utf8');
const rulesSrc = fs.readFileSync('firestore.rules', 'utf8');

if (!viewSrc.includes("status: 'COMPLETED'")) {
  throw new Error('Carretillero request completion does not write global status');
}

if (!viewSrc.includes("const pendingRequests = requests.filter(r => r.status !== 'COMPLETED');")) {
  throw new Error('Pending requests are not driven by global status');
}

if (!rulesSrc.includes('isRequestCompletionUpdate')) {
  throw new Error('Firestore rules do not allow validated request completion updates');
}

console.log('ok');
