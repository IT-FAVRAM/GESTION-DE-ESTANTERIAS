import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import type { ChatMessage } from '../../lib/firestoreSchema';
import type { UserRole } from '../../lib/firestoreSchema';
import { usePinnedUrgencies } from '../../hooks/usePinnedUrgencies';
import { PinnedUrgenciesBar } from './PinnedUrgenciesBar';
import { SetUrgencyModal } from './SetUrgencyModal';

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  loading: boolean;
  currentUid: string | null;
  currentRole: string | null;
  onSend: (text: string) => Promise<void>;
}

const ROLE_LABEL: Partial<Record<UserRole, string>> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  JEFE_SECCION: 'Jefe',
  CARRETILLERO: 'Carretillero',
};

const ROLE_BADGE: Partial<Record<UserRole, string>> = {
  SUPERADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  ADMIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  JEFE_SECCION: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  CARRETILLERO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const AVATAR_BG: Partial<Record<UserRole, string>> = {
  SUPERADMIN: 'bg-purple-500',
  ADMIN: 'bg-blue-500',
  JEFE_SECCION: 'bg-emerald-500',
  CARRETILLERO: 'bg-amber-500',
};

const formatTime = (msg: ChatMessage): string => {
  const ts: any = msg.timestamp;
  const date: Date | null = ts && typeof ts.toDate === 'function' ? ts.toDate() : null;
  if (!date) return '';
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

const initialOf = (name: string) => (name || '?').trim().charAt(0).toUpperCase();

const ChatPanel: React.FC<ChatPanelProps> = ({ open, onClose, messages, loading, currentUid, currentRole, onSend }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showUrgencyModal, setShowUrgencyModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const { urgencies } = usePinnedUrgencies();

  const isAuthorized = currentRole === 'ADMIN' || currentRole === 'SUPERADMIN';

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Auto-scroll al abrir y al recibir nuevos mensajes.
  useEffect(() => {
    if (open) {
      const t = setTimeout(scrollToBottom, 50);
      return () => clearTimeout(t);
    }
  }, [open, messages.length, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText('');
      inputRef.current?.focus();
    } catch (err) {
      console.warn('[ChatPanel] send error', err);
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full sm:max-w-md h-dvh bg-slate-50 dark:bg-slate-950 shadow-2xl flex flex-col animate-slide-in-right">
        {/* Pinned Urgencies Bar */}
        <PinnedUrgenciesBar urgencies={urgencies} currentUid={currentUid} />

        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-cyan-500 flex items-center justify-center text-white text-lg">
              💬
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">Chat interno</h2>
              <p className="text-xs text-slate-400">Equipo del almacén</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAuthorized && (
              <button
                onClick={() => setShowUrgencyModal(true)}
                aria-label="Establecer urgencia"
                className="h-9 px-3 rounded-full flex items-center justify-center gap-2 text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
                title="Establecer urgencia"
              >
                <AlertCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Urgencia</span>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar chat"
              className="h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
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
              <p className="text-sm">Sé el primero en escribir al equipo.</p>
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
        <div className="px-3 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
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

        {/* Set Urgency Modal */}
        <SetUrgencyModal
          isOpen={showUrgencyModal}
          onClose={() => setShowUrgencyModal(false)}
          onSuccess={() => {
            // El hook usePinnedUrgencies escuchará el cambio automáticamente
          }}
        />
      </div>
    </div>
  );
};

export default ChatPanel;
