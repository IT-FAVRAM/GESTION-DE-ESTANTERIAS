import React, { useState, useEffect, useCallback } from 'react';
import { useChat } from '../../hooks/useChat';
import ChatPanel from './ChatPanel';

interface ChatButtonProps {
  currentUid: string | null;
  currentRole?: string | null;
}

/**
 * Botón flotante de chat con badge de no leídos. Visible solo para los roles
 * autorizados (el gating lo decide AppV3). Abre el ChatPanel estilo Telegram.
 */
const ChatButton: React.FC<ChatButtonProps> = ({ currentUid, currentRole }) => {
  const { messages, loading, sendMessage, unreadCount, markAllRead } = useChat();
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setOpen(true);
    void markAllRead();
  }, [markAllRead]);

  // Mientras el panel está abierto, marcar como leídos los mensajes entrantes.
  useEffect(() => {
    if (open && unreadCount > 0) {
      void markAllRead();
    }
  }, [open, unreadCount, markAllRead]);

  return (
    <>
      {!open && (
        <button
          onClick={handleOpen}
          aria-label="Abrir chat interno"
          className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-cyan-600 text-white shadow-2xl flex items-center justify-center active:scale-95 transition-all hover:bg-cyan-500"
        >
          <span className="text-2xl">💬</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-950">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      <ChatPanel
        open={open}
        onClose={() => setOpen(false)}
        messages={messages}
        loading={loading}
        currentUid={currentUid}
        currentRole={currentRole ?? null}
        onSend={sendMessage}
      />
    </>
  );
};

export default ChatButton;
