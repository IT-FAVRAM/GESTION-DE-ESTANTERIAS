/**
 * useCarretilleros — Roster de carretilleros para asignar solicitudes.
 *
 * Las reglas de Firestore impiden a OPERARIO/JEFE leer la colección `usuarios`
 * desde el cliente, así que el roster se obtiene por callable (op `carretilleros`)
 * y se cachea en memoria/localStorage para resiliencia.
 */

import { useCallback, useEffect, useState } from 'react';
import { pickupQueueApi, type CarretilleroOption } from '../lib/api/pickupQueueApi';
import { getOperationalSession } from '../lib/operationalSession';
import { parseCallableError } from '../lib/callableError';

const CACHE_KEY = 'wms_carretilleros_roster';

const readCache = (): CarretilleroOption[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const useCarretilleros = (enabled = true) => {
  const [carretilleros, setCarretilleros] = useState<CarretilleroOption[]>(() => readCache());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = getOperationalSession();
      const result = await pickupQueueApi.listCarretilleros(session);
      const list = Array.isArray(result?.carretilleros) ? result.carretilleros : [];
      setCarretilleros(list);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
    } catch (err: unknown) {
      setError(parseCallableError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { carretilleros, loading, error, refresh };
};
