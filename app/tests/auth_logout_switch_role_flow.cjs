const fs = require('fs');

const useAuth = fs.readFileSync('web/hooks/useAuth.ts', 'utf8');

const clearCalls = (useAuth.match(/clearAllSessionData\(/g) || []).length;
if (clearCalls < 3) {
  throw new Error('Expected session cleanup in guest login, email login, and logout');
}

if (useAuth.includes('window.location.reload')) {
  throw new Error('Auth flow still depends on window.location.reload');
}

if (!useAuth.includes('AUTH_SESSION_CHANGED_EVENT')) {
  throw new Error('Auth flow is not syncing session changes across hook instances');
}

console.log('ok');
