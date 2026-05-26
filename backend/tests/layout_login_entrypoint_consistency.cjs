const fs = require('fs');

const appV3 = fs.readFileSync('web/AppV3.tsx', 'utf8');
const unifiedLogin = fs.readFileSync('web/components/auth/UnifiedLogin.tsx', 'utf8');
const useAuth = fs.readFileSync('web/hooks/useAuth.ts', 'utf8');

if (!appV3.includes('return <UnifiedLogin />;')) {
  throw new Error('AppV3 is not using UnifiedLogin as the only active unauthenticated entrypoint');
}

if (appV3.includes('return <LoginScreen') || appV3.includes('return <LoginRouter')) {
  throw new Error('AppV3 still routes through legacy login entrypoints');
}

if (!unifiedLogin.includes('setShowEmailLogin(true)')) {
  throw new Error('UnifiedLogin cannot switch into email login mode');
}

if (!unifiedLogin.includes('Para editar reprocesos, cantidades e importes entra con correo y contraseña de CALIDAD.')) {
  throw new Error('UnifiedLogin does not steer CALIDAD into authenticated access for reprocesos');
}

if (!unifiedLogin.includes('Para operar manualmente y navegar estanterias como ADMIN o SUPERADMIN entra con cuenta autorizada.')) {
  throw new Error('UnifiedLogin still allows ADMIN/SUPERADMIN without steering them to authenticated access');
}

if (unifiedLogin.includes("handleQuickAccess('ADMIN')")) {
  throw new Error('UnifiedLogin still exposes guest quick access for ADMIN');
}

if (!useAuth.includes('await signInAnonymously(auth);')) {
  throw new Error('Guest access is not creating an anonymous Firebase session');
}

console.log('ok');
