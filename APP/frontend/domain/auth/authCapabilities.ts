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
      canManagePhotos: false,
    };
  }

  const isAdminLevel = role === 'ADMIN' || role === 'SUPERADMIN';
  // Reprocesos = trabajo del rol CALIDAD (no depende del método de login).
  // El backend valida por rol; aquí no exigimos authMethod==='email'.
  const isCalidad = role === 'CALIDAD';
  const canOperate = OPERATIVE_ROLES.includes(role);

  return {
    canViewReprocessCosts: isCalidad || isAdminLevel,
    canEditReprocesses: isCalidad || isAdminLevel,
    canBrowseAllShelves: role === 'CARRETILLERO' || isAdminLevel || role === 'JEFE_SECCION',
    canOperateShelf: canOperate,
    // Gestión de fotos de ubicación (SOLDADURA): admin-level y carretillero en
    // cualquier shelf de soldadura; jefe de sección solo si su sección es SOLDADURA.
    canManagePhotos:
      isAdminLevel ||
      role === 'CARRETILLERO' ||
      (role === 'JEFE_SECCION' && !!assignedShelf && getSectionForShelf(assignedShelf) === 'SOLDADURA'),
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
      // → ADMIN siempre accede a todo, incluyendo CAL para ver reprocesos
      if (role === 'ADMIN' && assignedShelf) {
        const userSection = getSectionForShelf(assignedShelf);
        const targetSection = getSectionForShelf(shelfCode);
        // ADMIN accede a todo, incluyendo CAL
        return userSection === targetSection || true;
      }
      return true;
    },
  };
};


