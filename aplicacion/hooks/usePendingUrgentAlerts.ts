import { useCallback, useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/firestoreSchema';

export interface PendingUrgentAlert {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

/**
 * usePendingUrgentAlerts — fallback persistente de avisos URGENTES para jefes de sección.
 *
 * Al iniciar sesión (consulta única, no en tiempo real) busca los avisos urgentes que
 * el jefe NO ha reconocido todavía. Si los hubiera, la app muestra un modal rojo
 * bloqueante (el mensaje que se perdió por no estar conectado). Si el jefe estaba
 * conectado y recibió el push en vivo, el frontend ya marcó ese aviso como reconocido
 * (`acknowledgePendingAlert`), así que no reaparece.
 *
 * Se consulta solo por `recipientUid` (índice de campo único) y se filtra
 * `acknowledged` en cliente para no requerir un índice compuesto.
 */
export const usePendingUrgentAlerts = (uid: string | null, enabled: boolean) => {
  const [alerts, setAlerts] = useState<PendingUrgentAlert[]>([]);

  useEffect(() => {
    if (!enabled || !uid) {
      setAlerts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(db, COLLECTIONS.PENDING_ALERTS),
          where('recipientUid', '==', uid),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const pending = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
          .filter((d) => (d as { acknowledged?: boolean }).acknowledged === false)
          .map((d) => ({
            id: d.id,
            title: String((d as { title?: unknown }).title ?? 'Aviso urgente'),
            body: String((d as { body?: unknown }).body ?? ''),
            createdAt: String((d as { createdAt?: unknown }).createdAt ?? ''),
          })) as PendingUrgentAlert[];
        pending.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setAlerts(pending);
      } catch (err) {
        console.warn('[usePendingUrgentAlerts] fetch failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, enabled]);

  const acknowledgeAll = useCallback(async () => {
    const current = alerts;
    setAlerts([]);
    await Promise.all(
      current.map((a) =>
        updateDoc(doc(db, COLLECTIONS.PENDING_ALERTS, a.id), {
          acknowledged: true,
          acknowledgedAt: new Date().toISOString(),
        }).catch((err) => console.warn('[usePendingUrgentAlerts] ack failed', err)),
      ),
    );
  }, [alerts]);

  return { alerts, acknowledgeAll };
};

/**
 * Marca un aviso urgente como reconocido (recibido en vivo por push). Evita que el
 * modal rojo lo muestre como "perdido" en el próximo inicio de sesión.
 */
export const acknowledgePendingAlert = async (alertId: string): Promise<void> => {
  if (!alertId) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.PENDING_ALERTS, alertId), {
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[acknowledgePendingAlert] failed', err);
  }
};
