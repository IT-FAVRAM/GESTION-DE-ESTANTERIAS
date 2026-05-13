const fs = require('fs');

const viewSrc = fs.readFileSync('web/components/CarretilleroRequestsView.tsx', 'utf8');
const hookSrc = fs.readFileSync('web/hooks/useSystemNotifications.ts', 'utf8');

if (viewSrc.includes('24 * 60 * 60 * 1000')) {
  throw new Error('24h cutoff still present in CarretilleroRequestsView');
}

if (hookSrc.includes('24 * 60 * 60 * 1000')) {
  throw new Error('24h cutoff still present in useSystemNotifications pending counter');
}

if (!viewSrc.includes('.orderBy(\'timestamp\', \'desc\')') || !viewSrc.includes('.limit(1000)')) {
  throw new Error('Requests view is not using uncapped recent query strategy');
}

console.log('ok');
