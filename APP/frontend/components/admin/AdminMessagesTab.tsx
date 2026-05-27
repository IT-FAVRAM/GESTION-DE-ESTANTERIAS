import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { functions, db } from '../../lib/firebase';

type TargetRole = 'ALL' | 'JEFE_SECCION' | 'CALIDAD' | 'CARRETILLERO' | 'ADMIN';

interface SentMessage {
  id: string;
  title: string;
  body: string;
  targetRole: string;
  sentBy: string;
  sentAt: string;
  successCount: number;
  failureCount: number;
}

const TARGET_OPTIONS: Array<{ value: TargetRole; label: string; desc: string }> = [
  { value: 'ALL',          label: 'Todos',            desc: 'Todos los usuarios con sesión activa' },
  { value: 'JEFE_SECCION', label: 'Jefes de Sección', desc: 'Solo jefes de sección' },
  { value: 'CALIDAD',      label: 'Calidad',           desc: 'Solo usuarios de calidad' },
  { value: 'CARRETILLERO', label: 'Carretilleros',     desc: 'Solo carretilleros' },
  { value: 'ADMIN',        label: 'Admins',            desc: 'Solo administradores' },
];

const AdminMessagesTab: React.FC = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState<TargetRole>('ALL');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [history, setHistory] = useState<SentMessage[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'adminMessages'),
      orderBy('sentAt', 'desc'),
      limit(20),
    );
    return onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SentMessage, 'id'>) })));
    });
  }, []);

  const handleSend = async () => {
    const trimTitle = title.trim();
    const trimBody = body.trim();
    if (!trimTitle || !trimBody) return;

    setSending(true);
    setFeedback(null);
    try {
      const fn = httpsCallable(functions, 'sendAdminMessage');
      const result = await fn({ title: trimTitle, body: trimBody, targetRole });
      const d = result.data as { ok: boolean; successCount: number; failureCount: number };
      setFeedback({
        type: 'success',
        msg: `Enviado correctamente — ${d.successCount} dispositivo(s) alcanzado(s)${d.failureCount > 0 ? `, ${d.failureCount} fallaron` : ''}.`,
      });
      setTitle('');
      setBody('');
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Error al enviar el mensaje.' });
    } finally {
      setSending(false);
    }
  };

  const targetLabel = TARGET_OPTIONS.find((o) => o.value === targetRole)?.label ?? targetRole;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-white">Mensajes Urgentes</h2>
        <p className="mt-1 text-sm text-slate-400">
          Envía una notificación push inmediata a jefes de sección, calidad y otros roles con sesión activa.
        </p>
      </div>

      {/* Compose */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 space-y-5">

        {/* Target selector */}
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Destinatarios</p>
          <div className="flex flex-wrap gap-2">
            {TARGET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTargetRole(opt.value)}
                title={opt.desc}
                className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${
                  targetRole === opt.value
                    ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-600">
            {TARGET_OPTIONS.find((o) => o.value === targetRole)?.desc}
          </p>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-slate-500">Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Atención urgente en almacén"
            maxLength={80}
            className="mt-1.5 w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500 transition placeholder:text-slate-600"
          />
        </div>

        {/* Body */}
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-slate-500">Mensaje</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Escribe el mensaje que recibirán como notificación push..."
            maxLength={300}
            className="mt-1.5 w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500 transition resize-none placeholder:text-slate-600"
          />
          <p className="mt-1 text-right text-xs text-slate-600">{body.length}/300</p>
        </div>

        {feedback && (
          <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/15 border border-red-500/30 text-red-300'
          }`}>
            {feedback.msg}
          </div>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !title.trim() || !body.trim()}
          className="w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-black text-white transition hover:bg-cyan-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? 'Enviando...' : `📢 Enviar a: ${targetLabel}`}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Últimos mensajes enviados</h3>
          <div className="space-y-2">
            {history.map((msg) => (
              <div key={msg.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{msg.title}</p>
                    <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{msg.body}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase">
                    {msg.targetRole === 'ALL' ? 'Todos' : msg.targetRole.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                  <span>✓ {msg.successCount} dispositivos</span>
                  {msg.failureCount > 0 && <span className="text-red-500">✗ {msg.failureCount} fallaron</span>}
                  <span>·</span>
                  <span>{new Date(msg.sentAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span>·</span>
                  <span className="truncate max-w-[160px]">{msg.sentBy}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-600 text-sm">
          Aún no se han enviado mensajes urgentes.
        </div>
      )}
    </div>
  );
};

export default AdminMessagesTab;


