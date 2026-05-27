export type UserRole =
  | 'OPERARIO'
  | 'CARRETILLERO'
  | 'JEFE_SECCION'
  | 'CALIDAD'
  | 'ADMIN'
  | 'SUPERADMIN';

/** Roles que requieren Firebase Auth (email + password) */
export const AUTH_ROLES: UserRole[] = ['JEFE_SECCION', 'CALIDAD', 'ADMIN', 'SUPERADMIN'];

/** Roles que usan identificacion por ID numerico */
export const KIOSK_ROLES: UserRole[] = ['OPERARIO', 'CARRETILLERO'];


