import type { UserRole, WarehouseSection } from '../../lib/firestoreSchema';

/** Sección de almacén → código de estantería principal */
export const SECTION_TO_SHELF: Partial<Record<WarehouseSection, string>> = {
  MECANIZADO: 'MEC',
  PRENSAS: 'PRE',
  PLEGADORA: 'PLE',
  SOLDADURA: 'SOL',
  AUTOPLEGADORA: 'RPL',
  REPASADO: 'REP',
  PINTURA: 'PIN',
  LASER: 'LASER',
  CALIDAD: 'CAL',
};

export const resolveAssignedShelfForRole = (
  role: UserRole | null,
  section: WarehouseSection | null,
): string | null => {
  if (!role) return null;
  if (role === 'CALIDAD') return 'CAL';
  if (role === 'JEFE_SECCION' && section) {
    return SECTION_TO_SHELF[section] ?? null;
  }
  return null;
};
