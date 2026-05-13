import type { UserRole } from '../../lib/firestoreSchema';
import type { AuthMethod } from '../auth/authTypes';

export const canViewReprocessCosts = (
  role: UserRole | null,
  authMethod: AuthMethod | null,
): boolean => {
  if (role === 'CALIDAD' && authMethod === 'email') return true;
  if (role === 'ADMIN' || role === 'SUPERADMIN') return true;
  return false;
};

export const canEditReprocesses = (
  role: UserRole | null,
  authMethod: AuthMethod | null,
): boolean => {
  if (role === 'CALIDAD' && authMethod === 'email') return true;
  if (role === 'ADMIN' || role === 'SUPERADMIN') return true;
  return false;
};
