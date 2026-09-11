/**
 * PhotoCarousel — Visor a pantalla completa de fotos de ubicación.
 *
 * Navegación por flechas (desktop) y swipe (touch), contador, caption + posición,
 * tap-to-zoom (escala 1↔2) y botón eliminar opcional. Reutilizable tanto para las
 * fotos de una sola ubicación como para todas las de una estantería.
 */
import React from 'react';
import type { LocationPhoto } from '../../lib/schema/locations';

export interface CarouselEntry {
  photo: LocationPhoto;
  /** Posición de la ubicación (para mostrar de dónde es la foto en el carrusel del shelf). */
  position?: string;
}

interface PhotoCarouselProps {
  entries: CarouselEntry[];
  initialIndex?: number;
  canManage?: boolean;
  onDelete?: (entry: CarouselEntry) => void | Promise<void>;
  onClose: () => void;
}

const PhotoCarousel: React.FC<PhotoCarouselProps> = ({
  entries,
  initialIndex = 0,
  canManage = false,
  onDelete,
  onClose,
}) => {
  const [index, setIndex] = React.useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(entries.length - 1, 0)),
  );
  const [zoomed, setZoomed] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const touchStartX = React.useRef<number | null>(null);

  const total = entries.length;
  const current = entries[index];

  const go = React.useCallback(
    (delta: number) => {
      setZoomed(false);
      setIndex((i) => {
        const next = i + delta;
        if (next < 0) return 0;
        if (next > total - 1) return total - 1;
        return next;
      });
    },
    [total],
  );

  // Teclado (desktop)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // Si la lista se vacía (tras borrar la última), cerrar.
  React.useEffect(() => {
    if (total === 0) onClose();
    else if (index > total - 1) setIndex(total - 1);
  }, [total, index, onClose]);

  if (!current) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || zoomed) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  const handleDelete = async () => {
    if (!onDelete || deleting) return;
    if (!window.confirm('¿Eliminar esta foto?')) return;
    setDeleting(true);
    try {
      await onDelete(current);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/95 backdrop-blur-sm" onClick={onClose}>
      {/* Barra superior */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-bold font-mono tabular-nums">
          {index + 1} / {total}
          {current.position ? <span className="ml-2 text-violet-300">· pos. {parseInt(current.position, 10) || current.position}</span> : null}
        </span>
        <div className="flex items-center gap-3">
          {canManage && onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold active:scale-95 transition-all disabled:opacity-50"
            >
              Eliminar
            </button>
          )}
          <button
            onClick={onClose}
            className="text-white text-3xl leading-none hover:text-rose-300"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      </div>

      {/* Imagen */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center overflow-hidden relative select-none"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {index > 0 && (
          <button
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white text-2xl flex items-center justify-center active:scale-95 transition-all"
            aria-label="Anterior"
          >
            ‹
          </button>
        )}
        <img
          src={current.photo.url}
          alt={current.photo.caption ?? 'Foto de ubicación'}
          loading="lazy"
          onClick={() => setZoomed((z) => !z)}
          className={`max-h-full max-w-full object-contain transition-transform duration-200 ${zoomed ? 'scale-[2] cursor-zoom-out' : 'cursor-zoom-in'}`}
        />
        {index < total - 1 && (
          <button
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white text-2xl flex items-center justify-center active:scale-95 transition-all"
            aria-label="Siguiente"
          >
            ›
          </button>
        )}
      </div>

      {/* Pie */}
      <div className="px-4 py-3 text-center text-white/90 shrink-0" onClick={(e) => e.stopPropagation()}>
        {current.photo.caption && <p className="text-sm font-medium">{current.photo.caption}</p>}
        <p className="text-[11px] text-white/50 mt-0.5">
          {current.photo.uploadedByName}
          {current.photo.uploadedAt
            ? ` · ${new Date(current.photo.uploadedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}`
            : ''}
        </p>
      </div>
    </div>
  );
};

export default PhotoCarousel;
