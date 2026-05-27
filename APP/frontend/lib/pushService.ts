import { getToken, onMessage, type Messaging } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth, getMessagingInstance } from './firebase';
import { COLLECTIONS } from './firestoreSchema';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export const initPushNotifications = async (): Promise<string | null> => {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      return null;
    }

    if (!VAPID_KEY) {
      console.warn('[Push] VAPID key not configured');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push] Notification permission denied');
      return null;
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });

    if (token) {
      console.log('[Push] FCM Token obtained');
      await saveTokenToUser(token);
      return token;
    }

    return null;
  } catch (err) {
    console.error('[Push] Error inicializando:', err);
    return null;
  }
};

const saveTokenToUser = async (token: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  if (!token.trim() || token.length > 4096) return;

  const userRef = doc(db, COLLECTIONS.USERS, user.uid);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await updateDoc(userRef, {
        fcmTokens: arrayRemove(token),
      });
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token),
      });
      return;
    } catch (err) {
      const wait = Math.pow(2, attempt) * 1000;
      if (attempt < 2) {
        console.warn(`[Push] Retry ${attempt + 1}/3 guardando token en ${wait}ms...`, err);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        console.error('[Push] Error guardando token tras 3 intentos:', err);
      }
    }
  }
};

export const listenForegroundMessages = async (
  onMessageCallback: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void
): Promise<(() => void) | null> => {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[Push] Foreground message:', payload);

      onMessageCallback({
        title: payload.notification?.title || payload.data?.title,
        body: payload.notification?.body || payload.data?.body,
        data: payload.data as Record<string, string>,
      });
    });

    return unsubscribe;
  } catch (err) {
    console.error('[Push] Error configurando escucha:', err);
    return null;
  }
};

export interface PushStatus {
  isSupported: boolean;
  permission: NotificationPermission;
  hasToken: boolean;
}

export const getPushStatus = async (): Promise<PushStatus> => {
  const messaging = await getMessagingInstance();

  return {
    isSupported: messaging !== null,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'denied',
    hasToken: false,
  };
};
