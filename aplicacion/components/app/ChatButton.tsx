import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useConversations } from '../../hooks/useConversations';
import ChatPanel from './ChatPanel';

interface ChatButtonProps {
  currentUid: string | null;
  currentRole?: string | null;
}

/**
 * Botón flotante de chat con badge de no leídos.
 * Gestiona el estado de vista activa (lista / canal general / sala privada).
 */
const ChatButton: React.FC<ChatButtonProps> = ({ currentUid, currentRole }) => {
  const { messages, loading, sendMessage, unreadCount, markAllRead } = useChat();
  const { conversations, createConversation } = useConversations();

  const [open, setOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Contar no leídos en conversaciones privadas
  const privateUnread = useMemo(() => {
    if (!currentUid) return 0;
    // Solo podemos contar con los mensajes que ya están en memoria.
    // El badge definitivo viene del snapshot en tiempo real de cada sala,
    // pero aquí aportamos un indicador básico via lastMessage.
    return 0;
  }, [currentUid]);

  const totalUnread = unreadCount + privateUnread;

  const handleOpen = useCallback(() => {
    setOpen(true);
    setActiveConversationId(null); // siempre abre en la lista
  }, []);

  const handleSetActiveConversationId = useCallback(
    (id: string | null) => {
      setActiveConversationId(id);
      if (id === 'general') {
        void markAllRead();
      }
    },
    [markAllRead],
  );

  // Marcar como leídos al abrir el canal general
  useEffect(() => {
    if (open && activeConversationId === 'general' && unreadCount > 0) {
      void markAllRead();
    }
  }, [open, activeConversationId, unreadCount, markAllRead]);

  return (
    <>
      {!open && (
        <button
          onClick={handleOpen}
          aria-label="Abrir chat interno"
          className="relative h-9 w-9 rounded-full bg-cyan-600 text-white shadow-md flex items-center justify-center active:scale-95 transition-all hover:bg-cyan-500 flex-shrink-0"
        >
          <MessageCircle className="w-5 h-5" aria-hidden />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-950">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      )}

      <ChatPanel
        open={open}
        onClose={() => { setOpen(false); setActiveConversationId(null); }}
        generalMessages={messages}
        generalLoading={loading}
        generalUnread={unreadCount}
        onSendGeneral={sendMessage}
        onMarkGeneralRead={() => { void markAllRead(); }}
        conversations={conversations}
        conversationsLoading={false}
        onCreateConversation={createConversation}
        currentUid={currentUid}
        currentRole={currentRole ?? null}
        activeConversationId={activeConversationId}
        setActiveConversationId={handleSetActiveConversationId}
      />
    </>
  );
};

export default ChatButton;
