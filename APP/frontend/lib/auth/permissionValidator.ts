/**
 * permissionValidator — Validación ÚNICA de permisos frontend
 *
 * Consolida toda la lógica de validación de permisos en UN SOLO LUGAR.
 * Debe ser importada y usada por TODOS los componentes y hooks.
 * El backend debe replicar la MISMA lógica exactamente.
 */

import type { UserRole, WarehouseSection } from '../firestoreSchema';
import { getSectionForShelf } from '../firestoreSchema';

export interface PermissionContext {
  role: UserRole | null;
  assignedShelf?: string;
  section?: string;
  accessibleSections?: WarehouseSection[];
}

/**
 * Mapa de secciones que pueden tener acceso adicional a otras secciones.
 * Usado para jefes y kiosks que necesitan acceder a múltiples secciones.
 * Ej: Jefe de PLEGADORA también accede a AUTOPLEGADORA.
 */
const CROSS_SECTION_ACCESS: Record<string, WarehouseSection[]> = {
  'PLEGADORA': ['AUTOPLEGADORA'],
};

/**
 * Mapa de estanterías de kiosk que pueden operar en secciones adicionales.
 * Ej: Kiosk 'PLE' (PLEGADORA) también puede operar en CP1, CP2 (carros) y CRP, RPL (AUTOPLEGADORA).
 */
const KIOSK_ADDITIONAL_SHELVES: Record<string, string[]> = {
  'PLE': ['CP1', 'CP2', 'CRP', 'RPL'],  // Kiosk PLEGADORA accede a carros + AUTOPLEGADORA
};

/**
 * Resuelve las secciones accesibles para una sección primaria.
 * Incluye la sección primaria + cualquier sección adicional del mapa.
 */
function getAccessibleSections(primarySection: WarehouseSection): WarehouseSection[] {
  const accessible = [primarySection];
  const additional = CROSS_SECTION_ACCESS[primarySection];
  if (additional) {
    accessible.push(...additional);
  }
  return accessible;
}

/**
 * Valida si un usuario puede ACCEDER a una estantería (leer datos)
 */
export const canAccessShelf = (ctx: PermissionContext, shelfCode: string): boolean => {
  if (!ctx.role) return false;

  // OPERARIO en kiosk: puede acceder a su estantería + estanterías adicionales configuradas
  if (ctx.role === 'OPERARIO') {
    if (!ctx.assignedShelf) return false;
    const primaryShelfUpper = ctx.assignedShelf.toUpperCase();
    const targetUpper = shelfCode.toUpperCase();

    // Acceso a su estantería principal
    if (primaryShelfUpper === targetUpper) return true;

    // Acceso a estanterías adicionales mapeadas
    const additionalShelves = KIOSK_ADDITIONAL_SHELVES[primaryShelfUpper];
    if (additionalShelves && additionalShelves.includes(targetUpper)) return true;

    return false;
  }

  // CALIDAD solo puede acceder a CAL
  if (ctx.role === 'CALIDAD') return shelfCode === 'CAL';

  // JEFE_SECCION puede acceder a estanterías en su sección + secciones adicionales
  if (ctx.role === 'JEFE_SECCION') {
    if (!ctx.assignedShelf) return false;
    const userSection = getSectionForShelf(ctx.assignedShelf);
    const targetSection = getSectionForShelf(shelfCode);
    const accessibleSections = getAccessibleSections(userSection);
    return accessibleSections.includes(targetSection);
  }

  // CARRETILLERO, ADMIN, SUPERADMIN pueden acceder a todo
  if (['CARRETILLERO', 'ADMIN', 'SUPERADMIN'].includes(ctx.role)) return true;

  return false;
};

/**
 * Valida si un usuario puede OPERAR (ubicar, retirar, mover) en una estantería
 */
export const canOperateShelf = (ctx: PermissionContext, shelfCode: string): boolean => {
  if (!ctx.role) return false;

  // Primero validar que puede acceder
  if (!canAccessShelf(ctx, shelfCode)) return false;

  // Todos los roles que pueden acceder pueden operar
  return true;
};

/**
 * Valida si un usuario puede VACIAR una estantería
 */
export const canEmptyShelf = (ctx: PermissionContext, shelfCode: string): boolean => {
  if (!ctx.role) return false;

  // ADMIN y SUPERADMIN siempre pueden vaciar
  if (['ADMIN', 'SUPERADMIN'].includes(ctx.role)) return true;

  // JEFE_SECCION puede vaciar su propia sección + secciones adicionales
  if (ctx.role === 'JEFE_SECCION') {
    if (!ctx.assignedShelf) return false;
    const userSection = getSectionForShelf(ctx.assignedShelf);
    const targetSection = getSectionForShelf(shelfCode);
    const accessibleSections = getAccessibleSections(userSection);
    return accessibleSections.includes(targetSection);
  }

  return false;
};

/**
 * Valida si un usuario puede MOVER artículos entre estanterías diferentes
 */
export const canMoveAcrossWarehouses = (ctx: PermissionContext): boolean => {
  if (!ctx.role) return false;

  // CARRETILLERO, ADMIN, SUPERADMIN pueden mover entre almacenes (scope='all')
  if (['CARRETILLERO', 'ADMIN', 'SUPERADMIN'].includes(ctx.role)) return true;

  return false;
};
