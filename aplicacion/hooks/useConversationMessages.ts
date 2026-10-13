import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from '../lib/firebase';
import { COLLECTIONS, type ChatMessage } from '../lib/firestoreSchema';

const MESSAGE_LIMIT = 60;

/**
 * useConversationMessages — mensajes en tiempo real de una sala privada.
 * Mismo patrón que useChat pero parametrizado por conversationId.
 */
export const useConversationMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid ?? null;

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setMessages([]);
    setLoading(true);

    const messagesRef = collection(
      db,
      COLLECTIONS.CONVERSATIONS,
      conversationId,
      'messages',
    );
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(MESSAGE_LIMIT));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, 'id'>),
        }));
        docs.reverse();
        setMessages(docs);
        setLoading(false);
      },
      (err) => {
        console.warn('[useConversationMessages] snapshot error', err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !conversationId) return;
      const callable = httpsCallable(functions, 'chatSendConversationMessage');
      await callable({ conversationId, text: trimmed });
    },
    [conversationId],
  );

  const unreadCount = useMemo(() => {
    if (!uid) return 0;
    return messages.filter((m) => m.senderId !== uid && !(m.readBy || []).includes(uid)).length;
  }, [messages, uid]);

  const markAllRead = useCallback(async () => {
    if (!uid || !conversationId) return;
    const unread = messages.filter((m) => m.id && !(m.readBy || []).includes(uid));
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((m) => {
        const ref = doc(db, COLLECTIONS.CONVERSATIONS, conversationId, 'messages', m.id as string);
        batch.update(ref, { readBy: arrayUnion(uid) });
      });
      await batch.commit();
    } catch (err) {
      console.warn('[useConversationMessages] markAllRead error', err);
    }
  }, [messages, uid, conversationId]);

  return { messages, loading, sendMessage, unreadCount, markAllRead };
};
