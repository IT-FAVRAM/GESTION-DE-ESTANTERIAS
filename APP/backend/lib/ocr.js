"use strict";
/**
 * ocr — OCR de etiquetas con Google Cloud Vision.
 *
 * Tesseract.js (cliente) era muy malo, sobre todo con texto manuscrito.
 * Esta función usa Cloud Vision `DOCUMENT_TEXT_DETECTION`, que lee impreso
 * Y manuscrito con calidad muy superior. Se autentica con la service account
 * por defecto del entorno de Cloud Functions (Application Default Credentials),
 * por lo que NO requiere ninguna API key adicional.
 *
 * El cliente envía la imagen recortada en base64; la función devuelve el texto
 * crudo + un score de confianza medio. El parseo a {articleCode, orderFab} se
 * mantiene en el cliente (parseScanInputLenient), igual que antes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrImage = void 0;
const functions = require("firebase-functions");
const vision_1 = require("@google-cloud/vision");
// Cliente singleton (se reutiliza entre invocaciones en caliente).
let _client = null;
function getClient() {
    if (!_client)
        _client = new vision_1.ImageAnnotatorClient();
    return _client;
}
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB de base64 (~6 MB de imagen)
/**
 * ocrImage — recibe { imageBase64 } (sin el prefijo data:) y devuelve
 * { text, confidence, lines }. Disponible para cualquier sesión autenticada
 * (incluidos los kioskos anónimos, que solo necesitan leer etiquetas).
 */
exports.ocrImage = functions
    .runWith({ memory: '512MB', timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado.');
    }
    let imageBase64 = String((data === null || data === void 0 ? void 0 : data.imageBase64) || '').trim();
    if (!imageBase64) {
        throw new functions.https.HttpsError('invalid-argument', 'Falta la imagen (imageBase64).');
    }
    // Tolerar que llegue con el prefijo data:image/...;base64,
    const commaIdx = imageBase64.indexOf(',');
    if (imageBase64.startsWith('data:') && commaIdx !== -1) {
        imageBase64 = imageBase64.slice(commaIdx + 1);
    }
    if (imageBase64.length > MAX_IMAGE_BYTES) {
        throw new functions.https.HttpsError('invalid-argument', 'La imagen es demasiado grande.');
    }
    try {
        const client = getClient();
        const [result] = await client.documentTextDetection({
            image: { content: imageBase64 },
            // Pista de idioma: español + inglés (códigos alfanuméricos).
            imageContext: { languageHints: ['es', 'en'] },
        });
        const fullText = result.fullTextAnnotation;
        const rawText = ((fullText === null || fullText === void 0 ? void 0 : fullText.text) || '').trim();
        // Confianza media a partir de las páginas/bloques detectados.
        let confSum = 0;
        let confCount = 0;
        const lines = [];
        for (const page of (fullText === null || fullText === void 0 ? void 0 : fullText.pages) || []) {
            for (const block of page.blocks || []) {
                if (typeof block.confidence === 'number') {
                    confSum += block.confidence;
                    confCount += 1;
                }
                for (const paragraph of block.paragraphs || []) {
                    const words = [];
                    for (const word of paragraph.words || []) {
                        const w = (word.symbols || []).map((s) => s.text || '').join('');
                        if (w)
                            words.push(w);
                    }
                    if (words.length)
                        lines.push(words.join(' '));
                }
            }
        }
        const confidence = confCount > 0 ? Math.round((confSum / confCount) * 100) : (rawText ? 70 : 0);
        return {
            ok: true,
            text: rawText,
            lines,
            confidence,
        };
    }
    catch (err) {
        const message = (err === null || err === void 0 ? void 0 : err.message) || 'Error desconocido en Vision';
        // PERMISSION_DENIED suele indicar que la Vision API no está habilitada.
        if (/permission|denied|disabled|not been used|SERVICE_DISABLED/i.test(message)) {
            throw new functions.https.HttpsError('failed-precondition', 'La API de Vision no está habilitada en el proyecto.');
        }
        throw new functions.https.HttpsError('internal', `OCR falló: ${message}`);
    }
});
//# sourceMappingURL=ocr.js.map