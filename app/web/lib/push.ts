
import firebase from 'firebase/compat/app';
import { messaging, db, auth } from '../legacy/firebaseCompat';

export interface PushStatus {
    isSupported: boolean;
    permission: NotificationPermission;
    token: string | null;
}

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export const initPush = async (): Promise<string | null> => {
    if (!messaging) {
        console.warn("Messaging not supported");
        return null;
    }

    try {
        if (!VAPID_KEY) {
            console.error("VITE_FIREBASE_VAPID_KEY falta en .env");
            // Don't crash, but warn
        }

        const currentToken = await messaging.getToken({
            vapidKey: VAPID_KEY
        });

        if (currentToken) {
            console.log("FCM Token:", currentToken);
            await saveTokenToUser(currentToken);
            return currentToken;
        } else {
            console.log("No registration token available. Request permission to generate one.");
            // Logic to ask for permission UI if needed, but getToken usually asks if Notification.requestPermission() was called
            // Actually getToken asks for permission if not granted.
            return null;
        }
    } catch (err) {
        console.log('Ocurrió un error al obtener el token.', err);
        return null;
    }
};

export const saveTokenToUser = async (token: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = db.collection('users').doc(user.uid);

    // Deduplication via arrayUnion
    try {
        await userRef.set({
            fcmTokens: firebase.firestore.FieldValue.arrayUnion(token)
        }, { merge: true });
        console.log("Token saved to user profile");
    } catch (error) {
        console.error("Error guardando token al usuario:", error);
    }
};

export const checkPushStatus = async (): Promise<PushStatus> => {
    if (!messaging) {
        return { isSupported: false, permission: 'denied', token: null };
    }

    return {
        isSupported: true,
        permission: Notification.permission,
        token: null // We don't fetch token just for check to avoid spamming
    };
};

export const listenForegroundMessages = (onMessage: (payload: any) => void) => {
    if (!messaging) return () => { };
    return messaging.onMessage((payload) => {
        console.log('Message received. ', payload);
        onMessage(payload);
    });
};
