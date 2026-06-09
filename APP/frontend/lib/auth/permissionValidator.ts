/**
 * permissionValidator — Validación ÚNICA de permisos frontend
 *
 * Consolida toda la lógica de validación de permisos en UN SOLO LUGAR.
 * Debe ser importada y usada por TODOS los componentes y hooks.
 * El backend debe replicar la MISMA lógica exactamente.
 */

import type { UserRole } from '../firestoreSchema';
import { getSectionForShelf } from '../firestoreSchema';

export interface PermissionContext {
  role: UserRole | null;
  assignedShelf?: string;
  section?: string;
}

/**
 * Valida si un usuario puede ACCEDER a una estantería (leer datos)
 */
export const canAccessShelf = (ctx: PermissionContext, shelfCode: string): boolean => {
  if (!ctx.role) return false;

  // OPERARIO puede acceder a cualquier estantería
  if (ctx.role === 'OPERARIO') return true;

  // CALIDAD solo puede acceder a CAL
  if (ctx.role === 'CALIDAD') return shelfCode === 'CAL';

  // JEFE_SECCION solo puede acceder a estanterías en su sección
  if (ctx.role === 'JEFE_SECCION') {
    if (!ctx.assignedShelf) return false;
    const userSection = getSectionForShelf(ctx.assignedShelf);
    const targetSection = getSectionForShelf(shelfCode);
    return userSection === targetSection;
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

  // JEFE_SECCION puede vaciar su propia sección
  if (ctx.role === 'JEFE_SECCION') {
    if (!ctx.assignedShelf) return false;
    const userSection = getSectionForShelf(ctx.assignedShelf);
    const targetSection = getSectionForShelf(shelfCode);
    return userSection === targetSection;
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
