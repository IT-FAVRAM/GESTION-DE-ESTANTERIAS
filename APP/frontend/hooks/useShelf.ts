/**
 * useShelf - Hook para datos de una estanteria en tiempo real.
 */

import { useState, useEffect, useCallback } from 'react';
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
  ubicar: (articleCode: string, orderFab: string, position: string, operarioId: string, operarioName: string) => Promise<boolean>;
  ubicarMulti: (articleCode: string, orderFab: string, positions: string[], operarioId: string, operarioName: string, importe?: number, cantidad?: number) => Promise<boolean>;
  retirar: (articleCode: string, orderFab: string, operarioId: string, operarioName: string) => Promise<{ success: boolean; positions: string[]; error?: string }>;
  retirarDeUbicacion: (articleCode: string, orderFab: string, position: string, operarioId: string, operarioName: string, presenceId?: string) => Promise<{ success: boolean; position: string; error?: string }>;
  mover: (articleCode: string, orderFab: string, newPositions: string[], operarioId: string, operarioName: string) => Promise<boolean>;
  findArticle: (articleCode: string, orderFab: string) => ShelfLocationState[];
  emptyShelf: (operarioId: string, operarioName: string) => Promise<boolean>;
  validateShelfAccess: (purpose: 'view' | 'operate') => Promise<{ ok: boolean }>;
  totalArticles: number;
  totalOccupied: number;
  totalEmpty: number;
}

export const useShelf = (shelfCode: string): UseShelfReturn => {
  const [locations, setLocations] = useState<ShelfLocationState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const shelfDef = getShelfDefinition(shelfCode);

  // ── Access validation ────────────────────────────────────────────────────

  const validateShelfAccess = useCallback(async (purpose: 'view' | 'operate') => {
    const session = await resolveCurrentAuthSession();
    if (!session.role) {
      setError('No hay una sesion activa para esta operacion.');
      return { ok: false, session };
    }
    if (!session.capabilities.canAccessShelf(shelfCode)) {
      setError(`La sesion ${session.role} no puede acceder a la estanteria ${shelfCode}.`);
      return { ok: false, session };
    }
    if (purpose === 'operate' && !session.capabilities.canOperateShelf) {
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

  const ubicar = useCallback(async (
    articleCode: string,
    orderFab: string,
    position: string,
    operarioId: string,
    operarioName: string,
  ): Promise<boolean> => {
    // Keep a DEEP COPY snapshot of current locations for rollback
    // Critical: must be deep copy to prevent mutations when snapshot arrives
    const previousLocations = JSON.parse(JSON.stringify(locations));
    try {
      const access = await validateShelfAccess('operate');
      if (!access.ok) return false;
      if (!shelfCode || !position.trim()) {
        setError('No hay estanteria o posicion valida para ubicar.');
        return false;
      }
      if (!articleCode.trim() || !orderFab.trim()) {
        setError('Codigo de articulo y OF son obligatorios para ubicar.');
        return false;
      }
      const session = getOperationalSession();
      if (!navigator.onLine) {
        enqueueOfflineOperation('UBICAR', { shelfCode, articleCode, orderFab, position, operarioId, operarioName }, session);
        setLocations((prev) => applyUbicar(prev, shelfCode, articleCode, orderFab, position, operarioId, operarioName));
        return true;
      }
      
      // Optimistic Update
      setLocations((prev) => applyUbicar(prev, shelfCode, articleCode, orderFab, position, operarioId, operarioName));

      const ubicarResult = await inventoryApi.ubicar({ shelfCode, articleCode, orderFab, position, operarioId, operarioName }, session);
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
  }, [shelfCode, validateShelfAccess, locations]);

  const ubicarMulti = useCallback(async (
    articleCode: string,
    orderFab: string,
    positions: string[],
    operarioId: string,
    operarioName: string,
    importe?: number,
    cantidad?: number,
  ): Promise<boolean> => {
    const previousLocations = JSON.parse(JSON.stringify(locations));
    try {
      const access = await validateShelfAccess('operate');
      if (!access.ok) return false;
      if (!shelfCode || positions.length === 0) {
        setError('No hay estanteria o posiciones validas para ubicar.');
        return false;
      }
      const normalizedPositions = positions.map((p) => p.trim()).filter(Boolean);
      if (normalizedPositions.length === 0) {
        setError('Debe seleccionar al menos una posicion.');
        return false;
      }
      // ✅ FIX #4: Validar importe y cantidad ANTES de optimistic update
      if (importe !== undefined) {
        if (!Number.isFinite(importe) || importe < 0) {
          setError('Importe debe ser un número válido ≥ 0.');
          return false;
        }
      }
      if (cantidad !== undefined) {
        if (!Number.isFinite(cantidad) || cantidad < 0) {
          setError('Cantidad debe ser un número válido ≥ 0.');
          return false;
        }
      }
      const session = getOperationalSession();

      if (!navigator.onLine) {
        enqueueOfflineOperation('UBICAR_MULTI', { shelfCode, articleCode, orderFab, positions: normalizedPositions, operarioId, operarioName, importe, cantidad }, session);
        setLocations((prev) => applyUbicarMulti(prev, shelfCode, articleCode, orderFab, normalizedPositions, operarioId, operarioName, importe, cantidad));
        return true;
      }

      // Optimistic update: apply all positions at once
      setLocations((prev) => applyUbicarMulti(prev, shelfCode, articleCode, orderFab, normalizedPositions, operarioId, operarioName, importe, cantidad));

      // Single API call with all positions
      const ubicarMultiResult = await inventoryApi.ubicarMulti({ shelfCode, articleCode, orderFab, positions: normalizedPositions, operarioId, operarioName, importe, cantidad }, session);
      if (!ubicarMultiResult?.ok) {
        throw new Error(`Fallo al ubicar múltiple en Firestore: ${ubicarMultiResult?.ok === false ? 'backend rechazó la operación' : 'sin respuesta del servidor'}`);
      }
      return true;
    } catch (err: any) {
      console.error('[useShelf] UbicarMulti error:', err);
      setError(parseCallableError(err));
      // Rollback optimistic update
      setLocations(previousLocations);
      return false;
    }
  }, [shelfCode, validateShelfAccess, locations]);

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
      
      if (!navigator.onLine) {
        const offlineResult = applyRetirar(previousLocations, articleCode, orderFab);
        if (offlineResult.positions.length === 0) {
          const msg = 'Articulo no encontrado';
          setError(msg);
          return { success: false, positions: [], error: msg };
        }
        setLocations(offlineResult.next);
        enqueueOfflineOperation('RETIRAR', { shelfCode, articleCode, orderFab, operarioId, operarioName }, session);
        return { success: true, positions: offlineResult.positions };
      }

      // Optimistic update
      let optimisticPositions: string[] = [];
      setLocations((prev) => {
        const result = applyRetirar(prev, articleCode, orderFab);
        optimisticPositions = result.positions;
        return result.next;
      });

      const retirarResult = await inventoryApi.retirar({ shelfCode, articleCode, orderFab, operarioId, operarioName }, session);
      if (!retirarResult?.ok) {
        throw new Error(`Fallo al retirar artículo de Firestore: ${retirarResult?.ok === false ? 'backend rechazó la operación' : 'sin respuesta del servidor'}`);
      }
      const { positions = [] } = retirarResult;
      return { success: true, positions: positions.length > 0 ? positions : optimisticPositions };
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
    const previousLocations = JSON.parse(JSON.stringify(locations));
    try {
      const access = await validateShelfAccess('operate');
      if (!access.ok) return { success: false, position: '', error: 'Sin permiso para operar en esta estantería' };
      const session = getOperationalSession();
      const optimisticResult = applyRetirarDeUbicacion(previousLocations, articleCode, orderFab, position, presenceId);

      if (!navigator.onLine) {
        setLocations(optimisticResult.next);
        enqueueOfflineOperation('RETIRAR_DE_UBICACION', { shelfCode, articleCode, orderFab, position, operarioId, operarioName }, session);
        return { success: true, position };
      }

      // Online: apply optimistic update before API call
      setLocations(optimisticResult.next);

      const retirarUbicResult = await inventoryApi.retirarDeUbicacion({ shelfCode, articleCode, orderFab, position, operarioId, operarioName, ...(presenceId ? { presenceId } : {}) }, session);
      if (!retirarUbicResult?.ok) {
        throw new Error(`Fallo al retirar artículo de ubicación en Firestore: ${retirarUbicResult?.ok === false ? 'backend rechazó la operación' : 'sin respuesta del servidor'}`);
      }
      return { success: true, position };
    } catch (err: unknown) {
      const msg = parseCallableError(err);
      console.error('[useShelf] RetirarDeUbicacion error:', msg);
      setError(msg);
      setLocations(previousLocations);
      return { success: false, position: '', error: msg };
    }
  }, [shelfCode, validateShelfAccess, locations]);

  const mover = useCallback(async (
    articleCode: string,
    orderFab: string,
    newPositions: string[],
    operarioId: string,
    operarioName: string,
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
      const activePresences = locations.filter((loc) =>
        loc.items.some((item) => sameItem(item, articleCode, orderFab)),
      );
      if (activePresences.length === 0) {
        setError('Articulo no encontrado o ya retirado');
        return false;
      }
      if (activePresences.length !== normalizedPositions.length) {
        setError('El numero de huecos destino no coincide con las presencias activas del articulo.');
        return false;
      }
      const session = getOperationalSession();
      if (!navigator.onLine) {
        enqueueOfflineOperation('MOVER', { shelfCode, articleCode, orderFab, newPositions: normalizedPositions, operarioId, operarioName }, session);
        setLocations((prev) => applyMover(prev, shelfCode, articleCode, orderFab, normalizedPositions, operarioId, operarioName));
        return true;
      }

      // Optimistic update
      setLocations((prev) => applyMover(prev, shelfCode, articleCode, orderFab, normalizedPositions, operarioId, operarioName));

      const moverResult = await inventoryApi.mover({ shelfCode, articleCode, orderFab, newPositions: normalizedPositions, operarioId, operarioName }, session);
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
  }, [locations, shelfCode, validateShelfAccess]);

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

  const totalArticles = locations.reduce((sum, loc) => sum + loc.items.length, 0);
  const totalOccupied = locations.filter((loc) => !loc.isEmpty).length;
  const totalEmpty = locations.filter((loc) => loc.isEmpty).length;

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
    totalArticles,
    totalOccupied,
    totalEmpty,
  };
};


