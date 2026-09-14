/**
 * useShelf - Hook para datos de una estanteria en tiempo real.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { computeShelfKpis } from '../lib/shelfKpis';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { inventoryApi } from '../lib/api/inventoryApi';
import { parseCallableError } from '../lib/callableError';
import { enqueueOfflineOperation } from '../lib/offline/offlineQueue';
import { getOperationalSession } from '../lib/operationalSession';
import { resolveCurrentAuthSession } from '../domain/auth/authSessionResolver';
import { applyUbicar, applyUbicarMulti, applyRetirar, applyRetirarDeUbicacion, applyMover } from '../lib/optimistic/shelfOptimisticUpdates';
import {
  type LocationDoc,
  type LocationItem,
  type Shelf,
  COLLECTIONS,
  getLocationDocId,
  getShelfDefinition,
} from '../lib/firestoreSchema';

// Re-export so consumers keep working with their existing import paths
export type { ShelfLocationState } from '../lib/schema/locations';

import type { ShelfLocationState } from '../lib/schema/locations';
import { isSameArticle } from '../lib/articleIdentity';

const sameItem = (item: LocationItem, articleCode: string, orderFab: string) =>
  isSameArticle(item.articleCode, item.orderFab, articleCode, orderFab);

const normalizePositions = (positions: string[]) =>
  positions.map((p) => p.trim()).filter(Boolean);

const hasDuplicatePositions = (positions: string[]) =>
  new Set(positions).size !== positions.length;

export interface UseShelfReturn {
  locations: ShelfLocationState[];
  loading: boolean;
  error: string | null;
  shelfCode: string;
  shelfDef: Shelf | undefined;
  ubicar: (articleCode: string, orderFab: string, position: string, operarioId: string, operarioName: string, subcontratacion?: boolean) => Promise<boolean>;
  ubicarMulti: (articleCode: string, orderFab: string, positions: string[], operarioId: string, operarioName: string, importe?: number, cantidad?: number, subcontratacion?: boolean) => Promise<boolean>;
  retirar: (articleCode: string, orderFab: string, operarioId: string, operarioName: string) => Promise<{ success: boolean; positions: string[]; error?: string }>;
  retirarDeUbicacion: (articleCode: string, orderFab: string, position: string, operarioId: string, operarioName: string, presenceId?: string) => Promise<{ success: boolean; position: string; error?: string }>;
  /** presenceIds: mover solo esas presencias (un parcial); si no, todas las de la estantería. */
  mover: (articleCode: string, orderFab: string, newPositions: string[], operarioId: string, operarioName: string, presenceIds?: string[]) => Promise<boolean>;
  findArticle: (articleCode: string, orderFab: string) => ShelfLocationState[];
  emptyShelf: (operarioId: string, operarioName: string) => Promise<boolean>;
  validateShelfAccess: (purpose: 'view' | 'operate') => Promise<{ ok: boolean }>;
  /**
   * Devuelve y limpia el motivo del último fallo. Síncrono: `error` es estado de
   * React y justo después de `await ubicar(...)` todavía tiene el valor anterior.
   */
  takeLastError: () => string | null;
  totalArticles: number;
  totalOccupied: number;
  totalEmpty: number;
}

export const useShelf = (shelfCode: string): UseShelfReturn => {
  const [locations, setLocations] = useState<ShelfLocationState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const setError = useCallback((msg: string | null) => {
    lastErrorRef.current = msg;
    setErrorState(msg);
  }, []);
  const takeLastError = useCallback(() => {
    const msg = lastErrorRef.current;
    lastErrorRef.current = null;
    return msg;
  }, []);

  const shelfDef = getShelfDefinition(shelfCode);

  // ── Access validation ────────────────────────────────────────────────────

  const validateShelfAccess = useCallback(async (purpose: 'view' | 'operate') => {
    const { canAccessShelf, canOperateShelf } = await import('../lib/auth/permissionValidator');
    const session = await resolveCurrentAuthSession();
    if (!session.role) {
      setError('No hay una sesion activa para esta operacion.');
      return { ok: false, session };
    }
    const permCtx = {
      role: session.role,
      assignedShelf: session.assignedShelf,
      section: session.section,
      allowedShelves: session.allowedShelves,
    };
    if (!canAccessShelf(permCtx, shelfCode)) {
      setError(`La sesion ${session.role} no puede acceder a la estanteria ${shelfCode}.`);
      return { ok: false, session };
    }
    if (purpose === 'operate' && !canOperateShelf(permCtx, shelfCode)) {
      setError(`La sesion ${session.role} no puede operar sobre la estanteria ${shelfCode}.`);
      return { ok: false, session };
    }
    return { ok: true, session };
  }, [shelfCode]);

  // ── Firestore subscription ────────────────────────────────────────────────

  useEffect(() => {
    // Limpiar datos de la estantería anterior inmediatamente al cambiar de shelf.
    // Sin esto, los datos de PRE-005 quedan visibles en MEC, REP, etc. hasta
    // que llega el nuevo snapshot — el usuario ve el mismo artículo en todas.
    setLocations([]);
    setLoading(true);
    setError(null);

    if (!shelfCode) {
      setLoading(false);
      return;
    }

    // HOTFIX: PRE y MEC están separados. Cuando sea PRE, combina datos de ambos.
    // Dos suscripciones INDEPENDIENTES (no anidadas): anidar onSnapshot creaba un
    // nuevo listener de MEC en cada cambio de PRE, acumulándolos sin desuscribir.
    if (shelfCode === 'PRE') {
      let preLocs: ShelfLocationState[] = [];
      let mecLocs: ShelfLocationState[] = [];
      let preReady = false;
      let mecReady = false;

      const mapSnapshot = (snapshot: import('firebase/firestore').QuerySnapshot, code: string): ShelfLocationState[] => {
        const out: ShelfLocationState[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as LocationDoc;
          out.push({
            position: data.position || docSnap.id,
            items: data.items || [],
            isEmpty: data.isEmpty ?? (data.items?.length === 0),
            locationId: getLocationDocId(code, data.position || docSnap.id),
            nota: data.nota,
            photos: data.photos,
          });
        });
        return out;
      };

      const recombine = () => {
        // URG MEC-PRE se refleja en ambas colecciones; conservar solo la entrada de PRE.
        const filteredMecLocs = mecLocs.filter((l) => !l.position.startsWith('URG MEC-PRE'));
        const combined = [...preLocs, ...filteredMecLocs];
        combined.sort((a, b) => {
          const numA = parseInt(a.position, 10);
          const numB = parseInt(b.position, 10);
          if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
          return a.position.localeCompare(b.position);
        });
        setLocations(combined);
        if (preReady && mecReady) {
          setLoading(false);
          setError(null);
        }
      };

      const preRef = collection(db, COLLECTIONS.SHELVES, 'PRE', COLLECTIONS.LOCATIONS);
      const mecRef = collection(db, COLLECTIONS.SHELVES, 'MEC', COLLECTIONS.LOCATIONS);

      const preUnsub = onSnapshot(
        preRef,
        (snapshot) => { preLocs = mapSnapshot(snapshot, 'PRE'); preReady = true; recombine(); },
        (err) => {
          console.error(`[useShelf] Error on shelf PRE:`, err);
          setError('Error cargando datos de PRENSAS');
          setLoading(false);
        },
      );

      const mecUnsub = onSnapshot(
        mecRef,
        (snapshot) => { mecLocs = mapSnapshot(snapshot, 'MEC'); mecReady = true; recombine(); },
        (err) => {
          console.error(`[useShelf] Error on shelf MEC:`, err);
          setError('Error cargando datos de MECANIZADO');
          setLoading(false);
        },
      );

      return () => {
        preUnsub();
        mecUnsub();
      };
    }

    // Para cualquier otro shelf, comportamiento normal
    const locationsRef = collection(db, COLLECTIONS.SHELVES, shelfCode, COLLECTIONS.LOCATIONS);
    const unsubscribe = onSnapshot(
      locationsRef,
      (snapshot) => {
        const locs: ShelfLocationState[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as LocationDoc;
          locs.push({
            position: data.position || docSnap.id,
            items: data.items || [],
            isEmpty: data.isEmpty ?? (data.items?.length === 0),
            locationId: getLocationDocId(shelfCode, data.position || docSnap.id),
            nota: data.nota,
            photos: data.photos,
          });
        });
        locs.sort((a, b) => {
          const numA = parseInt(a.position, 10);
          const numB = parseInt(b.position, 10);
          if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
          return a.position.localeCompare(b.position);
        });
        setLocations(locs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`[useShelf] Error on shelf ${shelfCode}:`, err);
        setError('Error cargando datos de la estanteria');
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [shelfCode]);

  // ── Operations ───────────────────────────────────────────────────────────

  /** Resolves the physical shelf code for a position (handling combined views like PRE) */
  const getTargetShelf = useCallback((position: string): string => {
    const loc = locations.find((l) => l.position === position);
    if (loc) {
      const dashIdx = loc.locationId.indexOf('-');
      if (dashIdx !== -1) return loc.locationId.substring(0, dashIdx);
    }
    // Fallback for new positions in PRE combined view
    if (shelfCode === 'PRE') {
      const posNum = parseInt(position, 10);
      if (posNum >= 14 && posNum <= 46) return 'MEC';
    }
    return shelfCode;
  }, [locations, shelfCode]);

  const ubicar = useCallback(async (
    articleCode: string,
    orderFab: string,
    position: string,
    operarioId: string,
    operarioName: string,
    subcontratacion?: boolean,
  ): Promise<boolean> => {
    // Keep a DEEP COPY snapshot of current locations for rollback
    // Critical: must be deep copy to prevent mutations when snapshot arrives
    const previousLocations = JSON.parse(JSON.stringify(locations));
    try {
      const access = await validateShelfAccess('operate');
      if (!access.ok) return false;
      const targetShelf = getTargetShelf(position);
      if (!targetShelf || !position.trim()) {
        setError('No hay estanteria o posicion valida para ubicar.');
        return false;
      }
      if (!articleCode.trim()) {
        setError('Codigo de articulo es obligatorio para ubicar.');
        return false;
      }
      // CALIDAD (CAL): Permite ubicar sin OF en cualquier posición.
      // SUBCONTRATACIÓN: el código amarillo es el único identificador (sin OF).
      const isCalidadShelf = targetShelf === 'CAL';
      if (!orderFab.trim() && !isCalidadShelf && !subcontratacion) {
        setError('OF (Orden de Fabricación) es obligatoria para ubicar.');
        return false;
      }
      const session = getOperationalSession();
      if (!navigator.onLine) {
        enqueueOfflineOperation('UBICAR', { shelfCode: targetShelf, articleCode, orderFab, position, operarioId, operarioName, subcontratacion }, session);
        // Offline: apply optimistic update since onSnapshot won't fire
        setLocations((prev) => applyUbicar(prev, targetShelf, articleCode, orderFab, position, operarioId, operarioName, undefined, undefined, undefined, subcontratacion));
        return true;
      }

      // Online: NO optimistic update — onSnapshot fires automatically and is the single source of truth.
      // Applying a manual setLocations here would add the item twice (once optimistically, once from snapshot).
      const ubicarResult = await inventoryApi.ubicar({ shelfCode: targetShelf, articleCode, orderFab, position, operarioId, operarioName, ...(subcontratacion ? { subcontratacion: true } : {}) }, session);
      if (!ubicarResult?.ok) {
        throw new Error(`Fallo al guardar artículo en Firestore: ${ubicarResult?.ok === false ? 'backend rechazó la operación' : 'sin respuesta del servidor'}`);
      }
      return true;
    } catch (err: any) {
      console.error('[useShelf] Ubicar error:', err);
      setError(parseCallableError(err));
      // Rollback optimistic update
      setLocations(previousLocations);
      return false;
    }
  }, [getTargetShelf, validateShelfAccess, locations]);

  const ubicarMulti = useCallback(async (
    articleCode: string,
    orderFab: string,
    positions: string[],
    operarioId: string,
    operarioName: string,
    importe?: number,
    cantidad?: number,
    subcontratacion?: boolean,
  ): Promise<boolean> => {
    const previousLocations = JSON.parse(JSON.stringify(locations));
    try {
      const access = await validateShelfAccess('operate');
      if (!access.ok) return false;
      if (positions.length === 0) {
        setError('Debe seleccionar al menos una posicion.');
        return false;
      }
      const normalizedPositions = positions.map((p) => p.trim()).filter(Boolean);
      
      // ✅ FIX: Group positions by target shelf for multi-shelf support
      const positionsByShelf: Record<string, string[]> = {};
      normalizedPositions.forEach(pos => {
        const s = getTargetShelf(pos);
        if (!positionsByShelf[s]) positionsByShelf[s] = [];
        positionsByShelf[s].push(pos);
      });

      const session = getOperationalSession();

      if (!navigator.onLine) {
        Object.entries(positionsByShelf).forEach(([s, ps]) => {
          enqueueOfflineOperation('UBICAR_MULTI', { shelfCode: s, articleCode, orderFab, positions: ps, operarioId, operarioName, importe, cantidad, subcontratacion }, session);
          // Offline: apply optimistic update since onSnapshot won't fire
          setLocations((prev) => applyUbicarMulti(prev, s, articleCode, orderFab, ps, operarioId, operarioName, importe, cantidad, undefined, subcontratacion));
        });
        return true;
      }

      // Online: NO optimistic update — onSnapshot fires automatically and is the single source of truth.
      // Applying setLocations here would add items twice (once optimistically, once from snapshot).
      for (const [s, ps] of Object.entries(positionsByShelf)) {
        const ubicarMultiResult = await inventoryApi.ubicarMulti({ shelfCode: s, articleCode, orderFab, positions: ps, operarioId, operarioName, importe, cantidad, ...(subcontratacion ? { subcontratacion: true } : {}) }, session);
        if (!ubicarMultiResult?.ok) {
          throw new Error(`Fallo al ubicar múltiple en ${s}: ${ubicarMultiResult?.ok === false ? 'backend rechazó la operación' : 'sin respuesta del servidor'}`);
        }
      }
      return true;
    } catch (err: any) {
      console.error('[useShelf] UbicarMulti error:', err);
      setError(parseCallableError(err));
      // Rollback optimistic update
      setLocations(previousLocations);
      return false;
    }
  }, [getTargetShelf, validateShelfAccess, locations]);

  const retirar = useCallback(async (
    articleCode: string,
    orderFab: string,
    operarioId: string,
    operarioName: string,
  ): Promise<{ success: boolean; positions: string[]; error?: string }> => {
    const previousLocations = JSON.parse(JSON.stringify(locations));
    try {
      const access = await validateShelfAccess('operate');
      if (!access.ok) return { success: false, positions: [], error: 'Sin permiso para operar en esta estantería' };
      const session = getOperationalSession();
      
      // ✅ FIX: Resolve all shelves where this article exists in the current view
      const activeLocs = locations.filter(l => l.items.some(it => sameItem(it, articleCode, orderFab)));
      if (activeLocs.length === 0) {
        return { success: false, positions: [], error: 'Articulo no encontrado' };
      }

      const shelves = [...new Set(activeLocs.map(l => {
        const dashIdx = l.locationId.indexOf('-');
        return dashIdx !== -1 ? l.locationId.substring(0, dashIdx) : shelfCode;
      }))];

      if (!navigator.onLine) {
        const offlineResult = applyRetirar(previousLocations, articleCode, orderFab);
        setLocations(offlineResult.next);
        shelves.forEach(s => {
          enqueueOfflineOperation('RETIRAR', { shelfCode: s, articleCode, orderFab, operarioId, operarioName }, session);
        });
        return { success: true, positions: offlineResult.positions };
      }

      // Online: NO optimistic update — onSnapshot fires automatically and is the single source of truth.
      // Applying setLocations here would remove items twice (once optimistically, once from snapshot).
      let totalPositions: string[] = [];
      for (const s of shelves) {
        const retirarResult = await inventoryApi.retirar({ shelfCode: s, articleCode, orderFab, operarioId, operarioName }, session);
        if (!retirarResult?.ok) {
          throw new Error(`Fallo al retirar artículo de ${s}: ${retirarResult?.ok === false ? 'backend rechazó la operación' : 'sin respuesta del servidor'}`);
        }
        if (retirarResult.positions) totalPositions = [...totalPositions, ...retirarResult.positions];
      }

      return { success: true, positions: totalPositions };
    } catch (err: unknown) {
      const msg = parseCallableError(err);
      console.error('[useShelf] Retirar error:', msg);
      setError(msg);
      setLocations(previousLocations);
      return { success: false, positions: [], error: msg };
    }
  }, [shelfCode, validateShelfAccess, locations]);

  const retirarDeUbicacion = useCallback(async (
    articleCode: string,
    orderFab: string,
    position: string,
    operarioId: string,
    operarioName: string,
    presenceId?: string,
  ): Promise<{ success: boolean; position: string; error?: string }> => {
    try {
      const access = await validateShelfAccess('operate');
      if (!access.ok) return { success: false, position: '', error: 'Sin permiso para operar en esta estantería' };
      
      const targetShelf = getTargetShelf(position);
      const session = getOperationalSession();

      if (!navigator.onLine) {
        // Offline: apply optimistic update since onSnapshot won't fire
        const offlineResult = applyRetirarDeUbicacion(locations, articleCode, orderFab, position, presenceId);
        setLocations(offlineResult.next);
        enqueueOfflineOperation('RETIRAR_DE_UBICACION', { shelfCode: targetShelf, articleCode, orderFab, position, operarioId, operarioName }, session);
        return { success: true, position };
      }

      // Online: NO optimistic update — onSnapshot fires automatically and is the single source of truth.
      // The item would disappear twice (once optimistically, once from snapshot) causing ghost selections.
      const retirarUbicResult = await inventoryApi.retirarDeUbicacion({ shelfCode: targetShelf, articleCode, orderFab, position, operarioId, operarioName, ...(presenceId ? { presenceId } : {}) }, session);
      if (!retirarUbicResult?.ok) {
        throw new Error(`Fallo al retirar artículo de ubicación en Firestore: ${retirarUbicResult?.ok === false ? 'backend rechazó la operación' : 'sin respuesta del servidor'}`);
      }
      return { success: true, position };
    } catch (err: unknown) {
      const msg = parseCallableError(err);
      console.error('[useShelf] RetirarDeUbicacion error:', msg);
      setError(msg);
      return { success: false, position: '', error: msg };
    }
  }, [getTargetShelf, validateShelfAccess, locations]);

  const mover = useCallback(async (
    articleCode: string,
    orderFab: string,
    newPositions: string[],
    operarioId: string,
    operarioName: string,
    presenceIds?: string[],
  ): Promise<boolean> => {
    const previousLocations = JSON.parse(JSON.stringify(locations));
    try {
      const access = await validateShelfAccess('operate');
      if (!access.ok) return false;
      if (!shelfCode) {
        setError('No hay estanteria valida para mover.');
        return false;
      }
      const normalizedPositions = normalizePositions(newPositions);
      if (normalizedPositions.length === 0) {
        setError('Debe seleccionar al menos una ubicacion destino.');
        return false;
      }
      if (hasDuplicatePositions(normalizedPositions)) {
        setError('No se puede mover un articulo a posiciones destino repetidas.');
        return false;
      }
      // Presencias (no huecos): un hueco puede tener dos parciales de la misma pieza.
      const allPresences = locations.flatMap((loc) =>
        loc.items.filter((item) => sameItem(item, articleCode, orderFab)).map((item) => ({ position: loc.position, presenceId: item.presenceId })),
      );
      const activePresences = presenceIds?.length
        ? allPresences.filter((p) => p.presenceId && presenceIds.includes(p.presenceId))
        : allPresences;
      if (activePresences.length === 0) {
        setError('Articulo no encontrado o ya retirado');
        return false;
      }
      // Destinos válidos: tantos como presencias (1:1) o UN único destino,
      // que apila todas las presencias en la misma posición.
      if (activePresences.length !== normalizedPositions.length && normalizedPositions.length !== 1) {
        setError('Elige un hueco de destino por cada hueco que ocupa la pieza, o uno solo para juntarlas.');
        return false;
      }
      // Vista combinada PRE+MEC: la estantería FÍSICA depende de la posición
      // (014-046 → MEC). Se manda la de cada destino; el backend mueve entre PRE
      // y MEC porque son la misma estantería (antes se bloqueaba y, además, mover
      // dentro de Mecanizado fallaba siempre).
      const newLocations = normalizedPositions.map((p) => ({ shelfCode: getTargetShelf(p), position: p }));
      const payloadExtra = { newLocations, ...(presenceIds?.length ? { presenceIds } : {}) };
      const session = getOperationalSession();
      if (!navigator.onLine) {
        enqueueOfflineOperation('MOVER', { shelfCode, articleCode, orderFab, newPositions: normalizedPositions, ...payloadExtra, operarioId, operarioName }, session);
        setLocations((prev) => applyMover(prev, shelfCode, articleCode, orderFab, normalizedPositions, operarioId, operarioName));
        return true;
      }

      // Online: NO optimistic update — onSnapshot fires automatically and is the single source of truth.
      const moverResult = await inventoryApi.mover({ shelfCode, articleCode, orderFab, newPositions: normalizedPositions, ...payloadExtra, operarioId, operarioName }, session);
      if (!moverResult?.ok) {
        throw new Error(`Fallo al mover artículo en Firestore: ${moverResult?.ok === false ? 'backend rechazó la operación' : 'sin respuesta del servidor'}`);
      }
      return true;
    } catch (err: any) {
      console.error('[useShelf] Mover error:', err);
      setError(parseCallableError(err));
      // Rollback
      setLocations(previousLocations);
      return false;
    }
  }, [locations, shelfCode, validateShelfAccess, getTargetShelf]);

  const findArticle = useCallback(
    (articleCode: string, orderFab: string): ShelfLocationState[] =>
      locations.filter((loc) => loc.items.some((item) => sameItem(item, articleCode, orderFab))),
    [locations],
  );

  const emptyShelf = useCallback(async (
    operarioId: string,
    operarioName: string,
  ): Promise<boolean> => {
    const previousLocations = JSON.parse(JSON.stringify(locations));
    try {
      const access = await validateShelfAccess('operate');
      if (!access.ok) return false;
      if (!shelfCode) {
        setError('No hay estanteria para vaciar.');
        return false;
      }
      if (!navigator.onLine) {
        setError('Sin conexión. Vaciar estantería requiere conexión activa.');
        return false;
      }
      const session = getOperationalSession();
      // Optimistic: vaciar todas las ubicaciones localmente
      setLocations([]);
      const emptyResult = await inventoryApi.emptyShelf({ shelfCode, operarioId, operarioName }, session);
      if (!emptyResult?.ok) {
        throw new Error(`Fallo al vaciar estantería en Firestore: ${emptyResult?.ok === false ? 'backend rechazó la operación' : 'sin respuesta del servidor'}`);
      }
      return true;
    } catch (err: any) {
      console.error('[useShelf] EmptyShelf error:', err);
      setError(parseCallableError(err));
      // Rollback optimistic update
      setLocations(previousLocations);
      return false;
    }
  }, [shelfCode, validateShelfAccess, locations]);

  // Mismo cálculo que la franja de KPIs y el grid (universo = layout de la estantería).
  const { totalArticles, occupiedSlots: totalOccupied, emptySlots: totalEmpty } = useMemo(
    () => computeShelfKpis(locations, shelfDef),
    [locations, shelfDef],
  );

  return {
    locations,
    loading,
    error,
    shelfCode,
    shelfDef,
    ubicar,
    ubicarMulti,
    retirar,
    retirarDeUbicacion,
    mover,
    findArticle,
    emptyShelf,
    validateShelfAccess,
    takeLastError,
    totalArticles,
    totalOccupied,
    totalEmpty,
  };
};


