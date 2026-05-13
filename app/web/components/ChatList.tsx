

import React, { useState } from 'react';
import { ChatConversation } from '../hooks/useChatSystem';
import { UserIcon, PlusCircleIcon, SearchIcon, TrashIcon, BoxIcon, MessageSquareIcon } from './Icons';

interface ChatListProps {
    chats: ChatConversation[];
    currentUid: string;
    onSelectChat: (chatId: string) => void;
    onCreateChat: () => void;
    onArchiveChat: (chatId: string, archive: boolean) => void;
    onDeleteChat: (chatId: string) => void;
    userRole: string;
}

const ChatList: React.FC<ChatListProps> = ({
    chats, currentUid, onSelectChat, onCreateChat, onArchiveChat, onDeleteChat, userRole
}) => {
    const [filter, setFilter] = useState<'all' | 'archived'>('all');
    const [search, setSearch] = useState('');

    const filteredChats = chats.filter(chat => {
        const isArchived = chat.archivedBy?.includes(currentUid);
        if (filter === 'all' && isArchived) return false;
        if (filter === 'archived' && !isArchived) return false;

        // Basic search (could be improved by fetching user names properly)
        return true;
    });

    const formatTime = (iso: string) => {
        if (!iso) return '';
        const date = new Date(iso);
        const now = new Date();
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    };

    const getChatName = (chat: ChatConversation) => {
        if (chat.isBroadcast) return chat.groupName || 'Anuncio Global';

        // Simple logic: find role of the *other* participant
        const otherUid = chat.participants.find(p => p !== currentUid);
        if (!otherUid) return 'Chat Desconocido';
        const role = chat.participantRoles[otherUid] || 'Usuario';
        return role; // In a real app, map UID to Name via a context or lookup
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="p-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Mensajes</h2>
                {userRole === 'ADMIN' && (
                    <button onClick={onCreateChat} className="text-cyan-600 hover:text-cyan-500 transition-colors">
                        <PlusCircleIcon className="h-8 w-8" />
                    </button>
                )}
            </div>

            {/* Search & Tabs */}
            <div className="px-4 pt-4 pb-2 bg-white dark:bg-slate-950 shrink-0">
                <div className="relative mb-3">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white"
                    />
                </div>
                <div className="flex gap-4 text-sm font-bold text-slate-500">
                    <button
                        onClick={() => setFilter('all')}
                        className={`pb-2 border-b-2 transition-colors ${filter === 'all' ? 'text-cyan-600 border-cyan-600' : 'border-transparent hover:text-slate-700'}`}
                    >
                        Chats
                    </button>
                    <button
                        onClick={() => setFilter('archived')}
                        className={`pb-2 border-b-2 transition-colors ${filter === 'archived' ? 'text-cyan-600 border-cyan-600' : 'border-transparent hover:text-slate-700'}`}
                    >
                        Archivados
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-grow overflow-y-auto p-2 space-y-1">
                {filteredChats.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 flex flex-col items-center">
                        <MessageSquareIcon className="h-12 w-12 opacity-20 mb-2" />
                        <p>No hay conversaciones.</p>
                    </div>
                ) : (
                    filteredChats.map(chat => {
                        const unread = chat.unreadCount[currentUid] || 0;
                        return (
                            <div
                                key={chat.id}
                                onClick={() => onSelectChat(chat.id)}
                                className="group p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors relative"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-full text-slate-500">
                                            <UserIcon className="h-5 w-5" />
                                        </div>
                                        <span className="font-bold text-slate-800 dark:text-white text-sm">
                                            {getChatName(chat)}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        {formatTime(chat.lastMessageAt)}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center pl-11">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                        {chat.lastMessage || 'Nuevo chat'}
                                    </p>
                                    {unread > 0 && (
                                        <span className="bg-cyan-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                            {unread}
                                        </span>
                                    )}
                                </div>

                                {/* Quick Actions (Hover/Swipe logic simulated) */}
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 shadow-lg p-1 rounded-lg">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onArchiveChat(chat.id, filter === 'all'); }}
                                        className="p-2 text-slate-400 hover:text-cyan-600 bg-slate-50 dark:bg-slate-900 rounded"
                                        title={filter === 'all' ? "Archivar" : "Desarchivar"}
                                    >
                                        <BoxIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                                        className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 dark:bg-slate-900 rounded"
                                        title="Eliminar"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ChatList;