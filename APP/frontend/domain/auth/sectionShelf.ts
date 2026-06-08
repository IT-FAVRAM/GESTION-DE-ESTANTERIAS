import type { UserRole, WarehouseSection } from '../../lib/firestoreSchema';

/** Valores de sección legacy que se fusionaron en PRENSAS_MECANIZADO */
const SECTION_LEGACY_MAP: Record<string, WarehouseSection> = {
  MECANIZADO: 'PRENSAS_MECANIZADO',
  PRENSAS: 'PRENSAS_MECANIZADO',
};

/** Normaliza valores de sección antiguos (MECANIZADO/PRENSAS) al nuevo nombre unificado */
export const normalizeLegacySection = (section: string | null | undefined): WarehouseSection | null => {
  if (!section) return null;
  return (SECTION_LEGACY_MAP[section] ?? section) as WarehouseSection;
};

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
    const normalized = normalizeLegacySection(section as string) ?? section;
    return SECTION_TO_SHELF[normalized] ?? null;
  }
  if (role === 'OPERARIO') {
    if (deviceAssignedShelf) return deviceAssignedShelf;
    if (kioskId === 'kiosko-mecanizado') return 'MEC';
    if (section) {
      const normalized = normalizeLegacySection(section as string) ?? section;
      return SECTION_TO_SHELF[normalized] ?? null;
    }
  }
  return null;
};


