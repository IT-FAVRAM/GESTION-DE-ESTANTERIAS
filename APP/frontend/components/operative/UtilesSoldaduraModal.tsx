/**
 * UtilesSoldaduraModal — Modal para añadir/editar texto y fotos en ubicaciones UTS.
 */

import React, { useState, useEffect } from 'react';
import LocationPhotoGallery from '../common/LocationPhotoGallery';
import type { LocationPhoto } from '../../lib/schema/locations';

interface UtilesSoldaduraModalProps {
  open: boolean;
  position: string;
  currentText?: string;
  photos?: LocationPhoto[];
  canManagePhotos?: boolean;
  uploadedBy?: string;
  uploadedByName?: string;
  onClose: () => void;
  onSave: (text: string) => Promise<boolean>;
  onRemove?: () => Promise<boolean>;
  onPhotosUpdated?: (photos: LocationPhoto[]) => void;
}

const UtilesSoldaduraModal: React.FC<UtilesSoldaduraModalProps> = ({
  open,
  position,
  currentText = '',
  photos = [],
  canManagePhotos = false,
  uploadedBy = '',
  uploadedByName = '',
  onClose,
  onSave,
  onRemove,
  onPhotosUpdated,
}) => {
  const [text, setText] = useState(currentText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resetear cuando cambia la posición o el texto
  useEffect(() => {
    setText(currentText);
    setError(null);
  }, [currentText, position]);

  if (!open) return null;

  const handleSave = async () => {
    if (!text.trim()) {
      setError('El texto no puede estar vacío');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ok = await onSave(text.trim());
      if (ok) {
        onClose();
      } else {
        setError('Error al guardar');
      }
    } catch {
      setError('Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setLoading(true);
    try {
      const ok = await onRemove();
      if (ok) {
        onClose();
      } else {
        setError('Error al eliminar');
      }
    } catch {
      setError('Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const hasText = currentText.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-gradient-to-br from-violet-600/5 to-violet-700/5
          bg-white rounded-3xl shadow-2xl border border-white/30
          p-6 sm:p-8 flex flex-col gap-5 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Título */}
        <div className="text-center">
          <div className="text-5xl mb-3">🔧</div>
          <h2 className="text-2xl font-black text-slate-900">Útiles Soldadura</h2>
          <p className="text-sm text-slate-500 mt-1">{position}</p>
        </div>

        {/* Campo de texto */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-slate-700">Texto:</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe aquí el contenido..."
            rows={3}
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 
              focus:border-violet-400 focus:ring-2 focus:ring-violet-200
              text-slate-800 placeholder-slate-400 resize-none
              disabled:opacity-50 transition-all"
            autoFocus
          />
        </div>

        {/* Galería de fotos */}
        <LocationPhotoGallery
          shelfCode="UTS"
          position={position}
          photos={photos}
          canManage={canManagePhotos}
          uploadedBy={uploadedBy}
          uploadedByName={uploadedByName}
          onPhotosUpdated={onPhotosUpdated ?? (() => {})}
        />

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        {/* Botones */}
        <div className="flex flex-col gap-3 mt-2">
          {/* Guardar */}
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !text.trim()}
            className="w-full h-14 rounded-2xl text-lg font-black shadow-lg 
              transition-all active:scale-[0.98] disabled:opacity-50
              bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </span>
            ) : hasText ? 'ACTUALIZAR' : 'AÑADIR'}
          </button>

          {/* Eliminar (solo si hay texto) */}
          {hasText && onRemove && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={loading}
              className="w-full h-14 rounded-2xl text-lg font-bold
                transition-all active:scale-[0.98] disabled:opacity-50
                bg-red-600 hover:bg-red-500 active:bg-red-700 text-white"
            >
              RETIRAR
            </button>
          )}

          {/* Cancelar */}
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full h-12 rounded-xl text-base font-bold text-white
              bg-slate-600 hover:bg-slate-500 border border-slate-600
              transition-all active:scale-[0.98] disabled:opacity-50"
          >
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
};

export default UtilesSoldaduraModal;
