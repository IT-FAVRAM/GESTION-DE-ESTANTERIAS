/**
 * LocationPhotoGallery — Miniaturas + subida de fotos de una ubicación.
 *
 * Se renderiza dentro del modal de celda (OperativeShelfArea). Sube/elimina vía
 * photoApi y notifica al contenedor con `onPhotosUpdated` para refrescar el estado
 * local sin esperar al snapshot de Firestore.
 */
import React from 'react';
import { photoApi } from '../../lib/api/photoApi';
import type { LocationPhoto } from '../../lib/schema/locations';
import PhotoCarousel from './PhotoCarousel';
import PhotoCameraCapture from './PhotoCameraCapture';

const hasCameraSupport = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

interface LocationPhotoGalleryProps {
  shelfCode: string;
  position: string;
  photos: LocationPhoto[];
  canManage: boolean;
  uploadedBy: string;
  uploadedByName: string;
  onPhotosUpdated: (photos: LocationPhoto[]) => void;
}

const LocationPhotoGallery: React.FC<LocationPhotoGalleryProps> = ({
  shelfCode,
  position,
  photos,
  canManage,
  uploadedBy,
  uploadedByName,
  onPhotosUpdated,
}) => {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = React.useState<number | null>(null);
  const [showCamera, setShowCamera] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const photo = await photoApi.uploadPhoto(shelfCode, position, file, uploadedBy, uploadedByName);
      onPhotosUpdated([...photos, photo]);
    } catch (err) {
      console.error('[LocationPhotoGallery] upload error:', err);
      setError('No se pudo subir la foto. Inténtalo de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite resubir el mismo archivo
    if (!file) return;
    await uploadFile(file);
  };

  const handleAddPhoto = () => {
    if (hasCameraSupport()) {
      setShowCamera(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleCameraCapture = async (file: File) => {
    setShowCamera(false);
    await uploadFile(file);
  };

  const handleDelete = async (photo: LocationPhoto) => {
    setError(null);
    try {
      await photoApi.deletePhoto(shelfCode, position, photo);
      onPhotosUpdated(photos.filter((p) => p.id !== photo.id));
    } catch (err) {
      console.error('[LocationPhotoGallery] delete error:', err);
      setError('No se pudo eliminar la foto.');
    }
  };

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fotos</p>
          {photos.length > 0 && (
            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
              {photos.length}
            </span>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddPhoto}
              disabled={uploading}
              className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold active:scale-95 transition-all disabled:opacity-50 touch-manipulation"
            >
              {uploading ? '⏳ Subiendo…' : '📷 Hacer foto'}
            </button>
            {hasCameraSupport() && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline underline-offset-2 disabled:opacity-50 touch-manipulation"
              >
                elegir archivo
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-[11px] text-rose-600 font-medium mb-1.5">{error}</p>}

      {photos.length === 0 ? (
        <button
          onClick={canManage ? handleAddPhoto : undefined}
          disabled={!canManage || uploading}
          className={`w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-400 ${canManage ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default'}`}
        >
          {canManage ? 'Sin fotos — toca para añadir' : 'Sin fotos'}
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((photo, idx) => (
            <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              <img
                src={photo.url}
                alt={photo.caption ?? 'Foto'}
                loading="lazy"
                onClick={() => setCarouselIndex(idx)}
                className="w-full h-full object-cover cursor-pointer active:scale-95 transition-transform"
              />
              {canManage && (
                <button
                  onClick={() => handleDelete(photo)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 hover:bg-rose-600 text-white text-xs flex items-center justify-center"
                  aria-label="Eliminar foto"
                >
                  ×
                </button>
              )}
              {photo.caption && (
                <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[9px] px-1 py-0.5 truncate">
                  {photo.caption}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      {carouselIndex !== null && (
        <PhotoCarousel
          entries={photos.map((p) => ({ photo: p }))}
          initialIndex={carouselIndex}
          canManage={canManage}
          onDelete={(entry) => handleDelete(entry.photo)}
          onClose={() => setCarouselIndex(null)}
        />
      )}

      {showCamera && (
        <PhotoCameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};

export default LocationPhotoGallery;
