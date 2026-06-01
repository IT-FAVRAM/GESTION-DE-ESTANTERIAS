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
import { COLLECTIONS, CHAT_ROOM_ID, type ChatMessage } from '../lib/firestoreSchema';

const MESSAGE_LIMIT = 60;

/**
 * useChat — estado del chat interno (sala única `general`).
 * - `messages`: últimos 60 mensajes en orden cronológico.
 * - `sendMessage`: envía vía Cloud Function `chatSendMessage` (sin escritura directa).
 * - `unreadCount`: mensajes ajenos sin el uid propio en `readBy`.
 * - `markAllRead`: añade el uid propio a `readBy` de los mensajes no leídos.
 */
export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid ?? null;

  useEffect(() => {
    const messagesRef = collection(db, COLLECTIONS.CHAT, CHAT_ROOM_ID, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(MESSAGE_LIMIT));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, 'id'>),
        }));
        docs.reverse(); // de desc → orden cronológico ascendente
        setMessages(docs);
        setLoading(false);
      },
      (err) => {
        console.warn('[useChat] snapshot error', err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const callable = httpsCallable(functions, 'chatSendMessage');
    await callable({ text: trimmed });
  }, []);

  const unreadCount = useMemo(() => {
    if (!uid) return 0;
    return messages.filter((m) => m.senderId !== uid && !(m.readBy || []).includes(uid)).length;
  }, [messages, uid]);

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    const unread = messages.filter((m) => m.id && !(m.readBy || []).includes(uid));
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((m) => {
        const ref = doc(db, COLLECTIONS.CHAT, CHAT_ROOM_ID, 'messages', m.id as string);
        batch.update(ref, { readBy: arrayUnion(uid) });
      });
      await batch.commit();
    } catch (err) {
      console.warn('[useChat] markAllRead error', err);
    }
  }, [messages, uid]);

  return { messages, loading, sendMessage, unreadCount, markAllRead };
};
