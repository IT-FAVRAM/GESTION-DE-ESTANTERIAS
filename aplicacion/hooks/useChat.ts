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
import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from '../lib/firebase';
import { COLLECTIONS, CHAT_ROOM_ID, type ChatMessage } from '../lib/firestoreSchema';

const MESSAGE_LIMIT = 60;

/**
 * useChat — estado del chat interno (sala única `general`).
 * Reactivo a cambios de auth: limpia mensajes y re-suscribe en login/logout.
 */
export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  // Seguir cambios de sesión
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
    return () => unsubAuth();
  }, []);

  // Re-suscribir cuando uid cambia (limpia mensajes al hacer logout)
  useEffect(() => {
    if (!uid) {
      setMessages([]);
      setLoading(false);
      return;
    }

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
  }, [uid]);

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
