import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { chaperoApi } from '../lib/api/chaperoApi';
import { parseCallableError } from '../lib/callableError';
import { getOperationalSession } from '../lib/operationalSession';
import {
  type ChaperoPositionDoc,
  generateChaperoPositions,
  formatChaperoPositionId,
  CHAPERO_COLS,
  CHAPERO_LEVELS,
} from '../lib/schema/chapero';

export interface UseChaperoReturn {
  positions: ChaperoPositionDoc[];
  loading: boolean;
  error: string | null;
  ubicar: (
    positionId: string,
    material: string,
    espesor: string,
    locatedByName: string,
    spec?: string,
    albaran?: string,
  ) => Promise<boolean>;
  retirar: (positionId: string, itemIds: string[]) => Promise<boolean>;
  mover: (fromPositionId: string, toPositionId: string) => Promise<boolean>;
  searchByMaterial: (query: string) => ChaperoPositionDoc[];
}

const ALL_POSITION_IDS = generateChaperoPositions();

const buildEmptyPositions = (): ChaperoPositionDoc[] =>
  ALL_POSITION_IDS.map((positionId) => {
    const side = positionId[0] as 'L' | 'R';
    const column = parseInt(positionId.slice(1, 3), 10);
    const level = parseInt(positionId[4], 10);
    return { positionId, side, column, level, items: [], isEmpty: true };
  });

export const useChapero = (): UseChaperoReturn => {
  const [positions, setPositions] = useState<ChaperoPositionDoc[]>(buildEmptyPositions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const colRef = collection(db, 'chapero_positions');
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const byId = new Map<string, ChaperoPositionDoc>();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Partial<ChaperoPositionDoc>;
          const positionId = docSnap.id;
          const side = positionId[0] as 'L' | 'R';
          const column = parseInt(positionId.slice(1, 3), 10);
          const level = parseInt(positionId[4], 10);
          byId.set(positionId, {
            positionId,
            side,
            column,
            level,
            items: data.items ?? [],
            isEmpty: data.isEmpty ?? (data.items?.length === 0),
          });
        });

        // Merge snapshot data over the full grid of 160 positions
        setPositions(
          ALL_POSITION_IDS.map((posId) => {
            const fromDb = byId.get(posId);
            if (fromDb) return fromDb;
            const side = posId[0] as 'L' | 'R';
            const column = parseInt(posId.slice(1, 3), 10);
            const level = parseInt(posId[4], 10);
            return { positionId: posId, side, column, level, items: [], isEmpty: true };
          }),
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message || 'Error al cargar el chapero');
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  const getSession = () => {
    const s = getOperationalSession();
    if (!s) return undefined;
    return { role: s.role, deviceId: s.deviceId, operarioId: s.operarioId, operarioName: s.operarioName ?? undefined };
  };

  const ubicar = useCallback(
    async (positionId: string, material: string, espesor: string, locatedByName: string, spec?: string, albaran?: string): Promise<boolean> => {
      try {
        const payload: Record<string, unknown> = { positionId, material, espesor, locatedByName };
        if (spec) payload.spec = spec;
        if (albaran) payload.albaran = albaran;
        await chaperoApi.ubicar(payload, getSession());
        return true;
      } catch (err: unknown) {
        setError(parseCallableError(err));
        return false;
      }
    },
    [],
  );

  const retirar = useCallback(async (positionId: string, itemIds: string[]): Promise<boolean> => {
    try {
      await chaperoApi.retirar({ positionId, itemIds }, getSession());
      return true;
    } catch (err: unknown) {
      setError(parseCallableError(err));
      return false;
    }
  }, []);

  const mover = useCallback(async (fromPositionId: string, toPositionId: string): Promise<boolean> => {
    try {
      await chaperoApi.mover({ fromPositionId, toPositionId }, getSession());
      return true;
    } catch (err: unknown) {
      setError(parseCallableError(err));
      return false;
    }
  }, []);

  const searchByMaterial = useCallback(
    (query: string): ChaperoPositionDoc[] => {
      if (!query.trim()) return [];
      const q = query.trim().toUpperCase();
      return positions.filter(
        (p) =>
          !p.isEmpty &&
          p.items.some(
            (it) =>
              it.material.includes(q) ||
              it.espesor.includes(q) ||
              (it.spec?.includes(q) ?? false),
          ),
      );
    },
    [positions],
  );

  return { positions, loading, error, ubicar, retirar, mover, searchByMaterial };
};
