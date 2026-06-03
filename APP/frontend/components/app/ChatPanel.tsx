import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlertCircle, ArrowLeft, Plus } from 'lucide-react';
import type { ChatMessage, Conversation } from '../../lib/firestoreSchema';
import type { UserRole } from '../../lib/firestoreSchema';
import { useConversationMessages } from '../../hooks/useConversationMessages';
import { SetUrgencyModal } from './SetUrgencyModal';
import { CreateConversationModal } from './CreateConversationModal';

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  // Canal general
  generalMessages: ChatMessage[];
  generalLoading: boolean;
  generalUnread: number;
  onSendGeneral: (text: string) => Promise<void>;
  onMarkGeneralRead: () => void;
  // Conversaciones privadas
  conversations: Conversation[];
  conversationsLoading: boolean;
  onCreateConversation: (name: string, memberUids: string[]) => Promise<unknown>;
  // Usuario actual
  currentUid: string | null;
  currentRole: string | null;
  // Vista activa
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
}

const ROLE_LABEL: Partial<Record<UserRole, string>> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  JEFE_SECCION: 'Jefe',
  CARRETILLERO: 'Carretillero',
  CALIDAD: 'Calidad',
};

const ROLE_BADGE: Partial<Record<UserRole, string>> = {
  SUPERADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  ADMIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  JEFE_SECCION: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  CARRETILLERO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  CALIDAD: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
};

const AVATAR_BG: Partial<Record<UserRole, string>> = {
  SUPERADMIN: 'bg-purple-500',
  ADMIN: 'bg-blue-500',
  JEFE_SECCION: 'bg-emerald-500',
  CARRETILLERO: 'bg-amber-500',
  CALIDAD: 'bg-violet-500',
};

const formatTime = (msg: ChatMessage): string => {
  try {
    const ts: any = msg.timestamp;
    if (!ts || typeof ts.toDate !== 'function') return '';
    const date: Date = ts.toDate();
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const initialOf = (name: string) => (name || '?').trim().charAt(0).toUpperCase();

// ── Subcomponente: hilo de mensajes ──────────────────────────────────────────

interface ThreadViewProps {
  title: string;
  messages: ChatMessage[];
  loading: boolean;
  currentUid: string | null;
  currentRole: string | null;
  onSend: (text: string) => Promise<void>;
  onBack: () => void;
  isAdminLike: boolean;
  onUrgencyClick: () => void;
}

const ThreadView: React.FC<ThreadViewProps> = ({
  title,
  messages,
  loading,
  currentUid,
  currentRole: _currentRole,
  onSend,
  onBack,
  isAdminLike,
  onUrgencyClick,
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const t = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(t);
  }, [messages.length, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText('');
      inputRef.current?.focus();
    } catch (err) {
      console.warn('[ThreadView] send error', err);
    } finally {
      setSending(false);
    }
  }, [text, sending, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Volver a la lista"
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isAdminLike && (
            <button
              onClick={onUrgencyClick}
              aria-label="Establecer urgencia"
              className="h-9 px-3 rounded-full flex items-center justify-center gap-2 text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
              title="Establecer urgencia"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Urgencia</span>
            </button>
          )}
        </div>
      </header>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
                <div className="h-12 w-48 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-2">
            <span className="text-4xl">📭</span>
            <p className="font-bold">Aún no hay mensajes</p>
            <p className="text-sm">Sé el primero en escribir.</p>
          </div>
        ) : (
          messages.map((m) => {
            const isOwn = !!currentUid && m.senderId === currentUid;
            return (
              <div key={m.id} className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                {!isOwn && (
                  <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold ${AVATAR_BG[m.senderRole] || 'bg-slate-400'}`}>
                    {initialOf(m.senderName)}
                  </div>
                )}
                <div className={`max-w-[75%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!isOwn && (
                    <div className="flex items-center gap-1.5 mb-0.5 px-1">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{m.senderName}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[m.senderRole] || 'bg-slate-100 text-slate-600'}`}>
                        {ROLE_LABEL[m.senderRole] || m.senderRole}
                      </span>
                    </div>
                  )}
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                      isOwn
                        ? 'bg-cyan-600 text-white rounded-br-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 px-1">{formatTime(m)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Escribe un mensaje…"
            className="flex-1 resize-none max-h-32 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            aria-label="Enviar mensaje"
            className="h-11 w-11 shrink-0 rounded-full bg-cyan-600 text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
          >
            {sending ? '…' : '➤'}
          </button>
        </div>
      </div>
    </>
  );
};

// ── Subcomponente: conversación privada (wraps useConversationMessages) ───────

interface ConvThreadProps {
  conversationId: string;
  conversation: Conversation | undefined;
  currentUid: string | null;
  currentRole: string | null;
  onBack: () => void;
  onMarkRead: () => void;
  isAdminLike: boolean;
  onUrgencyClick: () => void;
}

const ConvThread: React.FC<ConvThreadProps> = ({
  conversationId,
  conversation,
  currentUid,
  currentRole,
  onBack,
  onMarkRead,
  isAdminLike,
  onUrgencyClick,
}) => {
  const { messages, loading, sendMessage, unreadCount, markAllRead } = useConversationMessages(conversationId);

  // Marcar como leídos al montar y cuando llegan mensajes nuevos
  useEffect(() => {
    if (unreadCount > 0) {
      void markAllRead();
      onMarkRead();
    }
  }, [unreadCount, markAllRead, onMarkRead]);

  return (
    <ThreadView
      title={conversation?.name ?? 'Conversación'}
      messages={messages}
      loading={loading}
      currentUid={currentUid}
      currentRole={currentRole}
      onSend={sendMessage}
      onBack={onBack}
      isAdminLike={isAdminLike}
      onUrgencyClick={onUrgencyClick}
    />
  );
};

// ── Componente principal ─────────────────────────────────────────────────────

const ChatPanel: React.FC<ChatPanelProps> = ({
  open,
  onClose,
  generalMessages,
  generalLoading,
  generalUnread,
  onSendGeneral,
  onMarkGeneralRead,
  conversations,
  conversationsLoading: _conversationsLoading,
  onCreateConversation,
  currentUid,
  currentRole,
  activeConversationId,
  setActiveConversationId,
}) => {
  const [showUrgencyModal, setShowUrgencyModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isAdminLike = currentRole === 'ADMIN' || currentRole === 'SUPERADMIN';

  // Marcar general como leído al abrir el hilo general
  useEffect(() => {
    if (open && activeConversationId === 'general' && generalUnread > 0) {
      onMarkGeneralRead();
    }
  }, [open, activeConversationId, generalUnread, onMarkGeneralRead]);

  if (!open) return null;

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full sm:max-w-md h-dvh bg-slate-50 dark:bg-slate-950 shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">

        {/* ── Vista: lista de conversaciones ── */}
        {activeConversationId === null && (
          <>
            {/* Header lista */}
            <header className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-cyan-500 flex items-center justify-center text-white text-lg">
                  💬
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">Chat interno</h2>
                  <p className="text-xs text-slate-400">Equipo del almacén</p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar chat"
                className="h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </header>

            {/* Lista de salas */}
            <div className="flex-1 overflow-y-auto py-2">
              {/* Canal general */}
              <button
                onClick={() => setActiveConversationId('general')}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white dark:hover:bg-slate-900 transition-colors"
              >
                <div className="h-10 w-10 shrink-0 rounded-full bg-cyan-500 flex items-center justify-center text-white text-lg">
                  📢
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Chat General</p>
                  <p className="text-xs text-slate-500 truncate">
                    {generalMessages.length > 0
                      ? generalMessages[generalMessages.length - 1]?.text ?? 'Sin mensajes'
                      : 'Sin mensajes'}
                  </p>
                </div>
                {generalUnread > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-cyan-600 text-white text-[11px] font-black flex items-center justify-center">
                    {generalUnread > 99 ? '99+' : generalUnread}
                  </span>
                )}
              </button>

              {/* Separador */}
              {conversations.length > 0 && (
                <p className="px-4 pt-3 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Salas privadas
                </p>
              )}

              {/* Salas privadas */}
              {conversations.map((conv) => {
                const memberCount = conv.memberUids?.length ?? 0;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id!)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white dark:hover:bg-slate-900 transition-colors"
                  >
                    <div className="h-10 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-sm font-bold">
                      {(conv.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{conv.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {conv.lastMessage || `${memberCount} participante${memberCount !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* Botón crear sala */}
              {isAdminLike && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white dark:hover:bg-slate-900 transition-colors text-cyan-600 dark:text-cyan-400"
                >
                  <div className="h-10 w-10 shrink-0 rounded-full border-2 border-dashed border-cyan-400 flex items-center justify-center">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-bold">Nueva sala</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Vista: canal general ── */}
        {activeConversationId === 'general' && (
          <ThreadView
            title="Chat General"
            messages={generalMessages}
            loading={generalLoading}
            currentUid={currentUid}
            currentRole={currentRole}
            onSend={onSendGeneral}
            onBack={() => setActiveConversationId(null)}
            isAdminLike={isAdminLike}
            onUrgencyClick={() => setShowUrgencyModal(true)}
          />
        )}

        {/* ── Vista: sala privada ── */}
        {activeConversationId !== null && activeConversationId !== 'general' && (
          <ConvThread
            conversationId={activeConversationId}
            conversation={activeConversation}
            currentUid={currentUid}
            currentRole={currentRole}
            onBack={() => setActiveConversationId(null)}
            onMarkRead={() => {}}
            isAdminLike={isAdminLike}
            onUrgencyClick={() => setShowUrgencyModal(true)}
          />
        )}
      </div>

      {/* Modals */}
      <SetUrgencyModal
        isOpen={showUrgencyModal}
        onClose={() => setShowUrgencyModal(false)}
      />

      <CreateConversationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={onCreateConversation}
        currentUid={currentUid}
      />
    </div>
  );
};

export default ChatPanel;
