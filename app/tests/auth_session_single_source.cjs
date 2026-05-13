const fs = require('fs');

const authStorage = fs.readFileSync('web/domain/auth/authStorage.ts', 'utf8');
const authResolver = fs.readFileSync('web/domain/auth/authSessionResolver.ts', 'utf8');
const useAuth = fs.readFileSync('web/hooks/useAuth.ts', 'utf8');

if (!authStorage.includes("GUEST_SESSION: 'wms_guest_session'")) {
  throw new Error('Missing canonical guest session storage key');
}

if (!authStorage.includes('AUTH_SESSION_CHANGED_EVENT')) {
  throw new Error('Missing shared auth session changed event');
}

if (!authResolver.includes('resolveCurrentAuthSession')) {
  throw new Error('Missing centralized auth session resolver');
}

if (!useAuth.includes('readGuestSession<GuestSession>()')) {
  throw new Error('useAuth is not reading canonical guest session');
}

console.log('ok');
