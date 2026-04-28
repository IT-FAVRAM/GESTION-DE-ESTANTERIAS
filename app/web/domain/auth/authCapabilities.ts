import type { UserRole } from '../../lib/firestoreSchema';
import type { AuthMethod, SessionCapabilities } from './authTypes';

export const resolveCapabilities = (
  role: UserRole | null,
  authMethod: AuthMethod | null,
  assignedShelf: string | null,
): SessionCapabilities => {
  if (!role) {
    return {
      canViewReprocessCosts: false,
      canEditReprocesses: false,
      canBrowseAllShelves: false,
      canOperateShelf: false,
      canAccessShelf: () => false,
    };
  }

  const isAdminLevel = role === 'ADMIN' || role === 'SUPERADMIN';
  const isCalidadEmail = role === 'CALIDAD' && authMethod === 'email';

  return {
    canViewReprocessCosts: isCalidadEmail || isAdminLevel,
    canEditReprocesses: isCalidadEmail || isAdminLevel,
    canBrowseAllShelves: role === 'CARRETILLERO' || isAdminLevel || role === 'JEFE_SECCION',
    canOperateShelf: role !== 'JEFE_SECCION',
    canAccessShelf: (shelfCode: string) => {
      if (role === 'OPERARIO') return assignedShelf === shelfCode;
      if (role === 'CALIDAD') return shelfCode === 'CAL';
      return true;
    },
  };
};
