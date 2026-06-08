import type { UserRole, WarehouseSection } from '../../lib/firestoreSchema';

/** Sección de almacén → código de estantería principal */
export const SECTION_TO_SHELF: Partial<Record<WarehouseSection, string>> = {
  PRENSAS_MECANIZADO: 'MEC',
  PLEGADORA: 'PLE',
  PUNZONADO: 'PLE',  // la punzonadora está en la sección de Plegado
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
  kioskId?: string | null,
  deviceAssignedShelf?: string | null,
): string | null => {
  if (!role) return null;
  if (role === 'CALIDAD') return 'CAL';
  if (role === 'JEFE_SECCION' && section) {
    return SECTION_TO_SHELF[section] ?? null;
  }
  if (role === 'OPERARIO') {
    // Intenta usar deviceAssignedShelf si está configurado
    if (deviceAssignedShelf) return deviceAssignedShelf;
    // Fallback para kioskos conocidos
    if (kioskId === 'kiosko-mecanizado') return 'MEC';
    // Fallback: mapea section a shelf si está disponible
    if (section) return SECTION_TO_SHELF[section] ?? null;
  }
  return null;
};


