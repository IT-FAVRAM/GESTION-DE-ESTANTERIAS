

import React, { useState } from 'react';
import { UserRole } from '../hooks/useRoles';
import { useChatSystem } from '../hooks/useChatSystem';
import ChatList from './ChatList';
import ChatConversation from './ChatConversation';
import { LoadingIcon, CloseIcon, UserIcon, MessageSquareIcon } from './Icons';

interface MessagesViewProps {
    currentUserRole: UserRole;
    currentUserUid?: string;
}

export const MessagesView: React.FC<MessagesViewProps> = ({ currentUserRole, currentUserUid }) => {
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [showNewChatModal, setShowNewChatModal] = useState(false);

    const {
        chats,
        loadingChats,
        availableUsers,
        fetchAvailableUsers,
        createOrGetChat,
        sendMessage,
        markChatRead,
        archiveChat,
        deleteChatForMe,
        createBroadcastChat
    } = useChatSystem(currentUserUid, currentUserRole);

    const handleSelectChat = (chatId: string) => {
        setSelectedChatId(chatId);
        markChatRead(chatId);
    };

    const handleCreateChat = async (targetUid: string, role: string) => {
        try {
            const chatId = await createOrGetChat(targetUid, role);
            setShowNewChatModal(false);
            handleSelectChat(chatId);
        } catch (e) {
            console.error("Error creating chat", e);
        }
    };

    // --- RENDER MODOS ---

    // 1. Loading
    if (loadingChats) {
        return (
            <div className="flex h-full items-center justify-center bg-white dark:bg-slate-900 rounded-2xl">
                <LoadingIcon className="h-10 w-10 text-cyan-600 animate-spin" />
            </div>
        );
    }

    // 2. Vista Conversación
    if (selectedChatId) {
        const chat = chats.find(c => c.id === selectedChatId);
        if (!chat || !currentUserUid) return <div>Chat no encontrado</div>;

        return (
            <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-180px)] w-full max-w-5xl mx-auto bg-white dark:bg-slate-900 md:rounded-2xl md:shadow-xl md:border border-slate-200 dark:border-slate-800 overflow-hidden">
                <ChatConversation
                    chat={chat}
                    currentUid={currentUserUid}
                    onBack={() => setSelectedChatId(null)}
                    onSendMessage={async (text, type, meta) => await sendMessage(chat.id, text, type, meta)}
                />
            </div>
        );
    }

    // 3. Vista Lista (Default)
    return (
        <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-180px)] w-full max-w-5xl mx-auto bg-white dark:bg-slate-900 md:rounded-2xl md:shadow-xl md:border border-slate-200 dark:border-slate-800 overflow-hidden relative">

            <ChatList
                chats={chats}
                currentUid={currentUserUid || ''}
                userRole={currentUserRole}
                onSelectChat={handleSelectChat}
                onCreateChat={() => { fetchAvailableUsers(); setShowNewChatModal(true); }}
                onArchiveChat={archiveChat}
                onDeleteChat={deleteChatForMe}
            />

            {/* Modal Nuevo Chat */}
            {showNewChatModal && (
                <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80%]">
                        <header className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-lg dark:text-white">Nuevo Chat</h3>
                            <button onClick={() => setShowNewChatModal(false)}><CloseIcon className="h-6 w-6 text-slate-400" /></button>
                        </header>
                        <div className="overflow-y-auto p-2">
                            {currentUserRole === 'ADMIN' && (
                                <button
                                    onClick={async () => {
                                        const name = prompt("Nombre del anuncio (ej: Aviso General):", "Aviso General");
                                        if (name) {
                                            try {
                                                const id = await createBroadcastChat(name);
                                                setShowNewChatModal(false);
                                                handleSelectChat(id);
                                            } catch (e) {
                                                console.error(e);
                                            }
                                        }
                                    }}
                                    className="w-full p-3 mb-2 flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl transition-colors text-left border border-indigo-100 dark:border-indigo-800"
                                >
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300 rounded-full">
                                        <MessageSquareIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-indigo-900 dark:text-indigo-300">📢 Crear Canal d'Anuncios</p>
                                        <p className="text-xs text-indigo-500 dark:text-indigo-400">Mensaje visible para todos</p>
                                    </div>
                                </button>
                            )}
                            {availableUsers.length === 0 ? (
                                <p className="text-center p-4 text-slate-500">No hay usuarios disponibles.</p>
                            ) : (
                                availableUsers.map(u => (
                                    <button
                                        key={u.uid}
                                        onClick={() => handleCreateChat(u.uid, u.role)}
                                        className="w-full p-3 flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left border-b border-slate-100 dark:border-slate-800 last:border-0"
                                    >
                                        <div className="p-2 bg-purple-100 text-purple-600 rounded-full">
                                            <UserIcon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-sm text-slate-800 dark:text-white">{u.role}</p>
                                                {u.section && (
                                                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-bold uppercase">{u.section}</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500">{u.email}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
