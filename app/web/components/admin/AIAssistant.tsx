import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { askInventoryAssistant } from '../../lib/aiService';
import type { AnalyticsSnapshot } from '../../hooks/useAnalytics';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIAssistantProps {
  analytics: AnalyticsSnapshot;
}

const SUGGESTIONS = [
  'Cuantos articulos hay en Mecanizado?',
  'Que articulo lleva mas dias parado?',
  'Tiene esta OF mas de una ubicacion activa?',
  'Que seccion esta mas saturada ahora mismo?',
];

const AIAssistant: React.FC<AIAssistantProps> = ({ analytics }) => {
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Estoy listo para responder sobre inventario actual, permanencia por articulo, saturacion por seccion y parejas articulo + OF repetidas.',
    },
  ]);

  const disabled = sending || analytics.loading || !analytics.assistantContext;
  const helperText = useMemo(() => {
    if (analytics.loading) return 'Cargando contexto actual del almacen...';
    if (analytics.error) return analytics.error;
    return 'Responde sobre los datos actuales del WMS y avisa si una pareja articulo + OF aparece en varias ubicaciones.';
  }, [analytics.error, analytics.loading]);

  const submitQuestion = async (rawQuestion: string) => {
    const trimmedQuestion = rawQuestion.trim();
    if (!trimmedQuestion || !analytics.assistantContext) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedQuestion,
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion('');
    setSending(true);

    try {
      const response = await askInventoryAssistant(trimmedQuestion, analytics.assistantContext);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.answer,
        },
      ]);
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 'No se pudo consultar el asistente.';
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: `No he podido responder ahora mismo. ${fallback}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Asistente Logistico IA</h2>
            <p className="mt-1 text-sm text-slate-400">{helperText}</p>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs font-bold text-cyan-300">
            {analytics.generatedAt ? `Metricas actualizadas ${new Date(analytics.generatedAt).toLocaleString('es-ES')}` : 'Sin corte de metricas aun'}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setQuestion(suggestion);
                void submitQuestion(suggestion);
              }}
              disabled={disabled}
              className="rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-4 sm:p-6">
        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-3xl border px-4 py-3 ${message.role === 'user'
                ? 'ml-auto max-w-[85%] border-cyan-400/30 bg-cyan-500/10 text-cyan-50'
                : 'mr-auto max-w-[90%] border-slate-800 bg-slate-900 text-slate-100'
                }`}
            >
              {message.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm font-medium">{message.content}</p>
              )}
            </div>
          ))}

          {sending && (
            <div className="mr-auto max-w-[90%] rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
              La IA esta pensando...
            </div>
          )}
        </div>

        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void submitQuestion(question);
          }}
        >
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Pregunta por una estanteria, una OF, un articulo o una seccion..."
            rows={3}
            disabled={disabled}
            className="min-h-24 flex-1 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={disabled || !question.trim()}
            className="rounded-2xl bg-cyan-600 px-6 py-4 text-sm font-black text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            Preguntar
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistant;
