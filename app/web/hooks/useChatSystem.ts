
import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../legacy/firebaseCompat';
import firebase from "firebase/compat/app";
import { UserRole } from './useRoles';

export interface ChatMessage {
    id: string;
    senderUid: string;
    senderRole: string;
    text: string;
    type: 'text' | 'article_alert';
    articleCode?: string;
    orderId?: string;
    createdAt: string;
    readBy: string[];
}

export interface ChatConversation {
    id: string;
    participants: string[]; // UIDs
    participantRoles: Record<string, string>; // { uid: role }
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: Record<string, number>;
    archivedBy: string[];
    deletedFor: string[];
    isBroadcast?: boolean; // NEW
    groupName?: string;    // NEW
}

export const useChatSystem = (currentUserUid: string | undefined, currentUserRole: UserRole | null) => {
    const [chats, setChats] = useState<ChatConversation[]>([]);
    const [loadingChats, setLoadingChats] = useState(true);

    // Lista de usuarios disponibles para iniciar chat (solo para ADMIN)
    const [availableUsers, setAvailableUsers] = useState<{ uid: string, role: string, email: string, section?: string }[]>([]);

    // --- CARGAR CHATS ---
    useEffect(() => {
        if (!currentUserUid) {
            setLoadingChats(false);
            return;
        }

        setLoadingChats(true);

        // Define listeners (Using separate listeners to mimic OR query)
        let privateChats: ChatConversation[] = [];
        let broadcastChats: ChatConversation[] = [];

        // Update function to merge and set state
        const updateState = () => {
            const all = [...privateChats, ...broadcastChats];
            // Dedup by ID
            const unique = Array.from(new Map(all.map(item => [item.id, item])).values());

            // Filter deleted
            const activeChats = unique.filter(c => !c.deletedFor?.includes(currentUserUid));

            // Sort
            activeChats.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

            setChats(activeChats);
            setLoadingChats(false);
        };

        const unsub1 = db.collection('chats')
            .where('participants', 'array-contains', currentUserUid)
            .onSnapshot(snapshot => {
                privateChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatConversation));
                updateState();
            }, err => console.error("Error cargando chats privados:", err));

        const unsub2 = db.collection('chats')
            .where('isBroadcast', '==', true)
            .onSnapshot(snapshot => {
                broadcastChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatConversation));
                updateState();
            }, err => console.error("Error cargando chats de transmisión:", err));

        return () => {
            unsub1();
            unsub2();
        };
    }, [currentUserUid]);

    // --- CARGAR USUARIOS DISPONIBLES (Para 'Nuevo Chat') ---
    const fetchAvailableUsers = useCallback(async () => {
        // En teoría solo ADMIN, pero flexibilizamos si se requiere
        if (currentUserRole !== 'ADMIN') return;

        try {
            const snap = await db.collection('users').get();
            const users = snap.docs.map(doc => {
                const d = doc.data();
                return {
                    uid: doc.id,
                    role: d.role || 'SIN ROL',
                    email: d.email || 'Usuario',
                    section: d.section // New field
                };
            }).filter(u => u.uid !== currentUserUid);

            setAvailableUsers(users);
        } catch (e) {
            console.error("Error obteniendo usuarios:", e);
        }
    }, [currentUserRole, currentUserUid]);

    // --- ACCIONES ---

    const createOrGetChat = async (targetUid: string, targetRole: string): Promise<string> => {
        if (!currentUserUid || !currentUserRole) throw new Error("Sin usuario");

        // 1. Verificar si ya existe chat (cliente side filter o query compleja)
        // Como 'participants' array-contains solo permite 1 valor, lo buscamos en los chats ya cargados en memoria
        // NOTA: Para chats privados, participants length == 2
        const existingChat = chats.find(c => !c.isBroadcast && c.participants.includes(targetUid) && c.participants.length === 2);

        if (existingChat) {
            // Si estaba "borrado", lo restauramos
            if (existingChat.deletedFor?.includes(currentUserUid)) {
                await db.collection('chats').doc(existingChat.id).update({
                    deletedFor: firebase.firestore.FieldValue.arrayRemove(currentUserUid)
                });
            }
            return existingChat.id;
        }

        // 2. Crear nuevo
        const newChatData = {
            participants: [currentUserUid, targetUid],
            participantRoles: {
                [currentUserUid]: currentUserRole,
                [targetUid]: targetRole
            },
            lastMessage: '',
            lastMessageAt: new Date().toISOString(),
            unreadCount: {
                [currentUserUid]: 0,
                [targetUid]: 0
            },
            archivedBy: [],
            deletedFor: []
        };

        const ref = await db.collection('chats').add(newChatData);
        return ref.id;
    };

    const createBroadcastChat = async (name: string): Promise<string> => {
        if (!currentUserUid || currentUserRole !== 'ADMIN') throw new Error("Unauthorized");

        // Check if exists
        const existing = chats.find(c => c.isBroadcast && c.groupName === name);
        if (existing) return existing.id;

        const newChatData = {
            participants: [currentUserUid], // Inicialmente solo el creador, pero todos lo ven por query
            participantRoles: {
                [currentUserUid]: currentUserRole
            },
            lastMessage: '📢 Canal de Anuncios creado',
            lastMessageAt: new Date().toISOString(),
            unreadCount: {}, // Unread count logic is harder for broadcast unless we list everyone
            archivedBy: [],
            deletedFor: [],
            isBroadcast: true,
            groupName: name
        };

        const ref = await db.collection('chats').add(newChatData);
        return ref.id;
    };

    const sendMessage = async (chatId: string, text: string, type: 'text' | 'article_alert' = 'text', metadata?: { articleCode?: string, orderId?: string }) => {
        if (!currentUserUid) return;

        const now = new Date().toISOString();
        const msgData = {
            senderUid: currentUserUid,
            senderRole: currentUserRole || 'UNKNOWN',
            text,
            type,
            articleCode: metadata?.articleCode || null,
            orderId: metadata?.orderId || null,
            createdAt: now,
            readBy: [currentUserUid]
        };

        const batch = db.batch();
        const chatRef = db.collection('chats').doc(chatId);
        const msgRef = chatRef.collection('messages').doc();

        batch.set(msgRef, msgData);

        // Actualizar chat metadata
        const chatDoc = await chatRef.get();
        if (!chatDoc.exists) return;

        const chatData = chatDoc.data() as ChatConversation;
        const newUnreadCounts = { ...chatData.unreadCount };

        // Only update unread counts if we have the keys (participants list)
        chatData.participants.forEach(uid => {
            if (uid !== currentUserUid) {
                newUnreadCounts[uid] = (newUnreadCounts[uid] || 0) + 1;
            }
        });

        // For broadcast, we rely on user seeing "new message" visually or checking timestamps if unreadCount is empty.
        // Or we could dynamically add unread count for known users, but that's expensive.

        batch.update(chatRef, {
            lastMessage: type === 'article_alert' ? '📦 Alerta de Artículo' : text,
            lastMessageAt: now,
            unreadCount: newUnreadCounts,
            deletedFor: [] // Revivir chat si estaba borrado
        });

        await batch.commit();
    };

    const markChatRead = async (chatId: string) => {
        if (!currentUserUid) return;
        const chat = chats.find(c => c.id === chatId);
        if (chat && chat.unreadCount && chat.unreadCount[currentUserUid] > 0) {
            await db.collection('chats').doc(chatId).update({
                [`unreadCount.${currentUserUid}`]: 0
            });
        }
    };

    const archiveChat = async (chatId: string, archive: boolean) => {
        if (!currentUserUid) return;
        await db.collection('chats').doc(chatId).update({
            archivedBy: archive
                ? firebase.firestore.FieldValue.arrayUnion(currentUserUid)
                : firebase.firestore.FieldValue.arrayRemove(currentUserUid)
        });
    };

    const deleteChatForMe = async (chatId: string) => {
        if (!currentUserUid) return;
        // Broadcasts shouldn't be deleted, just archived maybe? 
        // But logic allows deleting from view.
        await db.collection('chats').doc(chatId).update({
            deletedFor: firebase.firestore.FieldValue.arrayUnion(currentUserUid)
        });
    };

    return {
        chats,
        loadingChats,
        availableUsers,
        fetchAvailableUsers,
        createOrGetChat,
        createBroadcastChat,
        sendMessage,
        markChatRead,
        archiveChat,
        deleteChatForMe
    };
};
