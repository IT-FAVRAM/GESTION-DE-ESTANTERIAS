export type UserRole =
  | 'OPERARIO'
  | 'CARRETILLERO'
  | 'JEFE_SECCION'
  | 'CALIDAD'
  | 'ADMIN'
  | 'SUPERADMIN'
  | 'SOLO_VISUAL'
  | 'RECEPCIONES';

/** Roles que requieren Firebase Auth (email + password) */
export const AUTH_ROLES: UserRole[] = ['JEFE_SECCION', 'CALIDAD', 'ADMIN', 'SUPERADMIN', 'SOLO_VISUAL', 'RECEPCIONES'];

/** Roles que usan identificacion por ID numerico */
export const KIOSK_ROLES: UserRole[] = ['OPERARIO', 'CARRETILLERO'];


