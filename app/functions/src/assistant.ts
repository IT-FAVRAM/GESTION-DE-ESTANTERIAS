import * as functions from 'firebase-functions';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { defineSecret } from 'firebase-functions/params';
import { normalizeRole, requireAllowedRoles } from './authz';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const MODEL_NAME = 'gemini-2.0-flash';
const INVENTORY_ASSISTANT_MODEL = process.env.GEMINI_ASSISTANT_MODEL || 'gemini-2.0-flash-lite';
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const requestLog: Record<string, number[]> = {};

const getGeminiClient = () => {
  const apiKey = GEMINI_API_KEY.value() || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new functions.https.HttpsError('failed-precondition', 'AI not configured.');
  return new GoogleGenerativeAI(apiKey);
};

const checkRateLimit = (uid: string) => {
  const now = Date.now();
  requestLog[uid] = (requestLog[uid] || []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  if (requestLog[uid].length >= MAX_REQUESTS_PER_WINDOW) throw new functions.https.HttpsError('resource-exhausted', 'Too many requests. Please wait a minute.');
  requestLog[uid].push(now);
};

const ALLOWED_AI_TYPES_BY_ROLE: Record<string, string[]> = {
  ADMIN: ['textFromImage', 'combinedData', 'codeFromImage', 'inventorySummary', 'historySummary', 'traceabilityReport', 'anomalyDetection', 'locationPrediction', 'metalCount'],
  JEFE: ['textFromImage', 'combinedData', 'codeFromImage', 'inventorySummary', 'historySummary', 'traceabilityReport', 'metalCount'],
  JEFE_SECCION: ['textFromImage', 'combinedData', 'codeFromImage', 'inventorySummary', 'historySummary', 'traceabilityReport', 'metalCount'],
  CARRETILLERO: ['textFromImage', 'combinedData', 'codeFromImage', 'metalCount'],
};

const NON_TRUNCATED_FIELDS = new Set(['image', 'processedImage']);

const sanitizeInput = (input: any, parentKey?: string): any => {
  if (typeof input === 'string') {
    const cleaned = input.replace(/[\x00-\x1F\x7F]/g, '');
    return parentKey && NON_TRUNCATED_FIELDS.has(parentKey) ? cleaned : cleaned.substring(0, 5000);
  }
  if (Array.isArray(input)) return input.map((item) => sanitizeInput(item, parentKey));
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) sanitized[key] = sanitizeInput(value, key);
    return sanitized;
  }
  return input;
};

export const generateGeminiResponse = functions.runWith({ secrets: [GEMINI_API_KEY] }).https.onCall(async (data: any, context: any) => {
  if (!context.auth) return { success: false, error: 'Usuario no autenticado.' };
  const uid = context.auth.uid;
  const now = Date.now();
  const recentRequests = (requestLog[uid] || []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) return { success: false, error: 'Limite de peticiones excedido. Intente de nuevo en un momento.' };
  recentRequests.push(now);
  requestLog[uid] = recentRequests;
  if (Math.random() < 0.1) {
    Object.keys(requestLog).forEach((userId) => {
      requestLog[userId] = requestLog[userId].filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
      if (requestLog[userId].length === 0) delete requestLog[userId];
    });
  }

  try {
    const model = getGeminiClient().getGenerativeModel({ model: MODEL_NAME });
    const { type, payload: rawPayload } = data;
    const role = normalizeRole((context.auth.token.role as string) || '');
    const allowedTypes = ALLOWED_AI_TYPES_BY_ROLE[role] || [];
    if (!allowedTypes.includes(type)) throw new functions.https.HttpsError('permission-denied', 'AI operation not allowed for this role.');
    const payload = sanitizeInput(rawPayload);
    let prompt = '';
    let schema: any;
    let mimeType = 'application/json';
    let imagePart = null;

    switch (type) {
      case 'textFromImage':
        imagePart = { inlineData: { mimeType: 'image/jpeg', data: payload.image } };
        prompt = 'Extrae el texto y/o codigo alfanumerico visible en esta imagen. Devuelve SOLO el texto plano extraido, en Espanol.';
        mimeType = 'text/plain';
        break;
      case 'combinedData':
        imagePart = { inlineData: { mimeType: 'image/jpeg', data: payload.image } };
        prompt = 'Extrae JSON {"article":"string","orderId":"string"} de la etiqueta. Si falta alguno, intenta deducirlo o deja cadena vacia.';
        schema = { type: SchemaType.OBJECT, properties: { article: { type: SchemaType.STRING }, orderId: { type: SchemaType.STRING } }, required: ['article', 'orderId'] };
        break;
      case 'codeFromImage':
        imagePart = { inlineData: { mimeType: 'image/jpeg', data: payload.image } };
        prompt = payload.context === 'order' ? 'BUSCA ORDEN OF. Devuelve SOLO el codigo o NOT_FOUND.' : payload.context === 'location' ? 'BUSCA UBICACION o ALMACEN. Devuelve SOLO el codigo o NOT_FOUND.' : 'BUSCA REFERENCIA ARTICULO. Devuelve SOLO el codigo o NOT_FOUND.';
        mimeType = 'text/plain';
        break;
      case 'inventorySummary':
        prompt = `Resume en Markdown y en espanol estos datos de inventario: ${payload.assignmentsSummary}`;
        mimeType = 'text/plain';
        break;
      case 'historySummary':
        prompt = `Resume en Markdown y en espanol esta actividad reciente: ${payload.historySummary}`;
        mimeType = 'text/plain';
        break;
      case 'traceabilityReport':
        prompt = `Genera informe breve de trazabilidad en Markdown y en espanol con estos datos: ${JSON.stringify(payload.itemHistory, null, 2)}`;
        mimeType = 'text/plain';
        break;
      case 'anomalyDetection':
        prompt = `Detecta anomalias y devuelve JSON en espanol con estos datos: duplicados ${JSON.stringify(payload.duplicates)} densidad ${JSON.stringify(payload.highDensity)} historial ${JSON.stringify(payload.history)}`;
        schema = { type: SchemaType.OBJECT, properties: { summary: { type: SchemaType.STRING }, anomalies: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { type: { type: SchemaType.STRING }, severity: { type: SchemaType.STRING }, locationId: { type: SchemaType.STRING }, articleId: { type: SchemaType.STRING }, description: { type: SchemaType.STRING }, suggestions: { type: SchemaType.STRING } }, required: ['type', 'severity', 'description'] } }, recommendations: { type: SchemaType.STRING } }, required: ['summary', 'anomalies'] };
        break;
      case 'locationPrediction':
        prompt = `Predice ubicaciones en JSON y en espanol para ${payload.articleId}. Actual: ${payload.currentLocations}. Historial: ${JSON.stringify(payload.history)}`;
        schema = { type: SchemaType.OBJECT, properties: { summary: { type: SchemaType.STRING }, predictions: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { locationId: { type: SchemaType.STRING }, probability: { type: SchemaType.NUMBER }, reason: { type: SchemaType.STRING } }, required: ['locationId', 'probability', 'reason'] } }, notes: { type: SchemaType.STRING } }, required: ['summary', 'predictions'] };
        break;
      case 'metalCount':
        prompt = `Cuenta chapas y devuelve JSON estricto. Material ${payload.material}. Grosor ${payload.thickness}. Calibracion ${payload.calibrationHeightPx || 'no disponible'}. Pista CV ${payload.cvEstimate ? JSON.stringify(payload.cvEstimate) : 'sin pista CV'}.`;
        schema = { type: SchemaType.OBJECT, properties: { estimatedCount: { type: SchemaType.INTEGER }, theoreticalBlockHeightMm: { type: SchemaType.NUMBER }, confidence: { type: SchemaType.STRING }, reasoning: { type: SchemaType.STRING }, visualNotes: { type: SchemaType.STRING }, countPassA: { type: SchemaType.INTEGER }, countPassB: { type: SchemaType.INTEGER }, separatorsDetected: { type: SchemaType.INTEGER }, patternRegularity: { type: SchemaType.STRING }, recommendedSource: { type: SchemaType.STRING } }, required: ['estimatedCount', 'theoreticalBlockHeightMm', 'confidence', 'reasoning', 'visualNotes', 'countPassA', 'countPassB', 'separatorsDetected', 'patternRegularity', 'recommendedSource'] };
        break;
      default:
        throw new functions.https.HttpsError('invalid-argument', `Unknown request type: ${type}`);
    }

    const parts: any[] = [{ text: prompt }];
    if (type === 'metalCount') {
      parts.push({ text: 'Imagen 1: ORIGINAL' }, { inlineData: { mimeType: 'image/jpeg', data: payload.image } });
      if (payload.processedImage) parts.push({ text: 'Imagen 2: PROCESADA' }, { inlineData: { mimeType: 'image/jpeg', data: payload.processedImage } });
    } else if (imagePart) {
      parts.push(imagePart);
    }

    const generationConfig: any = { temperature: 0.4, topK: 32, topP: 0.95, maxOutputTokens: 8192, responseMimeType: mimeType };
    if (schema) generationConfig.responseSchema = schema;
    const result = await model.generateContent({ contents: [{ role: 'user', parts }], generationConfig });
    return { success: true, data: schema ? JSON.parse(result.response.text() || '{}') : result.response.text() };
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to generate AI response.');
  }
});

export const inventoryAssistant = functions.runWith({ secrets: [GEMINI_API_KEY] }).https.onCall(async (data: any, context: any) => {
  const user = await requireAllowedRoles(context, ['ADMIN', 'SUPERADMIN']);
  checkRateLimit(user.uid);
  const question = typeof data?.question === 'string' ? data.question.trim() : '';
  const inventoryContext = data?.context || {};
  if (!question) throw new functions.https.HttpsError('invalid-argument', 'La pregunta es obligatoria.');
  const model = getGeminiClient().getGenerativeModel({ model: INVENTORY_ASSISTANT_MODEL });
  const prompt = `Eres un asistente logistico para un WMS de estanterias. Responde SIEMPRE en espanol, en Markdown breve y profesional. Usa solo el contexto JSON recibido; no inventes datos. Usuario: ${user.email || user.uid}. Pregunta: ${question}. Contexto JSON del inventario: ${JSON.stringify(inventoryContext)}`;
  const result = await model.generateContent(prompt);
  return { answer: result.response.text(), model: INVENTORY_ASSISTANT_MODEL };
});
