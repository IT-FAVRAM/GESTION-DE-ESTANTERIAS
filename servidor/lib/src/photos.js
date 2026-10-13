"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onLocationDeleted = void 0;
const functions = require("firebase-functions");
const firebaseAdmin_1 = require("./firebaseAdmin");
/**
 * onLocationDeleted — limpieza de fotos huérfanas.
 *
 * Cuando se elimina el doc de una ubicación, borra de Storage los binarios de sus
 * fotos (array `photos`). Salvaguarda: hoy las locations rara vez se borran (las
 * firestore.rules solo permiten borrado vía Cloud Functions), pero evita dejar
 * archivos colgando en el bucket si llegara a ocurrir.
 */
exports.onLocationDeleted = functions.firestore
    .document('shelves/{shelfCode}/locations/{position}')
    .onDelete(async (snap, context) => {
    var _a, _b;
    const { shelfCode, position } = context.params;
    const photos = (_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.photos) !== null && _b !== void 0 ? _b : [];
    if (!Array.isArray(photos) || photos.length === 0)
        return;
    const bucket = firebaseAdmin_1.admin.storage().bucket();
    await Promise.all(photos
        .filter((p) => !!(p === null || p === void 0 ? void 0 : p.storagePath))
        .map((p) => bucket.file(p.storagePath).delete().catch(() => { })));
    console.log(`[photos] Limpiadas ${photos.length} foto(s) de ${shelfCode}/${position}`);
});
//# sourceMappingURL=photos.js.map