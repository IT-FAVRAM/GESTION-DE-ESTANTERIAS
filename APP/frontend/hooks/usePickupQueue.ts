/**
 * usePickupQueue — Cola de recogidas del carretillero
 * Gestor de Estanterías WMS v3.0
 *
 * Suscripción en tiempo real a las solicitudes de recogida.
 * Las muestra agrupadas por sección y ordenadas por llegada.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { resolveCurrentAuthSession } from '../domain/auth/authSessionResolver';
import { pickupQueueApi } from '../lib/api/pickupQueueApi';
import { parseCallableError } from '../lib/callableError';
import { enqueueOfflineOperation } from '../lib/offline/offlineQueue';
import { getOperationalSession } from '../lib/operationalSession';
import {
  type PickupRequestDoc,
  type PickupStatus,
  type WarehouseSection,
  COLLECTIONS,
  getSectionForShelf,
  getShelfDefinition,
} from '../lib/firestoreSchema';

// ─── Types ───

export interface PickupRequest extends PickupRequestDoc {
  id: string;
}

export interface GroupedPickups {
  section: WarehouseSection;
  sectionName: string;
  requests: PickupRequest[];
}

/** Carretillero asignado (recibe popup + push; el resto lo ve en la cola). */
export interface RequestTarget {
  targetCarretilleroId?: string;
  targetCarretilleroName?: string;
}

/** Destino explícito (RECOGER y TRAER). */
export interface RequestDestination {
  destinationShelfCode?: string;
  destinationShelfName?: string;
  destinationSection?: WarehouseSection;
  destinationStation?: number | null;
}

export interface CreatePickupParams extends RequestTarget, RequestDestination {
  operarioId: string;
  operarioName: string;
  shelfCode: string;            // estantería del solicitante (autorización)
  articleToPickCode?: string;   // puede ser texto libre (no ubicado)
  articleToPickOrderFab?: string;
  // Origen — dónde recogerlo
  pickupShelfName?: string;
  pickupSection?: WarehouseSection;
  pickupStation?: number | null;
}

export interface CreateDeliveryParams extends RequestTarget, RequestDestination {
  operarioId: string;
  operarioName: string;
  shelfCode: string;            // estantería del solicitante (autorización)
  shelfName: string;
  articleCode: string;
  articleOrderFab: string;
  articleShelfName: string;
  articlePositions: string[];
}

// ─── Section display names ───
const SECTION_NAMES: Record<string, string> = {
  PRENSAS_MECANIZADO: 'Prensas-Mecanizado',
  MECANIZADO: 'Mecanizado',
  PLEGADORA: 'Plegadora',
  SOLDADURA: 'Soldadura',
  AUTOPLEGADORA: 'Autoplegadora',
  REPASADO: 'Repasado',
  ZINCADO: 'Zincado',
  PINTURA: 'Pintura',
  LASER: 'Láser',
  CALIDAD: 'Calidad',
  PUNZONADO: 'Punzonado',
  OTROS: 'Otros',
};

// ─── Hook ───

export const usePickupQueue = () => {
  const { firebaseUser } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<PickupRequest[]>([]);
  const [completedRequests, setCompletedRequests] = useState<PickupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Real-time subscription to pending requests ───
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      try {
        const session = await resolveCurrentAuthSession();
        const canReadQueue =
          session.authMethod === 'guest' ||
          session.role === 'CARRETILLERO' ||
          session.role === 'ADMIN' ||
          session.role === 'SUPERADMIN';

        if (!canReadQueue) {
          if (isMounted) {
            setPendingRequests([]);
            setCompletedRequests([]);
            setLoading(false);
            setError(null);
          }
          return;
        }

        const q = query(
          collection(db, COLLECTIONS.PICKUP_QUEUE),
          orderBy('createdAt', 'desc'),
          limit(200)
        );

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            if (!isMounted) return;
            const pending: PickupRequest[] = [];
            const completed: PickupRequest[] = [];

            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as PickupRequestDoc;
              const request: PickupRequest = { id: docSnap.id, ...data };

              if (data.status === 'COMPLETED') {
                completed.push(request);
              } else {
                pending.push(request);
              }
            });

            setPendingRequests(pending);
            setCompletedRequests(completed);
            setLoading(false);
            setError(null);
          },
          (err) => {
            if (!isMounted) return;
            console.error('[usePickupQueue] Listener error:', err);
            setError('Error cargando solicitudes');
            setLoading(false);
          }
        );
      } catch (err) {
        if (!isMounted) return;
        console.error('[usePickupQueue] Setup error:', err);
        setError('Error cargando solicitudes');
        setLoading(false);
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // ─── Grouped by section ───
  const groupedPending = useMemo((): GroupedPickups[] => {
    const groups: Record<string, PickupRequest[]> = {};

    for (const req of pendingRequests) {
      const section = req.shelfSection || 'OTROS';
      if (!groups[section]) groups[section] = [];
      groups[section].push(req);
    }

    return Object.entries(groups)
      .map(([section, requests]) => ({
        section: section as WarehouseSection,
        sectionName: SECTION_NAMES[section] || section,
        requests: requests.sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
      }))
      .sort((a, b) => {
        const oldestA = a.requests[0]?.createdAt || '';
        const oldestB = b.requests[0]?.createdAt || '';
        return new Date(oldestA).getTime() - new Date(oldestB).getTime();
      });
  }, [pendingRequests]);

  // ─── Solicitudes asignadas a MÍ y aún no confirmadas ("Recibido") ───
  // Alimentan el popup bloqueante del carretillero.
  const myUnacknowledged = useMemo((): PickupRequest[] => {
    const uid = firebaseUser?.uid;
    if (!uid) return [];
    return pendingRequests
      .filter((r) => r.targetCarretilleroId === uid && r.acknowledged !== true)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [pendingRequests, firebaseUser?.uid]);

  // ─── Create pickup request (SE LLEVE / RECOGER) ───
  const createPickupRequest = useCallback(async (params: CreatePickupParams): Promise<boolean> => {
    try {
      const shelfDef = getShelfDefinition(params.shelfCode);
      const section = getSectionForShelf(params.shelfCode);
      const session = getOperationalSession();

      const payload: Record<string, unknown> = {
        requestType: 'RECOGER',
        operarioId: params.operarioId,
        operarioName: params.operarioName,
        shelfCode: params.shelfCode,
        shelfSection: section,
        shelfName: shelfDef?.name || params.shelfCode,
        ...(params.targetCarretilleroId ? {
          targetCarretilleroId: params.targetCarretilleroId,
          targetCarretilleroName: params.targetCarretilleroName || '',
        } : {}),
        ...(params.articleToPickCode ? { articleToPickCode: params.articleToPickCode } : {}),
        ...(params.articleToPickOrderFab ? { articleToPickOrderFab: params.articleToPickOrderFab } : {}),
        ...(params.pickupShelfName ? { pickupShelfName: params.pickupShelfName } : {}),
        ...(params.pickupSection ? { pickupSection: params.pickupSection } : {}),
        ...(params.pickupStation != null ? { pickupStation: params.pickupStation } : {}),
        ...(params.destinationShelfCode ? { destinationShelfCode: params.destinationShelfCode } : {}),
        ...(params.destinationShelfName ? { destinationShelfName: params.destinationShelfName } : {}),
        ...(params.destinationSection ? { destinationSection: params.destinationSection } : {}),
        ...(params.destinationStation != null ? { destinationStation: params.destinationStation } : {}),
      };

      if (!navigator.onLine) {
        const tempRequest: PickupRequest = {
          id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          requestType: 'RECOGER',
          operarioId: params.operarioId,
          operarioName: params.operarioName,
          shelfSection: section,
          shelfCode: params.shelfCode,
          shelfName: shelfDef?.name || params.shelfCode,
          targetCarretilleroId: params.targetCarretilleroId,
          targetCarretilleroName: params.targetCarretilleroName,
          articleToPickCode: params.articleToPickCode,
          articleToPickOrderFab: params.articleToPickOrderFab,
          pickupShelfName: params.pickupShelfName,
          pickupSection: params.pickupSection,
          pickupStation: params.pickupStation ?? null,
          destinationShelfCode: params.destinationShelfCode,
          destinationShelfName: params.destinationShelfName,
          destinationSection: params.destinationSection,
          destinationStation: params.destinationStation ?? null,
          status: 'PENDING',
          acknowledged: false,
          acknowledgedAt: null,
          acknowledgedBy: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
          completedBy: null,
        };
        setPendingRequests((prev) => [tempRequest, ...prev]);
        enqueueOfflineOperation('AVISAR_CARRETILLERO', payload, session);
        return true;
      }

      const result = await pickupQueueApi.create(payload, session);
      if (!result?.ok) throw new Error('El servidor rechazó la solicitud de recogida');
      return true;

    } catch (err: unknown) {
      const msg = parseCallableError(err);
      console.error('[usePickupQueue] Create error:', msg);
      setError(msg);
      return false;
    }
  }, []);

  // ─── Create delivery request (ME TRAIGA / TRAER) ───
  const createDeliveryRequest = useCallback(async (params: CreateDeliveryParams): Promise<boolean> => {
    try {
      const section = getSectionForShelf(params.shelfCode);
      const session = getOperationalSession();

      const payload: Record<string, unknown> = {
        requestType: 'TRAER',
        operarioId: params.operarioId,
        operarioName: params.operarioName,
        shelfCode: params.shelfCode,
        shelfSection: section,
        shelfName: params.shelfName,
        articleCode: params.articleCode,
        articleOrderFab: params.articleOrderFab,
        articleShelfName: params.articleShelfName,
        articlePositions: params.articlePositions,
        ...(params.targetCarretilleroId ? {
          targetCarretilleroId: params.targetCarretilleroId,
          targetCarretilleroName: params.targetCarretilleroName || '',
        } : {}),
        ...(params.destinationShelfCode ? { destinationShelfCode: params.destinationShelfCode } : {}),
        ...(params.destinationShelfName ? { destinationShelfName: params.destinationShelfName } : {}),
        ...(params.destinationSection ? { destinationSection: params.destinationSection } : {}),
        ...(params.destinationStation != null ? { destinationStation: params.destinationStation } : {}),
      };

      if (!navigator.onLine) {
        const tempRequest: PickupRequest = {
          id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          requestType: 'TRAER',
          operarioId: params.operarioId,
          operarioName: params.operarioName,
          shelfSection: section,
          shelfCode: params.shelfCode,
          shelfName: params.shelfName,
          targetCarretilleroId: params.targetCarretilleroId,
          targetCarretilleroName: params.targetCarretilleroName,
          articleCode: params.articleCode,
          articleOrderFab: params.articleOrderFab,
          articleShelfName: params.articleShelfName,
          articlePositions: params.articlePositions,
          destinationShelfCode: params.destinationShelfCode,
          destinationShelfName: params.destinationShelfName,
          destinationSection: params.destinationSection,
          destinationStation: params.destinationStation ?? null,
          status: 'PENDING',
          acknowledged: false,
          acknowledgedAt: null,
          acknowledgedBy: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
          completedBy: null,
        };
        setPendingRequests((prev) => [tempRequest, ...prev]);
        enqueueOfflineOperation('SOLICITAR_TRASLADO', payload, session);
        return true;
      }

      const result = await pickupQueueApi.create(payload, session);
      if (!result?.ok) throw new Error('El servidor rechazó la solicitud de traslado');
      return true;
    } catch (err: unknown) {
      const msg = parseCallableError(err);
      console.error('[usePickupQueue] Create delivery error:', msg);
      setError(msg);
      return false;
    }
  }, []);

  // ─── Create recepción request (RECEPCIÓN — material recepcionado para recoger) ───
  // Sin datos que indicar: el carretillero solo tiene que ir a Recepciones a por el
  // material recepcionado. Igual que el resto de avisos, se asigna a un carretillero.
  const createRecepcionRequest = useCallback(async (params: {
    operarioId: string;
    operarioName: string;
    targetCarretilleroId?: string;
    targetCarretilleroName?: string;
  }): Promise<boolean> => {
    try {
      const session = getOperationalSession();
      const RECEPCION_SHELF = 'REC';
      const payload: Record<string, unknown> = {
        requestType: 'RECEPCION',
        operarioId: params.operarioId,
        operarioName: params.operarioName,
        shelfCode: RECEPCION_SHELF,
        shelfName: 'Recepciones',
        ...(params.targetCarretilleroId ? {
          targetCarretilleroId: params.targetCarretilleroId,
          targetCarretilleroName: params.targetCarretilleroName || '',
        } : {}),
      };

      if (!navigator.onLine) {
        enqueueOfflineOperation('AVISAR_CARRETILLERO', payload, session);
        return true;
      }

      const result = await pickupQueueApi.create(payload, session);
      if (!result?.ok) throw new Error('El servidor rechazó el aviso de recepción');
      return true;
    } catch (err: unknown) {
      const msg = parseCallableError(err);
      console.error('[usePickupQueue] Create recepción error:', msg);
      setError(msg);
      return false;
    }
  }, []);

  // ─── Acknowledge ("Recibido" en el popup bloqueante) ───
  const acknowledgeRequest = useCallback(async (requestId: string): Promise<boolean> => {
    // Optimista: marcar como confirmada localmente para cerrar el popup ya.
    setPendingRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, acknowledged: true } : r)),
    );
    try {
      const session = getOperationalSession();
      if (!navigator.onLine) {
        enqueueOfflineOperation('CONFIRMAR_RECEPCION', { requestId }, session);
        return true;
      }
      const result = await pickupQueueApi.acknowledge({ requestId }, session);
      if (!result?.ok) throw new Error('El servidor rechazó la confirmación');
      return true;
    } catch (err: unknown) {
      console.error('[usePickupQueue] Acknowledge error:', err);
      setError(parseCallableError(err));
      // Revertir el optimismo si falló
      setPendingRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, acknowledged: false } : r)),
      );
      return false;
    }
  }, []);

  // ─── Complete pickup request (carretillero does this) ───
  const completeRequest = useCallback(async (
    requestId: string,
    completedByUid: string,
  ): Promise<boolean> => {
    const previousPending = pendingRequests;
    const completedReq = pendingRequests.find((req) => req.id === requestId);
    try {
      const session = getOperationalSession();
      if (completedReq) {
        const completedWithMeta: PickupRequest = {
          ...completedReq,
          status: 'COMPLETED' as PickupStatus,
          completedAt: new Date().toISOString(),
          completedBy: completedByUid,
        };
        setPendingRequests((prev) => prev.filter((req) => req.id !== requestId));
        setCompletedRequests((prev) => [completedWithMeta, ...prev]);
      }

      if (!navigator.onLine) {
        enqueueOfflineOperation('COMPLETAR_RECOGIDA', { requestId, completedByUid }, session);
        return true;
      }

      const result = await pickupQueueApi.complete({ requestId, completedByUid }, session);
      if (!result?.ok) throw new Error('El servidor rechazó completar la recogida');
      return true;

    } catch (err: any) {
      console.error('[usePickupQueue] Complete error:', err);
      setError(parseCallableError(err));
      setPendingRequests(previousPending);
      if (completedReq) setCompletedRequests((prev) => prev.filter((r) => r.id !== requestId));
      return false;
    }
  }, [pendingRequests]);

  return {
    pendingRequests,
    completedRequests,
    groupedPending,
    myUnacknowledged,
    loading,
    error,
    pendingCount: pendingRequests.length,
    createPickupRequest,
    createDeliveryRequest,
    createRecepcionRequest,
    acknowledgeRequest,
    completeRequest,
  };
};
