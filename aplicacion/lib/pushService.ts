import { getToken, onMessage, type Messaging } from 'firebase/messaging';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { db, auth, getMessagingInstance } from './firebase';
import { COLLECTIONS } from './firestoreSchema';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Espera a que el service worker esté activo antes de pedir el token FCM.
// Evita race conditions en navegadores que tardan en registrar el SW.
async function waitForServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return undefined;
  }
}

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

    const swReg = await waitForServiceWorker();
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
    });

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
      // setDoc con merge crea el doc si no existe y añade el token sin duplicados
      await setDoc(userRef, { fcmTokens: arrayUnion(token) }, { merge: true });
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

// Refresca el token FCM cuando el usuario vuelve a la app (visibilitychange).
// Retorna una función de cleanup para cancelar el listener.
export const refreshTokenOnFocus = (): (() => void) => {
  const handler = async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const messaging = await getMessagingInstance();
      if (!messaging || !VAPID_KEY) return;
      if (Notification.permission !== 'granted') return;
      const swReg = await waitForServiceWorker();
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
      });
      if (token) await saveTokenToUser(token);
    } catch {
      // refresco silencioso — no crítico
    }
  };

  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
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
