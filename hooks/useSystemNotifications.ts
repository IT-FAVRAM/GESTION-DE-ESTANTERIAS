
import { useEffect, useCallback, useState } from 'react';
import { db, auth } from '../lib/firebase';
import firebase from 'firebase/compat/app';
import { UserRole } from './useRoles';
import { NotificationType } from '../components/NotificationToast';

export interface SystemAlert {
    id: string;
    senderRole?: string;
    targetRole: UserRole | 'ALL';
    type: 'urgent_placement' | 'request_material' | 'admin_message' | 'team_chat';
    title: string;
    message: string;
    timestamp: string;
    readBy: string[]; // Array of UIDs
    status?: 'PENDING' | 'COMPLETED';
    completedBy?: string;
    completedAt?: string;
    metadata?: {
        barcode?: string;
        location?: string;
        priority?: 'high' | 'normal';
        orderId?: string;
        type?: string;
    };
}

export const useSystemNotifications = (
    currentUserRole: UserRole | null,
    notifyLocal: (type: NotificationType, title: string, message: string) => void
) => {
    const [unreadRequestsCount, setUnreadRequestsCount] = useState(0);

    // Solicitar permiso para notificaciones nativas al montar
    useEffect(() => {
        if (auth.currentUser && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // Función para emitir notificación nativa
    const triggerNativeNotification = (title: string, body: string, isUrgent: boolean = false) => {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            // Vibración
            if (navigator.vibrate) {
                if (isUrgent) navigator.vibrate([200, 100, 200, 100, 500]);
                else navigator.vibrate(200);
            }

            // Notificación visual del sistema
            try {
                // Solo si la app está oculta o minimizada (opcional, aquí lo lanzamos siempre para asegurar visibilidad)
                if (document.visibilityState === 'hidden' || isUrgent) {
                    new Notification(title, {
                        body: body,
                        icon: '/vite.svg',
                        tag: 'warehouse-alert',
                        requireInteraction: isUrgent
                    });
                }
            } catch (e) {
                console.error("Error lanzando notificación nativa", e);
            }
        }
    };

    // Listener de Notificaciones Generales
    useEffect(() => {
        if (!currentUserRole || !auth.currentUser) return;

        // Solo escuchar notificaciones recientes (últimos 5 min) para evitar spam al cargar
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const handleNewSnapshot = (snapshot: any) => {
            snapshot.docChanges().forEach((change: any) => {
                if (change.type === 'added') {
                    const data = change.doc.data() as SystemAlert;

                    // Client-side filtering for Role to avoid composite index requirement
                    const isForMe = data.targetRole === 'ALL' || data.targetRole === currentUserRole;
                    if (!isForMe) return;

                    // Ignorar si ya lo leí (aunque sea 'added' en snapshot inicial)
                    if (data.readBy && data.readBy.includes(auth.currentUser!.uid)) return;
                    if (data.type === 'request_material' && data.status === 'COMPLETED') return;

                    let notifType: NotificationType = 'info';
                    let isUrgent = false;

                    if (data.type === 'urgent_placement') {
                        notifType = 'warning';
                        isUrgent = true;
                    }
                    if (data.type === 'request_material') {
                        notifType = 'info';
                        isUrgent = true;
                    }
                    if (data.metadata?.priority === 'high') {
                        notifType = 'warning';
                        isUrgent = true;
                    }

                    // No notificar mensajes de chat aquí, eso va por useChatSystem
                    if (data.type === 'team_chat') return;

                    // 1. Toast in-app
                    notifyLocal(notifType, data.title, data.message);

                    // 2. Notificación Nativa (Segundo plano)
                    triggerNativeNotification(data.title, data.message, isUrgent);
                }
            });
        };

        // Modificado para evitar errores de índice compuesto:
        // En lugar de .where('targetRole', ...).where('timestamp', ...),
        // Consultamos solo por timestamp (índice simple automático) y filtramos el rol en el cliente.
        const qRecentRole = db.collection('notifications')
            .where('targetRole', '==', currentUserRole)
            .where('timestamp', '>', fiveMinutesAgo)
            .orderBy('timestamp', 'desc')
            .limit(50);

        const qRecentAll = db.collection('notifications')
            .where('targetRole', '==', 'ALL')
            .where('timestamp', '>', fiveMinutesAgo)
            .orderBy('timestamp', 'desc')
            .limit(50);

        const unsubRole = qRecentRole.onSnapshot(handleNewSnapshot);
        const unsubAll = qRecentAll.onSnapshot(handleNewSnapshot);

        return () => {
            unsubRole();
            unsubAll();
        };
    }, [currentUserRole, notifyLocal]);

    // Listener ESPECÍFICO para conteo de solicitudes pendientes (CARRETILLERO)
    useEffect(() => {
        if (currentUserRole !== 'CARRETILLERO' || !auth.currentUser) return;

        const qRequests = db.collection('notifications')
            .where('targetRole', '==', 'CARRETILLERO')
            .where('type', '==', 'request_material')
            .where('status', '==', 'PENDING')
            .orderBy('timestamp', 'desc')
            .limit(500);

        const unsub = qRequests.onSnapshot(snap => {
            if (!auth.currentUser?.uid) return;
            setUnreadRequestsCount(snap.size);
        });

        return () => unsub();
    }, [currentUserRole]);

    const sendSystemAlert = useCallback(async (alert: Omit<SystemAlert, 'id' | 'readBy' | 'timestamp' | 'senderRole'>) => {
        try {
            if (!currentUserRole) {
                console.warn('sendSystemAlert blocked: missing current user role');
                return;
            }

            const sender = currentUserRole;
            await db.collection('notifications').add({
                ...alert,
                senderRole: sender,
                timestamp: new Date().toISOString(),
                readBy: [],
                status: 'PENDING'
            });
        } catch (error) {
            console.error("Error enviando alerta:", error);
        }
    }, [currentUserRole]);

    const markAlertAsRead = async (alertId: string) => {
        if (!auth.currentUser) return;
        try {
            const alertRef = db.collection('notifications').doc(alertId);
            await alertRef.update({
                readBy: firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
            });
        } catch (e) {
            console.error("Error marking alert as read", e);
        }
    };

    return {
        sendSystemAlert,
        unreadRequestsCount,
        markAlertAsRead
    };
};
