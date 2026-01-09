
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { ChatMessage, ChatConversation as ChatConversationType } from '../hooks/useChatSystem';
import { ChevronLeftIcon, SendIcon, BoxIcon, LoadingIcon, PlusCircleIcon } from './Icons';
import ManualEntryModal from './ManualEntryModal';

interface ChatConversationProps {
    chat: ChatConversationType;
    currentUid: string;
    onBack: () => void;
    onSendMessage: (text: string, type?: 'text' | 'article_alert', metadata?: any) => Promise<void>;
}

const ChatConversation: React.FC<ChatConversationProps> = ({ chat, currentUid, onBack, onSendMessage }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [inputText, setInputText] = useState('');
    const [showArticleModal, setShowArticleModal] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Fetch messages
    useEffect(() => {
        setLoading(true);
        const unsubscribe = db.collection('chats').doc(chat.id)
            .collection('messages')
            .orderBy('createdAt', 'asc')
            .limit(100)
            .onSnapshot(snap => {
                const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
                setMessages(msgs);
                setLoading(false);
                setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            });

        return () => unsubscribe();
    }, [chat.id]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim()) return;
        await onSendMessage(inputText);
        setInputText('');
    };

    const handleSendArticle = async (barcode: string, orderId: string) => {
        await onSendMessage(`Alerta sobre ${barcode}`, 'article_alert', { articleCode: barcode, orderId });
        setShowArticleModal(false);
    };

    const formatTime = (iso: string) => {
        return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    };

    const otherRole = chat.participantRoles[Object.keys(chat.participantRoles).find(uid => uid !== currentUid) || ''] || 'Chat';

    return (
        <div className="flex flex-col h-full bg-slate-100 dark:bg-black/20">
            {/* Header */}
            <header className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 shrink-0 shadow-sm z-10">
                <button onClick={onBack} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <ChevronLeftIcon className="h-6 w-6" />
                </button>
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{otherRole}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">En línea</p>
                </div>
            </header>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto p-4 space-y-3">
                {loading && <div className="flex justify-center"><LoadingIcon className="h-8 w-8 animate-spin text-slate-400" /></div>}

                {messages.map((msg) => {
                    const isMe = msg.senderUid === currentUid;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm relative ${isMe
                                    ? 'bg-cyan-600 text-white rounded-br-none'
                                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none'
                                }`}>
                                {msg.type === 'article_alert' ? (
                                    <div className="mb-1">
                                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/20 dark:border-slate-600/50">
                                            <BoxIcon className="h-5 w-5 opacity-80" />
                                            <span className="font-bold text-xs uppercase tracking-wide">Alerta de Artículo</span>
                                        </div>
                                        <p className="font-black text-lg">{msg.articleCode}</p>
                                        <p className="font-mono text-xs opacity-80">OF: {msg.orderId}</p>
                                    </div>
                                ) : (
                                    <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                )}
                                <span className={`text-[10px] block text-right mt-1 ${isMe ? 'text-cyan-100' : 'text-slate-400'}`}>
                                    {formatTime(msg.createdAt)}
                                </span>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2 shrink-0 items-end safe-area-inset-bottom">
                <button
                    onClick={() => setShowArticleModal(true)}
                    className="p-3 text-slate-400 hover:text-purple-500 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors h-[50px]"
                    title="Adjuntar Artículo"
                >
                    <BoxIcon className="h-6 w-6" />
                </button>
                <form className="flex-grow flex gap-2 items-end" onSubmit={handleSend}>
                    <textarea
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        className="flex-grow bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white resize-none max-h-32 min-h-[50px]"
                        rows={1}
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim()}
                        className="bg-cyan-600 text-white p-3 rounded-xl hover:bg-cyan-500 disabled:opacity-50 transition-colors h-[50px] shadow-lg"
                    >
                        <SendIcon className="h-5 w-5" />
                    </button>
                </form>
            </div>

            {/* Article Modal */}
            {showArticleModal && (
                <ManualEntryModal
                    onSubmit={handleSendArticle}
                    onClose={() => setShowArticleModal(false)}
                />
            )}
        </div>
    );
};

export default ChatConversation;
