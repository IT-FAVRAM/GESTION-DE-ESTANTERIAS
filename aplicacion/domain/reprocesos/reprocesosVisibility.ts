import type { UserRole } from '../../lib/firestoreSchema';
import type { AuthMethod } from '../auth/authTypes';

// Reprocesos (CAL 001-022) son trabajo propio del rol CALIDAD. El permiso se
// basa en el ROL, no en el método de login: los responsables de calidad acceden
// igual con correo o desde la estación de calidad, y el backend (updateReproceso
// / shelfOperate) ya valida por rol ['CALIDAD','ADMIN','SUPERADMIN']. Antes se
// exigía authMethod==='email', lo que bloqueaba a CALIDAD cuando su sesión no
// quedaba marcada como 'email' (ver l.gil/e.sancetta/r.mendieta).
export const canViewReprocessCosts = (
  role: UserRole | null,
  _authMethod: AuthMethod | null,
): boolean => {
  return role === 'CALIDAD' || role === 'ADMIN' || role === 'SUPERADMIN';
};

export const canEditReprocesses = (
  role: UserRole | null,
  _authMethod: AuthMethod | null,
): boolean => {
  return role === 'CALIDAD' || role === 'ADMIN' || role === 'SUPERADMIN';
};


