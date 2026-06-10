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

/**
 * Alias de códigos de estantería que se consolidan en una vista combinada.
 * PRE (Prensas) y MEC (Mecanizado) están físicamente en el mismo sitio y se
 * operan como una sola estantería: la vista canónica es 'PRE'. 'PME' es un
 * código heredado de un intento de unificación abandonado.
 */
const COMBINED_SHELF_ALIASES: Record<string, string> = { MEC: 'PRE', PME: 'PRE' };

/** Normaliza un código de estantería a su vista combinada canónica. */
export const canonicalizeShelfCode = (code: string | null | undefined): string | null => {
  if (!code) return null;
  return COMBINED_SHELF_ALIASES[code] ?? code;
};

/** Sección de almacén → código de estantería principal (vista canónica) */
export const SECTION_TO_SHELF: Partial<Record<WarehouseSection, string>> = {
  PRENSAS_MECANIZADO: 'PRE',
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
    // Mecanizado y Prensas comparten ubicación: ambos kioscos muestran la vista
    // combinada 'PRE'. Se normaliza cualquier alias (MEC/PME) a su vista canónica.
    if (deviceAssignedShelf) return canonicalizeShelfCode(deviceAssignedShelf);
    if (kioskId === 'kiosko-mecanizado') return 'PRE';
    if (section) {
      const normalized = normalizeLegacySection(section as string) ?? section;
      return SECTION_TO_SHELF[normalized] ?? null;
    }
  }
  return null;
};


