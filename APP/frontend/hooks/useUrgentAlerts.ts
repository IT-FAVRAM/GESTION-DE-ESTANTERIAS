import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { COLLECTIONS, type UrgentAlert } from '../lib/firestoreSchema';

interface CreateAlertData {
  text: string;
  articleCode: string;
  articleName?: string;
  orderId: string;
  orderNumber?: string;
}

/**
 * useUrgentAlerts — alertas de urgencia activas (resolved = false).
 * Lectura en tiempo real. Acciones disponibles para ADMIN/SUPERADMIN.
 */
export const useUrgentAlerts = () => {
  const [alerts, setAlerts] = useState<UrgentAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.URGENT_ALERTS),
      where('resolved', '==', false),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: UrgentAlert[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<UrgentAlert, 'id'>),
        }));
        setAlerts(docs);
        setLoading(false);
      },
      (err) => {
        console.warn('[useUrgentAlerts] snapshot error', err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const createAlert = useCallback(async (data: CreateAlertData) => {
    const callable = httpsCallable(functions, 'createUrgentAlert');
    await callable(data);
  }, []);

  const resolveAlert = useCallback(async (alertId: string) => {
    const callable = httpsCallable(functions, 'resolveUrgentAlert');
    await callable({ alertId });
  }, []);

  const deleteAlert = useCallback(async (alertId: string) => {
    const callable = httpsCallable(functions, 'deleteUrgentAlert');
    await callable({ alertId });
  }, []);

  return { alerts, loading, createAlert, resolveAlert, deleteAlert };
};
