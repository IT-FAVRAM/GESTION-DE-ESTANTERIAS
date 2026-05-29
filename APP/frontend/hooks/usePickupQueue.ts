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
  doc,
  onSnapshot, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  type DocumentData 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { resolveCurrentAuthSession } from '../domain/auth/authSessionResolver';
import { pickupQueueApi } from '../lib/api/pickupQueueApi';
import { parseCallableError } from '../lib/callableError';
import { enqueueOfflineOperation } from '../lib/offline/offlineQueue';
import { getOperationalSession } from '../lib/operationalSession';
import {
  type PickupRequestDoc,
  type PickupStatus,
  type WarehouseSection,
  type HistoryEntryDoc,
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

// ─── Section display names ───
const SECTION_NAMES: Record<string, string> = {
  MECANIZADO: 'Mecanizado',
  PLEGADORA: 'Plegadora',
  SOLDADURA: 'Soldadura',
  AUTOPLEGADORA: 'Autoplegadora',
  REPASADO: 'Repasado',
  PINTURA: 'Pintura',
  LASER: 'Láser',
  CALIDAD: 'Calidad',
  OTROS: 'Otros',
};

// ─── Hook ───

export const usePickupQueue = () => {
  const [pendingRequests, setPendingRequests] = useState<PickupRequest[]>([]);
  const [completedRequests, setCompletedRequests] = useState<PickupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Real-time subscription to pending requests ───
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
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
    };

    setup().catch((err) => {
      if (!isMounted) return;
      console.error('[usePickupQueue] Setup error:', err);
      setError('Error cargando solicitudes');
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
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
        // Sort groups by oldest request first
        const oldestA = a.requests[0]?.createdAt || '';
        const oldestB = b.requests[0]?.createdAt || '';
        return new Date(oldestA).getTime() - new Date(oldestB).getTime();
      });
  }, [pendingRequests]);

  // ─── Create pickup request (operario sends this) ───
  const createPickupRequest = useCallback(async (
    operarioId: string,
    operarioName: string,
    shelfCode: string,
    articleToPickCode?: string,
    articleToPickOrderFab?: string,
    destinationShelfCode?: string,
    destinationShelfName?: string,
  ): Promise<boolean> => {
    try {
      const shelfDef = getShelfDefinition(shelfCode);
      const section = getSectionForShelf(shelfCode);
      const session = getOperationalSession();

      const payload: Record<string, unknown> = {
        requestType: 'RECOGER',
        operarioId, operarioName, shelfCode,
        shelfSection: section, shelfName: shelfDef?.name || shelfCode,
        ...(articleToPickCode ? { articleToPickCode } : {}),
        ...(articleToPickOrderFab ? { articleToPickOrderFab } : {}),
        ...(destinationShelfCode ? { destinationShelfCode } : {}),
        ...(destinationShelfName ? { destinationShelfName } : {}),
      };

      if (!navigator.onLine) {
        const tempRequest: PickupRequest = {
          id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          requestType: 'RECOGER',
          operarioId,
          operarioName,
          shelfSection: section,
          shelfCode,
          shelfName: shelfDef?.name || shelfCode,
          articleToPickCode,
          articleToPickOrderFab,
          destinationShelfCode,
          destinationShelfName,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          completedAt: null,
          completedBy: null,
        };
        setPendingRequests((prev) => [tempRequest, ...prev]);
        enqueueOfflineOperation('AVISAR_CARRETILLERO', payload, session);
        return true;
      }

      await pickupQueueApi.create(payload, session);
      return true;

    } catch (err: unknown) {
      const msg = parseCallableError(err);
      console.error('[usePickupQueue] Create error:', msg);
      setError(msg);
      return false;
    }
  }, []);

  // ─── Create delivery request — operario pide que le traigan un artículo ───
  const createDeliveryRequest = useCallback(async (
    operarioId: string,
    operarioName: string,
    requesterShelfCode: string,
    requesterShelfName: string,
    articleCode: string,
    articleOrderFab: string,
    articleShelfName: string,
    articlePositions: string[],
  ): Promise<boolean> => {
    try {
      const section = getSectionForShelf(requesterShelfCode);
      const session = getOperationalSession();

      if (!navigator.onLine) {
        const tempRequest: PickupRequest = {
          id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          operarioId,
          operarioName,
          shelfSection: section,
          shelfCode: requesterShelfCode,
          shelfName: requesterShelfName,
          requestType: 'TRAER',
          articleCode,
          articleOrderFab,
          articleShelfName,
          articlePositions,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          completedAt: null,
          completedBy: null,
        };
        setPendingRequests((prev) => [tempRequest, ...prev]);
        enqueueOfflineOperation('SOLICITAR_TRASLADO', {
          operarioId, operarioName,
          shelfCode: requesterShelfCode, shelfSection: section, shelfName: requesterShelfName,
          requestType: 'TRAER',
          articleCode, articleOrderFab, articleShelfName, articlePositions,
        }, session);
        return true;
      }

      await pickupQueueApi.create({
        operarioId, operarioName,
        shelfCode: requesterShelfCode, shelfSection: section, shelfName: requesterShelfName,
        requestType: 'TRAER',
        articleCode, articleOrderFab, articleShelfName, articlePositions,
      }, session);
      return true;
    } catch (err: unknown) {
      const msg = parseCallableError(err);
      console.error('[usePickupQueue] Create delivery error:', msg);
      setError(msg);
      return false;
    }
  }, []);

  // ─── Complete pickup request (carretillero does this) ───
  const completeRequest = useCallback(async (
    requestId: string,
    completedByUid: string,
  ): Promise<boolean> => {
    try {
      const session = getOperationalSession();
      const completedReq = pendingRequests.find((req) => req.id === requestId);
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

      await pickupQueueApi.complete({ requestId, completedByUid }, session);

      return true;

    } catch (err: any) {
      console.error('[usePickupQueue] Complete error:', err);
      setError(parseCallableError(err));
      return false;
    }
  }, [pendingRequests]);

  return {
    pendingRequests,
    completedRequests,
    groupedPending,
    loading,
    error,
    pendingCount: pendingRequests.length,
    createPickupRequest,
    createDeliveryRequest,
    completeRequest,
  };
};


