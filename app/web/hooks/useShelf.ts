/**
 * useShelf - Hook para datos de una estanteria en tiempo real.
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebaseV3';
import { inventoryApi } from '../lib/inventoryApi';
import { enqueueOfflineOperation } from '../lib/offlineQueue';
import { getOperationalSession } from '../lib/operationalSession';
import { resolveCurrentAuthSession } from '../domain/auth/authSessionResolver';
import { applyUbicar, applyRetirar, applyMover } from '../lib/shelfOptimisticUpdates';
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

const sameItem = (item: LocationItem, articleCode: string, orderFab: string) =>
  item.articleCode === articleCode && item.orderFab === orderFab;

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
  retirar: (articleCode: string, orderFab: string, operarioId: string, operarioName: string) => Promise<{ success: boolean; positions: string[] }>;
  mover: (articleCode: string, orderFab: string, newPositions: string[], operarioId: string, operarioName: string) => Promise<boolean>;
  findArticle: (articleCode: string, orderFab: string) => ShelfLocationState[];
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
    if (!shelfCode) return;
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
    // Keep a snapshot of current locations for rollback
    const previousLocations = locations;
    try {
      const access = await validateShelfAccess('operate');
      if (!access.ok) return false;
      if (!shelfCode || !position.trim()) {
        setError('No hay estanteria o posicion valida para ubicar.');
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
      
      await inventoryApi.ubicar({ shelfCode, articleCode, orderFab, position, operarioId, operarioName }, session);
      return true;
    } catch (err: any) {
      console.error('[useShelf] Ubicar error:', err);
      setError(err.message || 'Error al ubicar articulo');
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
  ): Promise<{ success: boolean; positions: string[] }> => {
    const previousLocations = locations;
    try {
      const access = await validateShelfAccess('operate');
      if (!access.ok) return { success: false, positions: [] };
      const session = getOperationalSession();
      
      let optimisticPositions: string[] = [];
      if (!navigator.onLine) {
        setLocations((prev) => {
          const result = applyRetirar(prev, articleCode, orderFab);
          optimisticPositions = result.positions;
          return result.next;
        });
        if (optimisticPositions.length === 0) {
          setError('Articulo no encontrado');
          return { success: false, positions: [] };
        }
        enqueueOfflineOperation('RETIRAR', { shelfCode, articleCode, orderFab, operarioId, operarioName }, session);
        return { success: true, positions: optimisticPositions };
      }

      // Optimistic update
      setLocations((prev) => {
        const result = applyRetirar(prev, articleCode, orderFab);
        optimisticPositions = result.positions;
        return result.next;
      });

      const { positions = [] } = await inventoryApi.retirar({ shelfCode, articleCode, orderFab, operarioId, operarioName }, session);
      return { success: true, positions: positions.length > 0 ? positions : optimisticPositions };
    } catch (err: any) {
      console.error('[useShelf] Retirar error:', err);
      setError(err.message || 'Error al retirar articulo');
      // Rollback
      setLocations(previousLocations);
      return { success: false, positions: [] };
    }
  }, [shelfCode, validateShelfAccess, locations]);

  const mover = useCallback(async (
    articleCode: string,
    orderFab: string,
    newPositions: string[],
    operarioId: string,
    operarioName: string,
  ): Promise<boolean> => {
    const previousLocations = locations;
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
        setLocations((prev) => applyMover(prev, articleCode, orderFab, normalizedPositions, operarioId, operarioName));
        return true;
      }

      // Optimistic update
      setLocations((prev) => applyMover(prev, articleCode, orderFab, normalizedPositions, operarioId, operarioName));

      await inventoryApi.mover({ shelfCode, articleCode, orderFab, newPositions: normalizedPositions, operarioId, operarioName }, session);
      return true;
    } catch (err: any) {
      console.error('[useShelf] Mover error:', err);
      setError(err.message || 'Error al mover articulo');
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
    retirar,
    mover,
    findArticle,
    totalArticles,
    totalOccupied,
    totalEmpty,
  };
};
