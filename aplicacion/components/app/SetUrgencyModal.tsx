import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { httpsCallable, getFunctions } from 'firebase/functions';

interface SetUrgencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Modal para establecer/editar una urgencia.
 * Campos: artículo (código), orden de fabricación, descripción.
 */
export const SetUrgencyModal: React.FC<SetUrgencyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [articleCode, setArticleCode] = useState('');
  const [articleName, setArticleName] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const functions = getFunctions();
      const setPinnedFn = httpsCallable(functions, 'createUrgentAlert');

      await setPinnedFn({
        text,
        articleCode: articleCode.trim(),
        articleName: articleName.trim() || undefined,
        orderId: orderId.trim(),
        orderNumber: orderNumber.trim() || undefined,
      });

      // Reset form
      setArticleCode('');
      setArticleName('');
      setOrderId('');
      setOrderNumber('');
      setText('');
      onSuccess?.();
      onClose();
    } catch (e: any) {
      console.error('Error setting urgency:', e);
      setError(e.message || 'Error al establecer la urgencia');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-lg shadow-2xl max-w-md w-full mx-4 border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">Establecer Urgencia</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-md">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Código Artículo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Código Artículo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={articleCode}
              onChange={(e) => setArticleCode(e.target.value)}
              placeholder="Ej: 001-ABC-123"
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              disabled={loading}
              required
            />
          </div>

          {/* Nombre Artículo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Nombre Artículo (opcional)
            </label>
            <input
              type="text"
              value={articleName}
              onChange={(e) => setArticleName(e.target.value)}
              placeholder="Ej: Pieza de ejemplo"
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              disabled={loading}
            />
          </div>

          {/* Orden Fabricación */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              ID/Número OF <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Ej: 2026-050123"
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              disabled={loading}
              required
            />
          </div>

          {/* Número Orden Legible */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Número OF (legible, opcional)
            </label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Ej: OF-12345"
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              disabled={loading}
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Descripción / Notas <span className="text-red-500">*</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ej: Artículo crítico, requiere procesamiento urgente..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50 resize-none"
              disabled={loading}
              required
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-rose-700 hover:bg-rose-600 rounded-md text-white font-medium transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !articleCode.trim() || !orderId.trim() || !text.trim()}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fijando...
                </>
              ) : (
                'Fijar Urgencia'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
