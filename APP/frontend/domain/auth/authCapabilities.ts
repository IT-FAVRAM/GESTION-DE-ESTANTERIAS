import type { UserRole } from '../../lib/firestoreSchema';
import { getSectionForShelf } from '../../lib/firestoreSchema';
import type { AuthMethod, SessionCapabilities } from './authTypes';

const OPERATIVE_ROLES: UserRole[] = [
  'OPERARIO',
  'CARRETILLERO',
  'CALIDAD',
  'JEFE_SECCION',
  'ADMIN',
  'SUPERADMIN',
];

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
  const canOperate = OPERATIVE_ROLES.includes(role);

  return {
    canViewReprocessCosts: isCalidadEmail || isAdminLevel,
    canEditReprocesses: isCalidadEmail || isAdminLevel,
    canBrowseAllShelves: role === 'CARRETILLERO' || isAdminLevel || role === 'JEFE_SECCION',
    canOperateShelf: canOperate,
    canAccessShelf: (shelfCode: string) => {
      if (role === 'OPERARIO') return true;
      if (role === 'CALIDAD') return shelfCode === 'CAL';
      if (role === 'JEFE_SECCION') {
        if (!assignedShelf) return false;
        const userSection = getSectionForShelf(assignedShelf);
        const targetSection = getSectionForShelf(shelfCode);
        return userSection === targetSection;
      }
      // ADMIN con section asignado (ej: juanma como jefe de plegadora)
      // → también respeta esa sección en ciertos contextos
      if (role === 'ADMIN' && assignedShelf) {
        const userSection = getSectionForShelf(assignedShelf);
        const targetSection = getSectionForShelf(shelfCode);
        // ADMIN accede a todo, pero si hay section → puede filtrar opciones de UI
        return userSection === targetSection || true; // siempre true para ADMIN
      }
      return true;
    },
  };
};


