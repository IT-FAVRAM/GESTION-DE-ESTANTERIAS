/**
 * photoApi — Fotos asociadas a una UBICACIÓN (posición de estantería) en SOLDADURA.
 *
 * Los metadatos viven en un array `photos` dentro del doc de la ubicación
 * (shelves/{shelfCode}/locations/{position}), escrito desde el cliente igual que
 * las notas. La frontera de seguridad por rol está en firestore.rules; las
 * Storage rules solo validan auth + image/* + tamaño (no pueden leer el rol).
 *
 * El binario se sube a Storage en locations/{shelfCode}/{position}/{uuid}.jpg
 * comprimido a JPEG (máx 1200px lado largo, calidad 0.8).
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, setDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { COLLECTIONS } from '../schema/collections';
import type { LocationPhoto } from '../schema/locations';

export type { LocationPhoto };

/** Comprime una imagen a JPEG (máx 1200px lado largo, calidad 0.8). */
const compressImage = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      if (!ctx) {
        reject(new Error('No 2D context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
        'image/jpeg',
        0.8,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo cargar la imagen'));
    };
    img.src = objectUrl;
  });

const locationRef = (shelfCode: string, position: string) =>
  doc(db, COLLECTIONS.SHELVES, shelfCode, COLLECTIONS.LOCATIONS, position);

export const photoApi = {
  /** Sube una foto a una ubicación y guarda su metadato en Firestore. */
  async uploadPhoto(
    shelfCode: string,
    position: string,
    file: File,
    uploadedBy: string,
    uploadedByName: string,
    caption?: string,
  ): Promise<LocationPhoto> {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storagePath = `locations/${shelfCode}/${position}/${id}.jpg`;
    const compressed = await compressImage(file);
    await uploadBytes(ref(storage, storagePath), compressed, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(ref(storage, storagePath));

    const photo: LocationPhoto = {
      id,
      url,
      storagePath,
      uploadedBy,
      uploadedByName,
      uploadedAt: Date.now(),
      ...(caption ? { caption } : {}),
    };

    // IMPORTANTE: ramificar según exista el doc.
    //  - Si existe (celda ocupada o no): updateDoc SOLO el array photos
    //    (changedKeys = ['photos'], cumple la regla update hasOnly(['nota','photos'])
    //    y NO toca items/isEmpty — jamás se pisan los artículos ubicados).
    //  - Si no existe (posición vacía sin doc): create con la forma acotada que
    //    exige la regla create (position/items/isEmpty/photos, items vacío).
    const locRef = locationRef(shelfCode, position);
    const snap = await getDoc(locRef);
    if (snap.exists()) {
      await updateDoc(locRef, { photos: arrayUnion(photo) });
    } else {
      await setDoc(locRef, { position, items: [], isEmpty: true, photos: [photo] });
    }

    return photo;
  },

  /** Elimina una foto de Storage y de Firestore. */
  async deletePhoto(shelfCode: string, position: string, photo: LocationPhoto): Promise<void> {
    await deleteObject(ref(storage, photo.storagePath)).catch(() => {
      /* ignorar si el binario ya no existe */
    });
    await updateDoc(locationRef(shelfCode, position), { photos: arrayRemove(photo) });
  },

  /** Devuelve las fotos de una ubicación. */
  async getPhotos(shelfCode: string, position: string): Promise<LocationPhoto[]> {
    const snap = await getDoc(locationRef(shelfCode, position));
    if (!snap.exists()) return [];
    return (snap.data().photos ?? []) as LocationPhoto[];
  },
};
