import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from '../lib/firebase';
import { COLLECTIONS, type Conversation } from '../lib/firestoreSchema';

/**
 * useConversations — lista las salas privadas donde el usuario es miembro.
 * Ordenadas por `lastMessageAt` descendente.
 * Solo activo si el usuario está autenticado.
 */
export const useConversations = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.CONVERSATIONS),
      where('memberUids', 'array-contains', uid),
      orderBy('lastMessageAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: Conversation[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Conversation, 'id'>),
        }));
        setConversations(docs);
        setLoading(false);
      },
      (err) => {
        console.warn('[useConversations] snapshot error', err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const createConversation = useCallback(async (name: string, memberUids: string[]) => {
    const callable = httpsCallable<{ name: string; memberUids: string[] }, { ok: boolean; conversationId: string }>(
      functions,
      'chatCreateConversation',
    );
    const result = await callable({ name, memberUids });
    return result.data;
  }, []);

  return { conversations, loading, createConversation };
};
