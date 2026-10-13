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
function buildVisualLines(words) {
    if (words.length === 0)
        return [];
    const heights = words.map((w) => w.h).filter((h) => h > 0).sort((a, b) => a - b);
    const medianH = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 12;
    // Tolerancia: palabras cuyo centro vertical cae dentro de ~media altura de
    // letra pertenecen al mismo renglón.
    const tolerance = Math.max(6, medianH * 0.6);
    const sorted = [...words].sort((a, b) => a.yc - b.yc);
    const groups = [];
    let current = [];
    let currentY = 0;
    for (const w of sorted) {
        if (current.length > 0 && Math.abs(w.yc - currentY) > tolerance) {
            groups.push(current);
            current = [];
        }
        current.push(w);
        currentY = current.reduce((s, x) => s + x.yc, 0) / current.length;
    }
    if (current.length > 0)
        groups.push(current);
    return groups.map((g) => g.sort((a, b) => a.x - b.x).map((w) => w.text).join(' '));
}
/**
 * ocrImage — recibe { imageBase64 } (sin el prefijo data:) y devuelve
 * { text, confidence, lines }. Disponible para cualquier sesión autenticada
 * (incluidos los kioskos anónimos, que solo necesitan leer etiquetas).
 */
exports.ocrImage = functions
    .runWith({ memory: '512MB', timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    var _a;
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
        const paragraphLines = [];
        const allWords = [];
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
                        if (!w)
                            continue;
                        words.push(w);
                        const vertices = ((_a = word.boundingBox) === null || _a === void 0 ? void 0 : _a.vertices) || [];
                        if (vertices.length >= 3) {
                            const xs = vertices.map((v) => v.x || 0);
                            const ys = vertices.map((v) => v.y || 0);
                            const minY = Math.min(...ys);
                            const maxY = Math.max(...ys);
                            allWords.push({
                                text: w,
                                x: Math.min(...xs),
                                yc: (minY + maxY) / 2,
                                h: maxY - minY,
                            });
                        }
                    }
                    if (words.length)
                        paragraphLines.push(words.join(' '));
                }
            }
        }
        // Líneas en orden de lectura visual; si no hay coordenadas (raro),
        // se mantienen las líneas por párrafo como antes.
        const visualLines = buildVisualLines(allWords);
        const lines = visualLines.length > 0 ? visualLines : paragraphLines;
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
        console.error('[ocrImage] Error interno:', message);
        throw new functions.https.HttpsError('internal', 'Error al procesar la imagen. Inténtalo de nuevo.');
    }
});
//# sourceMappingURL=ocr.js.map