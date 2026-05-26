import type { UserRole } from '../../lib/firestoreSchema';

export const canAccessShelf = (
  role: UserRole | null,
  assignedShelf: string | null,
  targetShelf: string,
): boolean => {
  if (!role) return false;
  if (role === 'OPERARIO') return assignedShelf === targetShelf;
  if (role === 'CALIDAD') return targetShelf === 'CAL';
  return true;
};


