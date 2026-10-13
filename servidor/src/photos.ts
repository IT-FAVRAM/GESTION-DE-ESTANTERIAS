import * as functions from 'firebase-functions';
import { admin } from './firebaseAdmin';

/**
 * onLocationDeleted — limpieza de fotos huérfanas.
 *
 * Cuando se elimina el doc de una ubicación, borra de Storage los binarios de sus
 * fotos (array `photos`). Salvaguarda: hoy las locations rara vez se borran (las
 * firestore.rules solo permiten borrado vía Cloud Functions), pero evita dejar
 * archivos colgando en el bucket si llegara a ocurrir.
 */
export const onLocationDeleted = functions.firestore
  .document('shelves/{shelfCode}/locations/{position}')
  .onDelete(async (snap: any, context: any) => {
    const { shelfCode, position } = context.params;
    const photos: Array<{ storagePath?: string }> = snap.data()?.photos ?? [];
    if (!Array.isArray(photos) || photos.length === 0) return;

    const bucket = admin.storage().bucket();
    await Promise.all(
      photos
        .filter((p) => !!p?.storagePath)
        .map((p) => bucket.file(p.storagePath as string).delete().catch(() => { /* ya no existe */ })),
    );
    console.log(`[photos] Limpiadas ${photos.length} foto(s) de ${shelfCode}/${position}`);
  });
