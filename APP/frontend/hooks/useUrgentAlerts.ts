import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, functions } from '../lib/firebase';
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

  // Re-suscribe cuando cambia la sesión de Firebase. Sin esto, si el listener
  // se monta durante el arranque anónimo (antes de completar el login por
  // correo) recibía "Missing or insufficient permissions" y NUNCA se recuperaba
  // (deps vacías). Ahora cada cambio de usuario reabre el snapshot con el token
  // correcto, y solo se suscribe cuando hay un usuario autenticado.
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const subscribe = () => {
      if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
      if (!auth.currentUser) { setAlerts([]); setLoading(false); return; }

      const q = query(
        collection(db, COLLECTIONS.URGENT_ALERTS),
        where('resolved', '==', false),
        orderBy('createdAt', 'desc'),
      );

      unsubscribeSnapshot = onSnapshot(
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
    };

    const unsubscribeAuth = onAuthStateChanged(auth, () => subscribe());

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
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
