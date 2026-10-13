"use strict";
/**
 * pieceCounter — Conteo de piezas por imagen con Claude (visión).
 *
 * Caso de uso: en PUNZONADO, tras el corte láser se "desprenden" las piezas del
 * retal y se van apilando. Contarlas a mano es lento y propenso a error. Esta
 * función recibe una foto + (para pilas) el espesor de cada pieza, y usa el
 * modelo de visión más capaz de Anthropic (Claude Opus 4.8) para devolver un
 * conteo con confianza, rango y avisos.
 *
 * Dos modos:
 *  - 'stacked'  → pilas apiladas: cuenta las láminas. El espesor ayuda al
 *                 razonamiento por altura cuando las líneas no se distinguen.
 *  - 'loose'    → piezas sueltas: detección/conteo de objetos en la imagen.
 *
 * Patrón calcado de `ocr.ts` (https.onCall, imagen base64). La API key se
 * inyecta como SECRET de Firebase (`ANTHROPIC_API_KEY`); mientras no esté
 * configurada, la función devuelve un error claro en vez de fallar de forma
 * opaca.
 *
 * Honestidad de cara al taller: en modo "solo foto + espesor" (sin referencia
 * de escala) NO se aplica altura÷espesor exacto. El resultado es muy bueno en
 * pilas separadas/moderadas; en pilas densas se devuelve un RANGO + aviso para
 * que el operario ajuste antes de confirmar.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.countPieces = void 0;
const functions = require("firebase-functions");
const sdk_1 = require("@anthropic-ai/sdk");
const MAX_IMAGE_BYTES = 7 * 1024 * 1024; // ~5 MB de imagen en base64
const MODEL = 'claude-opus-4-8';
// Cliente singleton (se reutiliza entre invocaciones en caliente).
let _client = null;
function getClient() {
    if (!_client) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey)
            throw new Error('NO_API_KEY');
        _client = new sdk_1.default({ apiKey });
    }
    return _client;
}
const SYSTEM_PROMPT = `Eres un asistente experto en CONTAR piezas de chapa metálica en un taller industrial (sección de punzonado/láser). Tras el corte se desprenden piezas del retal y se apilan. Tu tarea es contar las piezas de una foto con la máxima precisión posible y, sobre todo, con honestidad sobre tu confianza.

Reglas:
- Analiza la imagen con cuidado antes de responder.
- MODO "pilas apiladas": cuenta las piezas de la pila contando las líneas de separación entre láminas. Si te indican el espesor de cada pieza, úsalo como ayuda para razonar por la altura total cuando las líneas no se distingan bien. NO inventes una regla de medición si no hay una referencia de escala en la foto.
- MODO "piezas sueltas": cuenta cuántas piezas/objetos distintos hay, aunque estén girados o parcialmente solapados.
- Si la pila es muy densa, hay reflejos, rebabas, solapamiento o piezas cortadas por el borde y NO puedes contar con certeza, NO te inventes un número exacto: da tu mejor estimación y un rango realista (min/max), y añade un aviso explicando por qué.
- "confidencePct" debe reflejar tu certeza real (0-100). Pilas claras y separadas → alta; pilas densas o fotos malas → baja.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown, con EXACTAMENTE esta forma:
{
  "count": <entero, tu mejor estimación del número de piezas>,
  "confidencePct": <entero 0-100>,
  "range": { "min": <entero>, "max": <entero> },
  "method": "<frase corta: cómo lo contaste, p.ej. 'conteo de líneas de separación' o 'conteo de objetos'>",
  "reasoning": "<1-2 frases en español explicando el conteo>",
  "warnings": [ "<avisos en español si los hay; lista vacía si no>" ]
}`;
function buildUserText(mode, thicknessMm) {
    if (mode === 'stacked') {
        return [
            'MODO: pilas apiladas.',
            `Espesor de cada pieza: ${thicknessMm} mm.`,
            'Cuenta cuántas piezas hay en la pila. Usa las líneas de separación entre láminas y el espesor como ayuda. Si no puedes contar con certeza, da un rango y avisa.',
            'Devuelve solo el JSON.',
        ].join(' ');
    }
    return [
        'MODO: piezas sueltas (no apiladas).',
        'Cuenta cuántas piezas/objetos distintos hay en la imagen, aunque estén girados o solapados. Si hay solapamiento o piezas cortadas por el borde, da un rango y avisa.',
        'Devuelve solo el JSON.',
    ].join(' ');
}
/** Extrae el primer objeto JSON del texto (tolerante a fences/markdown). */
function extractJson(text) {
    if (!text)
        return null;
    // Intento directo.
    try {
        return JSON.parse(text);
    }
    catch ( /* sigue */_a) { /* sigue */ }
    // Buscar el primer bloque {...} balanceado.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
        const slice = text.slice(start, end + 1);
        try {
            return JSON.parse(slice);
        }
        catch ( /* nada */_b) { /* nada */ }
    }
    return null;
}
function toInt(v, fallback = 0) {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? n : fallback;
}
function normalize(parsed) {
    const count = (parsed === null || parsed === void 0 ? void 0 : parsed.count) == null ? null : toInt(parsed.count);
    let confidencePct = toInt(parsed === null || parsed === void 0 ? void 0 : parsed.confidencePct, 0);
    confidencePct = Math.max(0, Math.min(100, confidencePct));
    let range = null;
    if ((parsed === null || parsed === void 0 ? void 0 : parsed.range) && parsed.range.min != null && parsed.range.max != null) {
        const min = toInt(parsed.range.min);
        const max = toInt(parsed.range.max);
        range = { min: Math.min(min, max), max: Math.max(min, max) };
    }
    const warnings = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.warnings)
        ? parsed.warnings.map((w) => String(w)).filter(Boolean)
        : [];
    return {
        count,
        confidencePct,
        range,
        method: String((parsed === null || parsed === void 0 ? void 0 : parsed.method) || ''),
        reasoning: String((parsed === null || parsed === void 0 ? void 0 : parsed.reasoning) || ''),
        warnings,
    };
}
/**
 * countPieces — recibe { imageBase64, mode, thicknessMm? } y devuelve el conteo.
 * Disponible para cualquier sesión autenticada.
 */
exports.countPieces = functions
    .runWith({ memory: '1GB', timeoutSeconds: 120, secrets: ['ANTHROPIC_API_KEY'] })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado.');
    }
    const mode = (data === null || data === void 0 ? void 0 : data.mode) === 'loose' ? 'loose' : 'stacked';
    let imageBase64 = String((data === null || data === void 0 ? void 0 : data.imageBase64) || '').trim();
    if (!imageBase64) {
        throw new functions.https.HttpsError('invalid-argument', 'Falta la imagen (imageBase64).');
    }
    const commaIdx = imageBase64.indexOf(',');
    if (imageBase64.startsWith('data:') && commaIdx !== -1) {
        imageBase64 = imageBase64.slice(commaIdx + 1);
    }
    // Limpiar BOM y caracteres inválidos en base64
    imageBase64 = imageBase64.replace(/[^\w+/=]/g, '');
    if (imageBase64.length > MAX_IMAGE_BYTES) {
        throw new functions.https.HttpsError('invalid-argument', 'La imagen es demasiado grande.');
    }
    const thicknessMm = Number(data === null || data === void 0 ? void 0 : data.thicknessMm);
    if (mode === 'stacked' && (!Number.isFinite(thicknessMm) || thicknessMm <= 0)) {
        throw new functions.https.HttpsError('invalid-argument', 'Falta el espesor (thicknessMm) para contar pilas.');
    }
    let client;
    try {
        client = getClient();
    }
    catch (_a) {
        throw new functions.https.HttpsError('failed-precondition', 'La API key de Anthropic no está configurada. Configúrala con: firebase functions:secrets:set ANTHROPIC_API_KEY');
    }
    try {
        const resp = await client.messages.create({
            model: MODEL,
            max_tokens: 8192,
            thinking: { type: 'adaptive' },
            system: SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
                        },
                        { type: 'text', text: buildUserText(mode, thicknessMm) },
                    ],
                },
            ],
        });
        if (resp.stop_reason === 'refusal') {
            throw new functions.https.HttpsError('internal', 'El modelo rechazó la solicitud. Repite la foto.');
        }
        const text = resp.content
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('\n')
            .trim();
        const parsed = extractJson(text);
        if (!parsed) {
            console.error('[countPieces] No se pudo parsear JSON:', text.slice(0, 500));
            throw new functions.https.HttpsError('internal', 'No se pudo interpretar el resultado. Inténtalo de nuevo.');
        }
        return Object.assign({ ok: true, mode }, normalize(parsed));
    }
    catch (err) {
        if (err instanceof functions.https.HttpsError)
            throw err;
        const message = (err === null || err === void 0 ? void 0 : err.message) || 'Error desconocido';
        if (/authentication|api[_ ]?key|401/i.test(message)) {
            throw new functions.https.HttpsError('failed-precondition', 'API key de Anthropic inválida o no configurada.');
        }
        console.error('[countPieces] Error interno:', message);
        throw new functions.https.HttpsError('internal', 'Error al procesar la imagen. Inténtalo de nuevo.');
    }
});
//# sourceMappingURL=pieceCounter.js.map