import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
  getFirestore,
} from 'firebase/firestore';
import type { PinnedUrgency } from '../lib/schema/chat';

/**
 * Hook para escuchar los avisos fijados en tiempo real.
 * Retorna array ordenado por fecha de fijación (más recientes primero).
 */
export const usePinnedUrgencies = () => {
  const [urgencies, setUrgencies] = useState<PinnedUrgency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirestore();
    let unsubscribe: Unsubscribe | null = null;

    try {
      const q = query(
        collection(db, 'chat', 'general', 'pinned'),
        orderBy('pinnedAt', 'desc')
      );

      unsubscribe = onSnapshot(q, (snap) => {
        const docs = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PinnedUrgency[];

        setUrgencies(docs);
        setLoading(false);
      });
    } catch (e) {
      console.error('Error listening to pinned urgencies:', e);
      setLoading(false);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  return { urgencies, loading };
};
