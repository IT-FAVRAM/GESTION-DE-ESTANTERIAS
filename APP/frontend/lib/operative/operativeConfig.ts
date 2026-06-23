/**
 * operativeConfig — Configuración de capacidades operativas por rol.
 *
 * Fuente única de verdad sobre QUÉ puede hacer cada rol y CÓMO se comporta
 * cada flujo (UBICAR / RETIRAR / MOVER / REUBICAR / ALMACÉN / AVISAR).
 *
 * Antes, cada rol tenía su propio motor (KioskView / ShelfNavigator / CalidadView)
 * con flujos ligeramente distintos. Ahora todos montan el mismo
 * <OperativeShelfArea> y solo cambia esta config. Así es imposible que un flujo
 * diverja entre roles o formatos.
 */

import type { UserRole } from '../schema/roles';

/** Cómo se selecciona la estantería sobre la que opera el rol. */
export type ShelfScope =
  | 'fixed'    // KIOSKO: estantería(s) fijada(s) por el dispositivo
  | 'section'  // JEFE_SECCIÓN: bloqueado a su sección
  | 'single'   // CALIDAD: siempre CAL
  | 'all';     // CARRETILLERO / ADMIN: navega todas las secciones

export type AlmacenMode = 'none' | 'full' | 'pintura';
export type AvisarMode = 'none' | 'recogida' | 'recogida+traer';

export interface RoleOperativeConfig {
  role: UserRole;
  shelfScope: ShelfScope;
  /** Estantería bloqueada para scope 'fixed' | 'section' | 'single'. */
  lockedShelfCode?: string;
  actions: {
    ubicar: boolean;
    retirar: boolean;
    mover: boolean;
    reubicar: boolean;
    almacen: AlmacenMode;
    avisar: AvisarMode;
  };
  ubicar: {
    /** Pregunta previa "¿vas a ubicar varios artículos en la misma posición?" */
    askMultiArticle: boolean;
    /** Permite "➕ Otra sección" para artículos grandes (solo scope 'all'). */
    allowMultiSection: boolean;
  };
  retirar: {
    /** Paso previo "¿de qué sección retiras?" (CARRETILLERO / ADMIN). */
    askSectionFirst: boolean;
  };
  mover: {
    /** Bucle "¿mover más?" tras cada movimiento (unificado en todos los roles). */
    loop: boolean;
  };
  reprocesos?: {
    /** Pregunta importe/cantidad al ubicar en celda de reprocesos (CALIDAD). */
    askImporteCantidad: boolean;
    /** Muestra costes de reprocesos en el grid. */
    showCosts: boolean;
    /** Seleccionar celda primero, luego preguntar si tiene OF antes de escanear. */
    cellFirst?: boolean;
  };
}

/**
 * Bandeja de escaneo (scan-first) — disponible para todos los roles operativos
 * que tienen pistola y barra de acciones, EXCEPTO:
 *   - OPERARIO: opera en kiosko sin sidebar; su flujo es scan→ubicar directo.
 *   - SOLO_VISUAL: sin permisos de escritura.
 *
 * Homogeneización de flujos: antes estaba restringida a CARRETILLERO + 2
 * superadmins por email. Ahora JEFE_SECCION, CALIDAD y ADMIN/SUPERADMIN también
 * la usan. Nota: JEFE_SECCION/CALIDAD son de ámbito limitado, así que el
 * "Retirar de la bandeja" puede actuar sobre la ubicación GLOBAL del artículo
 * (posiblemente en otra sección) — comportamiento aceptado en la homogeneización.
 */
export const SCAN_TRAY_SUPERADMIN_EMAILS = ['d.soler@favram.com', 'j.diaz@favram.com'];

export function canUseScanTray(role: UserRole | null | undefined, _email?: string | null): boolean {
  if (!role) return false;
  return role !== 'OPERARIO' && role !== 'SOLO_VISUAL';
}

export interface BuildOperativeConfigOptions {
  /** Estantería bloqueada (kiosko/jefe) o sección de calidad. */
  lockedShelfCode?: string | null;
  /** Sección del usuario (jefe de sección, pintura, etc.). */
  section?: string | null;
  /** Permisos de reprocesos del usuario (calidad). */
  canEditReprocesses?: boolean;
  canViewReprocessCosts?: boolean;
  /** Estantería actualmente seleccionada (para ADMIN con scope 'all'). */
  currentShelfCode?: string | null;
}

const PINTURA_SHELF = 'PIN';

const isPintura = (shelfCode?: string | null, section?: string | null): boolean => {
  const sc = String(shelfCode || '').toUpperCase();
  const sec = String(section || '').toUpperCase();
  return sc === PINTURA_SHELF || sec === 'PINTURA';
};

/**
 * Construye la configuración operativa para un rol concreto.
 * Es una función (no constante) porque algunos flags dependen del contexto
 * en tiempo de ejecución (p.ej. ALMACÉN en kiosko solo si es PINTURA).
 */
export function buildOperativeConfig(
  role: UserRole,
  opts: BuildOperativeConfigOptions = {},
): RoleOperativeConfig {
  const { lockedShelfCode, section, canEditReprocesses, canViewReprocessCosts, currentShelfCode } = opts;

  switch (role) {
    case 'OPERARIO':
      return {
        role,
        shelfScope: 'fixed',
        lockedShelfCode: lockedShelfCode || undefined,
        actions: {
          ubicar: true,
          retirar: true,
          mover: true,
          reubicar: false,
          almacen: isPintura(lockedShelfCode, section) ? 'pintura' : 'none',
          // Kioskos (OPERARIO): sin botón AVISAR — solo UBICAR / RETIRAR / MOVER.
          avisar: 'none',
        },
        ubicar: { askMultiArticle: true, allowMultiSection: false },
        retirar: { askSectionFirst: false },
        mover: { loop: true },
      };

    case 'CARRETILLERO':
      return {
        role,
        shelfScope: 'all',
        actions: {
          ubicar: true,
          retirar: true,
          mover: true,
          reubicar: false,
          almacen: 'full',
          // El carretillero ES la carretilla: no se avisa a sí mismo.
          avisar: 'none',
        },
        ubicar: { askMultiArticle: true, allowMultiSection: true },
        retirar: { askSectionFirst: true },
        mover: { loop: true },
      };

    case 'JEFE_SECCION':
      return {
        role,
        shelfScope: 'section',
        lockedShelfCode: lockedShelfCode || section || undefined,
        actions: {
          ubicar: true,
          retirar: true,
          mover: true,
          reubicar: false,
          almacen: 'none',
          avisar: 'recogida+traer',
        },
        ubicar: { askMultiArticle: true, allowMultiSection: false },
        retirar: { askSectionFirst: false },
        mover: { loop: true },
      };

    case 'CALIDAD':
      return {
        role,
        shelfScope: 'single',
        lockedShelfCode: 'CAL',
        actions: {
          ubicar: true,
          retirar: true,
          mover: true,
          reubicar: false,
          almacen: 'none',
          avisar: 'recogida+traer',
        },
        ubicar: { askMultiArticle: true, allowMultiSection: false },
        retirar: { askSectionFirst: false },
        mover: { loop: true },
        reprocesos: {
          askImporteCantidad: canEditReprocesses ?? true,
          showCosts: canViewReprocessCosts ?? false,
          cellFirst: true,
        },
      };

    case 'ADMIN':
    case 'SUPERADMIN': {
      const onCAL = (currentShelfCode || '').toUpperCase() === 'CAL';
      return {
        role,
        shelfScope: 'all',
        actions: {
          ubicar: true,
          retirar: true,
          mover: true,
          reubicar: true,
          almacen: 'full',
          avisar: 'recogida+traer',
        },
        ubicar: { askMultiArticle: true, allowMultiSection: !onCAL },
        retirar: { askSectionFirst: true },
        mover: { loop: true },
        ...(onCAL ? {
          reprocesos: {
            askImporteCantidad: canEditReprocesses ?? true,
            showCosts: canViewReprocessCosts ?? true,
            cellFirst: true,
          },
        } : {}),
      };
    }

    default:
      // Fallback defensivo: rol desconocido → solo lectura/avisar recogida.
      return {
        role,
        shelfScope: 'all',
        actions: {
          ubicar: false,
          retirar: false,
          mover: false,
          reubicar: false,
          almacen: 'none',
          avisar: 'recogida',
        },
        ubicar: { askMultiArticle: false, allowMultiSection: false },
        retirar: { askSectionFirst: false },
        mover: { loop: true },
      };
  }
}
