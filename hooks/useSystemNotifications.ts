
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
    metadata?: {
        barcode?: string;
        location?: string;
        priority?: 'high' | 'normal';
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
        const qRecent = db.collection('notifications')
            .where('timestamp', '>', fiveMinutesAgo)
            .limit(50); // Límite razonable para "recientes"

        const unsub = qRecent.onSnapshot(handleNewSnapshot);

        return () => {
            unsub();
        };
    }, [currentUserRole, notifyLocal]);

    // Listener ESPECÍFICO para conteo de solicitudes pendientes (CARRETILLERO)
    useEffect(() => {
        if (currentUserRole !== 'CARRETILLERO' || !auth.currentUser) return;

        // Escuchar todas las 'request_material' que NO estén leídas por mi usuario
        // Firestore no permite filtrar arrays por "no contiene", así que traemos las activas y filtramos en cliente
        // Optimizamos trayendo solo las de las últimas 24h
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Para esta query específica, intentamos simplificarla también si falla, 
        // pero `where(a).where(b)` requiere índice compuesto.
        // `targetRole` + `type` + `timestamp`. 
        // Si falla, simplificamos a `timestamp` + client filter.
        
        // Vamos a usar una query segura sin índices compuestos complejos si es posible.
        // Query principal: timestamp > yesterday.
        const qRequests = db.collection('notifications')
            .where('timestamp', '>', yesterday);

        const unsub = qRequests.onSnapshot(snap => {
                let count = 0;
                const uid = auth.currentUser?.uid;
                if (!uid) return;

                snap.forEach(doc => {
                    const data = doc.data() as SystemAlert;
                    // Filtros Cliente
                    if (data.targetRole === 'CARRETILLERO' && 
                        data.type === 'request_material' &&
                        (!data.readBy || !data.readBy.includes(uid))) {
                        count++;
                    }
                });
                setUnreadRequestsCount(count);
            });

        return () => unsub();
    }, [currentUserRole]);

    const sendSystemAlert = useCallback(async (alert: Omit<SystemAlert, 'id' | 'readBy' | 'timestamp' | 'senderRole'>) => {
        try {
            const sender = currentUserRole || 'SISTEMA';
            await db.collection('notifications').add({
                ...alert,
                senderRole: sender,
                timestamp: new Date().toISOString(),
                readBy: []
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
