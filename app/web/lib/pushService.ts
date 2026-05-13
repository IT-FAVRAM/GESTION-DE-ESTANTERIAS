/**
 * pushService — Servicio de notificaciones Push (FCM)
 * Gestor de Estanterías WMS v3.0
 * 
 * Envía notificaciones push via Firebase Cloud Messaging.
 * Las Cloud Functions se encargan de enviar las notificaciones reales;
 * este módulo frontend gestiona tokens y foreground messages.
 */

import { getToken, onMessage, type Messaging } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth, getMessagingInstance } from './firebase';
import { COLLECTIONS } from './firestoreSchema';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// ─── Token Management ───

/**
 * Solicita permiso de notificaciones y obtiene el token FCM.
 * Guarda el token en el documento del usuario en Firestore.
 */
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

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push] Notification permission denied');
      return null;
    }

    // Get token
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });

    if (token) {
      console.log('[Push] FCM Token obtained');
      await saveTokenToUser(token);
      return token;
    }

    return null;
  } catch (err) {
    console.error('[Push] Error initializing:', err);
    return null;
  }
};

/**
 * Guarda el token FCM en el documento del usuario.
 */
const saveTokenToUser = async (token: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  if (!token.trim() || token.length > 4096) return;

  try {
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    await updateDoc(userRef, {
      fcmTokens: arrayUnion(token),
    });
  } catch (err) {
    console.error('[Push] Error saving token:', err);
  }
};

// ─── Foreground Messages ───

/**
 * Escucha mensajes push en primer plano (app abierta).
 * Retorna una función de cleanup.
 */
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
    console.error('[Push] Error setting up listener:', err);
    return null;
  }
};

// ─── Push Status ───

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
    hasToken: false, // We don't check token just for status
  };
};
