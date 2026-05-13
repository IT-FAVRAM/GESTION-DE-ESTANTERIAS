import * as functions from "firebase-functions";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { defineSecret } from "firebase-functions/params";
import { getWmsSectionForShelf, normalizeRole, requireAllowedRoles } from './authz';
import { admin } from './firebaseAdmin';
import { getAppConfig, getUsersByEmails, notifyUsersByRole, sendPushToUsers } from './push';

// Configuration
// Set secret via: firebase functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const MODEL_NAME = 'gemini-2.0-flash'; // Optimized model
const INVENTORY_ASSISTANT_MODEL = process.env.GEMINI_ASSISTANT_MODEL || 'gemini-2.0-flash-lite';
const STALE_ITEM_THRESHOLD_DAYS = 5;
const STALE_ITEM_ALERT_INTERVAL_HOURS = 48;

const getGeminiClient = () => {
    const apiKey = GEMINI_API_KEY.value() || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new functions.https.HttpsError("failed-precondition", "AI not configured.");
    }
    return new GoogleGenerativeAI(apiKey);
};

// Rate Limiting (Simple In-Memory for this scale)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;
const requestLog: Record<string, number[]> = {};

const checkRateLimit = (uid: string) => {
    const now = Date.now();
    if (!requestLog[uid]) requestLog[uid] = [];

    // Filter out old requests
    requestLog[uid] = requestLog[uid].filter(time => now - time < RATE_LIMIT_WINDOW_MS);

    if (requestLog[uid].length >= MAX_REQUESTS_PER_WINDOW) {
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests. Please wait a minute.");
    }

    requestLog[uid].push(now);
};

const ALLOWED_AI_TYPES_BY_ROLE: Record<string, string[]> = {
    ADMIN: [
        "textFromImage", "combinedData", "codeFromImage", "inventorySummary", "historySummary",
        "traceabilityReport", "anomalyDetection", "locationPrediction", "metalCount"
    ],
    JEFE: [
        "textFromImage", "combinedData", "codeFromImage", "inventorySummary", "historySummary",
        "traceabilityReport", "metalCount"
    ],
    JEFE_SECCION: [
        "textFromImage", "combinedData", "codeFromImage", "inventorySummary", "historySummary",
        "traceabilityReport", "metalCount"
    ],
    CARRETILLERO: ["textFromImage", "combinedData", "codeFromImage", "metalCount"]
};

const normalize = (value?: string | null) => (value || "").trim().toUpperCase();

const toMillis = (value?: string | null) => {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
};

const parseLocationPosition = (position: string) => {
    const parsed = Number.parseInt(String(position || '').replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(parsed) ? null : parsed;
};

const getAddedLocationItems = (beforeData: any, afterData: any) => {
    const beforeItems = Array.isArray(beforeData?.items) ? beforeData.items : [];
    const afterItems = Array.isArray(afterData?.items) ? afterData.items : [];
    const beforeKeys = new Set(beforeItems.map((item: any) => `${normalize(item?.articleCode)}__${normalize(item?.orderFab)}__${normalize(item?.locatedAt)}`));
    return afterItems.filter((item: any) => !beforeKeys.has(`${normalize(item?.articleCode)}__${normalize(item?.orderFab)}__${normalize(item?.locatedAt)}`));
};

const notifyUsersByEmails = async (emails: string[], payload: { title: string; body: string; data?: Record<string, string>; }) => {
    const users = await getUsersByEmails(emails);
    return sendPushToUsers(users, payload);
};

const isSameIdentity = (
    item: any,
    barcode: string,
    orderId?: string,
    itemKey?: string,
    containerId?: string
) => {
    const byKey = normalize(itemKey || item?.itemKey);
    if (byKey) return normalize(item?.itemKey) === byKey;
    const barcodeMatch = normalize(item?.barcode) === normalize(barcode);
    const orderMatch = !orderId || normalize(item?.orderId) === normalize(orderId);
    const containerMatch = !containerId || normalize(item?.containerId) === normalize(containerId);
    return barcodeMatch && orderMatch && containerMatch;
};

const sectionForWarehouse = (warehouseId: string) => {
    if (warehouseId === "MEC") return "MECANIZADO";
    if (warehouseId === "PLE") return "PLEGADORA";
    if (warehouseId === "RPL") return "ROBOT_PLEGADO";
    if (["SOL", "RSO", "SXP"].includes(warehouseId)) return "SOLDADURA";
    if (["REP", "PIN", "ZIN"].includes(warehouseId)) return "REPASADO";
    return "OTROS";
};

const canOperateWarehouse = (role: string, section: string | null, warehouseId: string) => {
    if (role === "ADMIN" || role === "CARRETILLERO") return true;
    if (role === "JEFE_SECCION") return !!section && section === sectionForWarehouse(warehouseId);
    return false;
};

const NON_TRUNCATED_FIELDS = new Set(['image', 'processedImage']);

const sanitizeInput = (input: any, parentKey?: string): any => {
    if (typeof input === 'string') {
        // Remove control characters. Only truncate free-text fields.
        const cleaned = input.replace(/[\x00-\x1F\x7F]/g, "");
        if (parentKey && NON_TRUNCATED_FIELDS.has(parentKey)) {
            return cleaned;
        }
        return cleaned.substring(0, 5000);
    }
    if (Array.isArray(input)) {
        return input.map(item => sanitizeInput(item, parentKey));
    }
    if (typeof input === 'object' && input !== null) {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[key] = sanitizeInput(value, key);
        }
        return sanitized;
    }
    return input;
};

export const generateGeminiResponse = functions.runWith({ secrets: [GEMINI_API_KEY] }).https.onCall(async (data: any, context: any) => {
    // 1. Authentication Check
    if (!context.auth) {
        return { success: false, error: "Usuario no autenticado." };
    }

    const uid = context.auth.uid;
    const now = Date.now();

    // 2. Rate Limiting (In-Memory per Instance)
    // Note: For production, consider using Firestore or Redis for distributed rate limiting.
    const userRequests = requestLog[uid] || [];
    const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);

    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
        return { success: false, error: "Límite de peticiones excedido. Intente de nuevo en un momento." };
    }

    recentRequests.push(now);
    requestLog[uid] = recentRequests;

    // Cleanup old entries periodically (simple approach)
    if (Math.random() < 0.1) {
        for (const user in requestLog) {
            requestLog[user] = requestLog[user].filter(t => now - t < RATE_LIMIT_WINDOW_MS);
            if (requestLog[user].length === 0) delete requestLog[user];
        }
    }

    try {
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const { type, payload: rawPayload } = data;
        const role = normalizeRole((context.auth.token.role as string) || "");
        const allowedTypes = ALLOWED_AI_TYPES_BY_ROLE[role] || [];
        if (!allowedTypes.includes(type)) {
            throw new functions.https.HttpsError("permission-denied", "AI operation not allowed for this role.");
        }

        // 3. Input Sanitization
        const payload = sanitizeInput(rawPayload);

        let prompt = "";
        let schema: any | undefined;
        let mimeType = "application/json";
        let imagePart = null;

        // Construct Request based on Type
        switch (type) {
            case 'textFromImage':
                // payload: { image: base64 }
                imagePart = { inlineData: { mimeType: 'image/jpeg', data: payload.image } };
                prompt = 'Extrae el texto y/o código alfanumérico visible en esta imagen. Devuelve SOLO el texto plano extraído, en Español.';
                mimeType = "text/plain";
                break;

            case 'combinedData':
                // payload: { image: base64 }
                imagePart = { inlineData: { mimeType: 'image/jpeg', data: payload.image } };
                prompt = `Extrae JSON {"article": "string", "orderId": "string"} de la etiqueta.
Article: Referencia principal (alfanumérica).
OrderId: Empieza por "OF", "Nº" o números largos.
Si falta alguno, intenta deducirlo o deja cadena vacía.`;
                schema = {
                    type: SchemaType.OBJECT,
                    properties: {
                        article: { type: SchemaType.STRING },
                        orderId: { type: SchemaType.STRING },
                    },
                    required: ["article", "orderId"],
                };
                break;

            case 'codeFromImage':
                // payload: { image: base64, context: 'article' | 'order' | 'location' }
                imagePart = { inlineData: { mimeType: 'image/jpeg', data: payload.image } };
                let instructions = "";
                if (payload.context === 'order') instructions = `BUSCA: ORDEN (OF). Empieza por "OF" o números.`;
                else if (payload.context === 'location') instructions = `BUSCA: UBICACIÓN o "ALMACEN". Si dice "ALMACEN", devuelve "ALMACEN". Si es código (Ej: "MEC 001"), devuélvelo.`;
                else instructions = `BUSCA: REFERENCIA ARTÍCULO.`;
                prompt = `${instructions} Devuelve SOLO el código. Si no, "NOT_FOUND".`;
                mimeType = "text/plain";
                break;

            case 'inventorySummary':
                // payload: { assignmentsSummary: string }
                prompt = `
                    Eres un experto logística. Resume en Markdown. TODA TU RESPUESTA DEBE ESTAR EN ESPAÑOL.
                    Datos (Items por almacén):
                    ${payload.assignmentsSummary}

                    Puntos clave:
                    - Conteo por almacén.
                    - Más lleno / Más vacío.
                    - Recomendación breve.
                `;
                mimeType = "text/plain";
                break;

            case 'historySummary':
                // payload: { historySummary: string }
                prompt = `
                    Analista de operaciones. Resume actividad reciente (50 items) en Markdown. RESPUESTA ESTRICTAMENTE EN ESPAÑOL.
                    Datos:
                    ${payload.historySummary}

                    Puntos:
                    - Conteo por tipo acción.
                    - Almacén más activo.
                    - Observación clave.
                `;
                mimeType = "text/plain";
                break;

            case 'traceabilityReport':
                // payload: { itemHistory: any[] }
                prompt = `
                    Auditor logística. Informe trazabilidad breve en Markdown. RESPONDE SIEMPRE EN ESPAÑOL.
                    Datos:
                    ${JSON.stringify(payload.itemHistory, null, 2)}

                    Puntos:
                    1. Resumen.
                    2. Patrones (redundancias, rotación).
                    3. Estadísticas.
                    4. Recomendación operativa.
                `;
                mimeType = "text/plain";
                break;

            case 'anomalyDetection':
                // payload: { duplicates, highDensity, history }
                prompt = `
                    Auditor Inventario IA. Detecta anomalías JSON. TODO EL TEXTO DEBE ESTAR EN ESPAÑOL.
                    Datos:
                    1. Duplicados: ${JSON.stringify(payload.duplicates)}
                    2. Densidad Alta: ${JSON.stringify(payload.highDensity)}
                    3. Historial: ${JSON.stringify(payload.history)}

                    Tarea: Reporte JSON estricto en Español.
                    Schema:
                     {
                      "summary": "string (markdown en español)",
                      "anomalies": [{ "type": "duplicate"|"overload"|"suspicious_movements"|"underused"|"other", "severity": "low"|"medium"|"high", "locationId": "string", "articleId": "string", "description": "string en español", "suggestions": "string en español" }],
                      "recommendations": "string (markdown en español)"
                    }
                `;
                schema = {
                    type: SchemaType.OBJECT,
                    properties: {
                        summary: { type: SchemaType.STRING },
                        anomalies: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    type: { type: SchemaType.STRING, enum: ["duplicate", "overload", "suspicious_movements", "underused", "other"] },
                                    severity: { type: SchemaType.STRING, enum: ["low", "medium", "high"] },
                                    locationId: { type: SchemaType.STRING },
                                    articleId: { type: SchemaType.STRING },
                                    description: { type: SchemaType.STRING },
                                    suggestions: { type: SchemaType.STRING },
                                },
                                required: ["type", "severity", "description"],
                            },
                        },
                        recommendations: { type: SchemaType.STRING },
                    },
                    required: ["summary", "anomalies"],
                };
                break;

            case 'locationPrediction':
                // payload: { articleId, currentLocations, history }
                prompt = `
                    Detective almacén. Busca "${payload.articleId}". RESPONDE EN ESPAÑOL.
                    Actual en sistema: ${payload.currentLocations}.
                    Historial: ${JSON.stringify(payload.history)}

                    Output JSON:
                    {
                        "summary": "markdown breve en español",
                        "predictions": [{ "locationId": "string", "probability": number, "reason": "explicación en español" }],
                        "notes": "string en español"
                    }
                `;
                schema = {
                    type: SchemaType.OBJECT,
                    properties: {
                        summary: { type: SchemaType.STRING },
                        predictions: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    locationId: { type: SchemaType.STRING },
                                    probability: { type: SchemaType.NUMBER },
                                    reason: { type: SchemaType.STRING },
                                },
                                required: ["locationId", "probability", "reason"],
                            },
                        },
                        notes: { type: SchemaType.STRING },
                    },
                    required: ["summary", "predictions"],
                };
                break;

            case 'metalCount':
                // payload: { image: base64, processedImage?: base64, material, thickness, cvEstimate?, calibrationHeightPx? }
                prompt = `
                    Actua como experto en vision artificial industrial para conteo de chapas.
                    Objetivo: estimar el numero de chapas con alta estabilidad y explicar por que.

                    Datos de entrada:
                    - Material: ${payload.material}
                    - Grosor nominal: ${payload.thickness} mm
                    - Calibracion altura en pixeles (si existe): ${payload.calibrationHeightPx || 'no disponible'}
                    - Pista CV clasico: ${payload.cvEstimate ? JSON.stringify(payload.cvEstimate) : 'sin pista CV'}

                    Vas a recibir 1 o 2 imagenes:
                    - Imagen original
                    - Imagen procesada (grayscale/contraste/enfoque) para reforzar bordes

                    Protocolo obligatorio:
                    1) Haz un conteo independiente A (sin mirar el resultado final) usando la imagen original.
                    2) Haz un conteo independiente B usando la imagen procesada priorizando bordes repetitivos.
                    3) Detecta y excluye separadores, sombras duras, suciedad, cortes y artefactos.
                    4) Evalua regularidad del patron de separaciones entre chapas (high|medium|low).
                    5) Compara A y B y decide estimacion final conservadora.
                    6) Si la pista CV tiene confianza alta y coincide +-1 con tu estimacion, recomienda fuente "hybrid" o "cv".

                    Reglas:
                    - No inventes precision si la imagen es mala.
                    - Si hay duda fuerte, confidence baja.
                    - theoreticalBlockHeightMm = estimatedCount * ${payload.thickness}.

                    Devuelve JSON estricto con este schema.
                `;
                schema = {
                    type: SchemaType.OBJECT,
                    properties: {
                        estimatedCount: { type: SchemaType.INTEGER },
                        theoreticalBlockHeightMm: { type: SchemaType.NUMBER },
                        confidence: { type: SchemaType.STRING, enum: ["high", "medium", "low"] },
                        reasoning: { type: SchemaType.STRING },
                        visualNotes: { type: SchemaType.STRING },
                        countPassA: { type: SchemaType.INTEGER },
                        countPassB: { type: SchemaType.INTEGER },
                        separatorsDetected: { type: SchemaType.INTEGER },
                        patternRegularity: { type: SchemaType.STRING, enum: ["high", "medium", "low"] },
                        recommendedSource: { type: SchemaType.STRING, enum: ["cv", "ai", "hybrid"] }
                    },
                    required: ["estimatedCount", "theoreticalBlockHeightMm", "confidence", "reasoning", "visualNotes", "countPassA", "countPassB", "separatorsDetected", "patternRegularity", "recommendedSource"],
                };
                break;

            default:
                throw new functions.https.HttpsError("invalid-argument", `Unknown request type: ${type}`);
        }

        // Execute Call
        const parts: any[] = [{ text: prompt }];
        if (type === 'metalCount') {
            parts.push({ text: 'Imagen 1: ORIGINAL' });
            parts.push({ inlineData: { mimeType: 'image/jpeg', data: payload.image } });
            if (payload.processedImage) {
                parts.push({ text: 'Imagen 2: PROCESADA (usar para reforzar conteo de bordes)' });
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: payload.processedImage } });
            }
        } else if (imagePart) {
            parts.push(imagePart);
        }

        const generationConfig: any = {
            temperature: 0.4,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: mimeType,
        };

        if (schema) {
            generationConfig.responseSchema = schema;
        }

        const result = await model.generateContent({
            contents: [{ role: "user", parts }],
            generationConfig
        });

        return {
            success: true,
            data: schema ? JSON.parse(result.response.text() || "{}") : result.response.text()
        };

    } catch (error: any) {
        console.error("Gemini API Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate AI response.");
    }
});

export const inventoryAssistant = functions.runWith({ secrets: [GEMINI_API_KEY] }).https.onCall(async (data: any, context: any) => {
    const user = await requireAllowedRoles(context, ['ADMIN', 'SUPERADMIN']);
    checkRateLimit(user.uid);

    const question = typeof data?.question === 'string' ? data.question.trim() : '';
    const inventoryContext = data?.context || {};
    if (!question) {
        throw new functions.https.HttpsError('invalid-argument', 'La pregunta es obligatoria.');
    }

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: INVENTORY_ASSISTANT_MODEL });

    const prompt = `
Eres un asistente logistico para un WMS de estanterias.
Responde SIEMPRE en espanol, en Markdown breve y profesional.

Reglas estrictas:
- Usa solo el contexto JSON recibido; no inventes datos.
- Si no tienes datos suficientes para asegurar una respuesta exacta, dilo claramente.
- Cuando detectes una misma pareja articulo + OF en varias ubicaciones, mencionarlo de forma explicita.
- Si preguntan por dias en ubicacion, usa la informacion de daysInLocation o el contexto equivalente.
- Prioriza exactitud antes que creatividad.

Usuario: ${user.email || user.uid}
Pregunta: ${question}

Contexto JSON del inventario:
${JSON.stringify(inventoryContext)}
`;

    const result = await model.generateContent(prompt);
    return {
        answer: result.response.text(),
        model: INVENTORY_ASSISTANT_MODEL,
    };
});

export const leadTimeReporting = functions.https.onCall(async (_data: any, context: any) => {
    await requireAllowedRoles(context, ['ADMIN', 'SUPERADMIN']);

    const historySnapshot = await admin.firestore().collection('history').orderBy('timestamp', 'asc').limit(5000).get();
    const openCycles = new Map<string, { startedAt: number; shelfCode: string }>();
    const bySection = new Map<string, { totalDays: number; count: number }>();
    const byShelf = new Map<string, { totalDays: number; count: number }>();

    historySnapshot.docs.forEach((doc: any) => {
        const entry = doc.data() || {};
        const action = normalize(entry.action);
        const articleCode = normalize(entry.articleCode);
        const orderFab = normalize(entry.orderFab);
        const timestamp = toMillis(entry.timestamp);
        if (!articleCode || !orderFab || !timestamp) return;

        const key = `${articleCode}__${orderFab}`;
        if (action === 'UBICAR') {
            openCycles.set(key, {
                startedAt: timestamp,
                shelfCode: normalize(entry.shelfCode),
            });
            return;
        }

        if (action !== 'RETIRAR') {
            return;
        }

        const opened = openCycles.get(key);
        if (!opened || timestamp <= opened.startedAt) {
            return;
        }

        const diffDays = (timestamp - opened.startedAt) / (1000 * 60 * 60 * 24);
        const shelfCode = opened.shelfCode || normalize(entry.shelfCode);
        const section = getWmsSectionForShelf(shelfCode);

        const sectionStats = bySection.get(section) || { totalDays: 0, count: 0 };
        sectionStats.totalDays += diffDays;
        sectionStats.count += 1;
        bySection.set(section, sectionStats);

        const shelfStats = byShelf.get(shelfCode) || { totalDays: 0, count: 0 };
        shelfStats.totalDays += diffDays;
        shelfStats.count += 1;
        byShelf.set(shelfCode, shelfStats);

        openCycles.delete(key);
    });

    const sectionRows = Array.from(bySection.entries())
        .map(([section, stats]) => ({
            section,
            completedCycles: stats.count,
            averageLeadTimeDays: Number((stats.totalDays / stats.count).toFixed(2)),
        }))
        .sort((a, b) => b.averageLeadTimeDays - a.averageLeadTimeDays);

    const shelfRows = Array.from(byShelf.entries())
        .map(([shelfCode, stats]) => ({
            shelfCode,
            completedCycles: stats.count,
            averageLeadTimeDays: Number((stats.totalDays / stats.count).toFixed(2)),
        }))
        .sort((a, b) => b.averageLeadTimeDays - a.averageLeadTimeDays);

    const completedCycles = sectionRows.reduce((sum, row) => sum + row.completedCycles, 0);
    const totalLeadTimeDays = Array.from(bySection.values()).reduce((sum, stats) => sum + stats.totalDays, 0);

    return {
        generatedAt: new Date().toISOString(),
        totals: {
            completedCycles,
            averageLeadTimeDays: completedCycles > 0 ? Number((totalLeadTimeDays / completedCycles).toFixed(2)) : null,
        },
        bySection: sectionRows,
        byShelf: shelfRows,
    };
});

export const checkStaleItems = functions.pubsub.schedule('every 24 hours').timeZone('Europe/Madrid').onRun(async () => {
    const itemsSnapshot = await admin.firestore().collection('items').where('active', '==', true).get();
    const configSnapshot = await admin.firestore().collection('config').doc('app').get();
    const config = configSnapshot.exists ? configSnapshot.data() || {} : {};
    const chiefMapping = config.chiefMapping || {};

    const now = Date.now();
    const staleLimitMs = STALE_ITEM_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    const alertIntervalMs = STALE_ITEM_ALERT_INTERVAL_HOURS * 60 * 60 * 1000;
    let notifiedItems = 0;

    for (const itemDoc of itemsSnapshot.docs) {
        const item = itemDoc.data() || {};
        const locatedAtMs = toMillis(item.locatedAt);
        if (!locatedAtMs || now - locatedAtMs < staleLimitMs) {
            continue;
        }

        const lastAlertAtMs = toMillis(item.lastAlertAt);
        if (lastAlertAtMs && now - lastAlertAtMs < alertIntervalMs) {
            continue;
        }

        const shelfCode = normalize(item.shelfCode);
        const section = getWmsSectionForShelf(shelfCode);
        const emails = Array.isArray(chiefMapping[section]) ? chiefMapping[section] : [];
        const userDocs = await getUsersByEmails(emails);

        const notificationResult = await sendPushToUsers(userDocs, {
            title: 'Articulo estancado en estanteria',
            body: `${item.articleCode || 'Articulo'} ${item.orderFab || ''} lleva ${Math.floor((now - locatedAtMs) / (1000 * 60 * 60 * 24))} dias en ${Array.isArray(item.locationIds) ? item.locationIds.join(', ') : shelfCode}`.trim(),
            data: {
                type: 'STALE_ITEM_ALERT',
                shelfCode,
                articleCode: String(item.articleCode || ''),
                orderFab: String(item.orderFab || ''),
            },
        });

        if (notificationResult.successCount > 0 || userDocs.length === 0) {
            await itemDoc.ref.update({
                lastAlertAt: new Date(now).toISOString(),
            });
            notifiedItems += 1;
        }
    }

    return { notifiedItems };
});

export const notifyPickupQueueCreated = functions.firestore
    .document('pickupQueue/{requestId}')
    .onCreate(async (snapshot: any, context: any) => {
        const data = snapshot.data() || {};
        const shelfSection = String(data.shelfSection || 'OTROS');
        const shelfName = String(data.shelfName || data.shelfCode || 'estanteria');
        const operarioId = String(data.operarioId || '---');

        await notifyUsersByRole('CARRETILLERO', {
            title: 'Nueva solicitud de recogida',
            body: `Operario ${operarioId} solicita recogida en ${shelfSection} (${shelfName}).`,
            data: {
                type: 'PICKUP_QUEUE_CREATED',
                requestId: String(context.params.requestId || ''),
                shelfCode: String(data.shelfCode || ''),
                shelfSection,
            },
        });

        return null;
    });

export const notifySpecialLocationOccupancy = functions.firestore
    .document('shelves/{shelfCode}/locations/{position}')
    .onWrite(async (change: any, context: any) => {
        if (!change.after.exists) {
            return null;
        }

        const shelfCode = normalize(context.params.shelfCode);
        const position = parseLocationPosition(context.params.position);
        if (!position) {
            return null;
        }

        const config = await getAppConfig();
        const urgentLocations = Array.isArray(config.urgentLocations) ? config.urgentLocations : [];
        const techReviewLocations = Array.isArray(config.techReviewLocations) ? config.techReviewLocations : [];
        const locationId = `${shelfCode}-${String(context.params.position).padStart(3, '0')}`;
        const isUrgent = urgentLocations.includes(locationId);
        const isTechReview = techReviewLocations.includes(locationId);

        if (!isUrgent && !isTechReview) {
            return null;
        }

        const addedItems = getAddedLocationItems(change.before.data(), change.after.data());
        if (addedItems.length === 0) {
            return null;
        }

        const chiefMapping = config.chiefMapping || {};
        const qualityEmails = Array.isArray(config.qualityEmails) ? config.qualityEmails : [];
        const section = getWmsSectionForShelf(shelfCode);
        const firstItem = addedItems[0] || {};
        const articleCode = String(firstItem.articleCode || 'Articulo');
        const orderFab = String(firstItem.orderFab || '');

        if (isTechReview) {
            await notifyUsersByEmails(qualityEmails, {
                title: 'Articulo pendiente de revision tecnica',
                body: `${articleCode} ${orderFab} ha sido ubicado en ${locationId}.`.trim(),
                data: {
                    type: 'TECH_REVIEW_LOCATION',
                    shelfCode,
                    locationId,
                    articleCode,
                    orderFab,
                },
            });
        }

        if (isUrgent) {
            const chiefEmails = Array.isArray(chiefMapping[section]) ? chiefMapping[section] : [];
            await Promise.all([
                notifyUsersByEmails(chiefEmails, {
                    title: 'Articulo urgente ubicado',
                    body: `${articleCode} ${orderFab} ha sido ubicado en ${locationId}.`.trim(),
                    data: {
                        type: 'URGENT_LOCATION',
                        shelfCode,
                        locationId,
                        articleCode,
                        orderFab,
                    },
                }),
                notifyUsersByEmails(qualityEmails, {
                    title: 'Articulo urgente ubicado',
                    body: `${articleCode} ${orderFab} ha sido ubicado en ${locationId}.`.trim(),
                    data: {
                        type: 'URGENT_LOCATION_QUALITY',
                        shelfCode,
                        locationId,
                        articleCode,
                        orderFab,
                    },
                }),
            ]);
        }

        return null;
    });

export const notifyCarretilleroRequest = functions.firestore
    .document("notifications/{notificationId}")
    .onCreate(async (snapshot: any, context: any) => {
        const data = snapshot.data();
        if (!data) return;

        // Filter logic: Only for CARRETILLERO target role
        // Assuming 'targetRole' field exists based on diagnosis
        if (data.targetRole !== "CARRETILLERO") {
            console.log("Skipping notification: targetRole is not CARRETILLERO", data.targetRole);
            return;
        }

        // Get all users with role CARRETILLERO
        // Note: If 'role' is not a top-level field indexed, this query might need an index.
        // If roles are managed differently (e.g. static roles), we might need to change this.
        // Based on hooks/useRoles.ts, roles seem to be in 'role' or 'user' field of 'users' collection.
        // We will try querying 'role' == 'CARRETILLERO'. If empty, we might need to query 'user' == 'CARRETILLERO'.
        // Or we can manually list IDs if the query fails (fallback).

        // Attempt 1: Query by role
        let usersQuery = await admin.firestore().collection("users").where("role", "==", "CARRETILLERO").get();

        // Fallback: Query by 'user' field (legacy mapping support)
        if (usersQuery.empty) {
            console.log("No users found with role=CARRETILLERO, checking user=CARRETILLERO (legacy)");
            usersQuery = await admin.firestore().collection("users").where("user", "==", "CARRETILLERO").get();
        }

        if (usersQuery.empty) {
            console.log("No Carretilleros found to notify.");
            return;
        }

        const tokens: string[] = [];
        const uidTokenMap: Record<string, string> = {}; // Token -> UID mapping for cleanup

        usersQuery.forEach((doc: any) => {
            const userData = doc.data();
            if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                userData.fcmTokens.forEach((token: string) => {
                    tokens.push(token);
                    uidTokenMap[token] = doc.id;
                });
            }
        });

        if (tokens.length === 0) {
            console.log("Found Carretilleros but no FCM tokens registered.");
            return;
        }

        // Payload
        const payload: admin.messaging.MulticastMessage = {
            tokens: tokens,
            notification: {
                title: "Nueva Solicitud - " + (data.title || "Material"),
                body: data.message || "Tienes una nueva solicitud pendiente.",
            },
            data: {
                url: "/requests",
                requestId: context.params.notificationId,
                priority: data.metadata?.priority || "normal"
            },
            android: {
                priority: "high",
                notification: {
                    clickAction: "FLUTTER_NOTIFICATION_CLICK", // Standard for some libs, or just rely on data url in SW
                }
            },
            webpush: {
                headers: {
                    Urgency: "high"
                },
                fcmOptions: {
                    link: "/requests"
                }
            }
        };

        try {
            const response = await admin.messaging().sendEachForMulticast(payload);
            console.log(`Successfully sent message: ${response.successCount} success, ${response.failureCount} failure`);

            if (response.failureCount > 0) {
                const cleanupPromises: Promise<any>[] = [];

                response.responses.forEach((resp: admin.messaging.SendResponse, idx: number) => {
                    if (!resp.success && resp.error) {
                        const errorState = resp.error.code;
                        const badToken = tokens[idx];
                        const uid = uidTokenMap[badToken];

                        if (errorState === "messaging/registration-token-not-registered" ||
                            errorState === "messaging/invalid-argument") {

                            console.log(`Cleaning up invalid token for user ${uid}: ${badToken}`);
                            cleanupPromises.push(
                                admin.firestore().collection("users").doc(uid).update({
                                    fcmTokens: admin.firestore.FieldValue.arrayRemove(badToken)
                                })
                            );
                        }
                    }
                });

                await Promise.all(cleanupPromises);
            }
        } catch (error) {
            console.error("Error sending multicast notification:", error);
        }
    });

// ============================================================================
// 📦 LEAD TIME & INBOUND TRACKING
// ============================================================================

/**
 * Trigger: Updates 'inboundOrders' when an item is assigned (put-away).
 * Sets 'fecha_disponible_estanteria' to the current timestamp.
 * Logic: "Last write wins" - the time of the *latest* item shelved becomes the order's available time.
 */
export const onAssignmentWrite = functions.firestore
    .document("assignments/{warehouseId}/locations/{locationId}")
    .onWrite(async (change: any, context: any) => {
        const afterData = change.after.exists ? change.after.data() : null;
        const beforeData = change.before.exists ? change.before.data() : null;

        // If doc deleted or no items, ignore (or handle removal logic if strictly needed, but for "Available" time we care about Adds)
        if (!afterData || !afterData.items || !Array.isArray(afterData.items)) return;

        const afterItems: any[] = afterData.items;
        const beforeItems: any[] = beforeData && beforeData.items && Array.isArray(beforeData.items) ? beforeData.items : [];

        // Identify NEW items (added in this write)
        // We use barcode + orderId as unique key for this check
        const beforeKeys = new Set(beforeItems.map(i => `${i.barcode}_${i.orderId}`));
        const newItems = afterItems.filter(i => !beforeKeys.has(`${i.barcode}_${i.orderId}`));

        if (newItems.length === 0) return;

        // Group by OrderID to minimize writes
        const ordersToUpdate = new Set<string>();
        newItems.forEach(item => {
            if (item.orderId && item.orderId !== "PENDIENTE") {
                ordersToUpdate.add(item.orderId);
            }
        });

        if (ordersToUpdate.size === 0) return;

        // Execute updates
        await Promise.all(Array.from(ordersToUpdate).map(async (orderId) => {
            try {
                const docRef = admin.firestore().collection("inboundOrders").doc(orderId);
                // Check existence first to avoid "Document not found" errors polluting logs
                const doc = await docRef.get();
                if (doc.exists) {
                    await docRef.update({
                        fecha_disponible_estanteria: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        status: 'DISPONIBLE'
                    });
                    console.log(`Updated InboundOrder ${orderId} availability.`);
                }
            } catch (e) {
                console.error(`Failed to update InboundOrder ${orderId}:`, e);
            }
        }));
    });


/**
 * Callable: Get Lead Time Dataset (Generic Inventory Cycle Time)
 * Returns items that LEFT the warehouse in the given period, showing how long they were inside.
 */
export const leadTimeDataset = functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');

    // Check Admin Claim
    const role = normalizeRole(context.auth.token.role as string);
    if (role !== 'ADMIN' && role !== 'JEFE_SECCION' && role !== 'SUPERADMIN') {
        throw new functions.https.HttpsError('permission-denied', 'Only Admins/Jefes can access reports.');
    }

    const { dateFrom, dateTo } = data;
    if (!dateFrom || !dateTo) throw new functions.https.HttpsError('invalid-argument', 'Missing date range.');

    // 1. Find all "EXIT" events in the date range
    // Exits = 'removed' OR 'process_finished'
    // We cannot use 'IN' query easily with date range on a different field efficiently without specific index.
    // Simpler: Query by timestamp range, then filter in memory for actions.
    const historyRef = admin.firestore().collection("history");
    const snapshot = await historyRef
        .where("timestamp", ">=", dateFrom)
        .where("timestamp", "<=", dateTo)
        .orderBy("timestamp", "desc")
        .get();

    const exitEvents: any[] = [];
    snapshot.forEach((doc: any) => {
        const d = doc.data();
        if (d.action === 'removed' || d.action === 'process_finished') {
            exitEvents.push(d);
        }
    });

    // 2. For each exit, find the corresponding ENTRY (assigned)
    // This is N queries. "Aunque tarde más" (User accepted latency).
    // Optimization: We could batch, but standard N queries is safest logic-wise for now.

    const rows = [];

    // Limit to prevent timeout on huge datasets (e.g. 500 items)
    const MAX_ITEMS = 500;
    const itemsToProcess = exitEvents.slice(0, MAX_ITEMS);

    for (const exitEvent of itemsToProcess) {
        // Find latest 'assigned' event for this barcode BEFORE the exit time
        // Using existing index: barcode ASC, timestamp DESC
        // We fetch a few recent events to find the 'assigned' one, avoiding new index requirement for 'action'
        const historySnap = await historyRef
            .where("barcode", "==", exitEvent.barcode)
            .where("timestamp", "<", exitEvent.timestamp)
            .orderBy("timestamp", "desc")
            .limit(100) // Deep search for entry event
            .get();

        const entryDoc = historySnap.docs.find((d: any) => d.data().action === 'assigned');

        if (entryDoc) {
            const entryEvent = entryDoc.data();

            const exitTime = new Date(exitEvent.timestamp).getTime();
            const entryTime = new Date(entryEvent.timestamp).getTime();
            const diffMs = exitTime - entryTime;
            const diffDays = diffMs / (1000 * 60 * 60 * 24);

            rows.push({
                barcode: exitEvent.barcode,
                orderId: exitEvent.orderId || 'N/A',
                entryDate: entryEvent.timestamp,
                exitDate: exitEvent.timestamp,
                durationDays: diffDays
            });
        }
    }

    return { rows };
});

/**
 * Callable: Generate AI Report for Lead Time (Inventory Cycle)
 */
export const leadTimeAIReport = functions.runWith({ secrets: [GEMINI_API_KEY] }).https.onCall(async (data: any, context: any) => {
    // 1. Auth Check
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const aiRole = normalizeRole(context.auth.token.role as string);
    if (aiRole !== 'ADMIN' && aiRole !== 'SUPERADMIN') throw new functions.https.HttpsError('permission-denied', 'Only Admins can access AI analysis.');

    const genAI = getGeminiClient();

    // Rate Limit
    checkRateLimit(context.auth.uid);

    const { rows, summaryStats } = data; // rows are InventoryCycleMetric[]

    const prompt = `
        ACTÚA COMO UN CONSULTOR EXPERTO EN LOGÍSTICA DE ALMACENES (WMS).
        Analiza los datos de "Tiempo de Permanencia" (Inventory Cycle Time) de los artículos.
        
        CONTEXTO:
        - "Tiempo de Permanencia" = Días que pasa un artículo desde que se ubica hasta que se consume/sale.
        - Objetivo: Reducir el stock inmovilizado y detectar artículos obsoletos.

        ESTADÍSTICAS GENERALES:
        ${JSON.stringify(summaryStats)}

        TOP ARTÍCULOS CON MAYOR PERMANENCIA (Muestra de Cuellos de Botella):
        ${JSON.stringify(rows ? rows.slice(0, 15) : [])}

        GENERA UN INFORME EN MARKDOWN (sin HTML):
        1. **Diagnóstico de Rotación**:
           - ¿Es saludable el promedio de ${summaryStats.avgDaysInWarehouse} días?
           - ¿Hay mucho stock estancado (>30 días)?
        
        2. **Identificación de Riesgos**:
           - Analiza los artículos específicos listados arriba que tienen tiempos altos.
           - ¿Hay patrones? (Mismo tipo de artículo, etc si se puede deducir).

        3. **Recomendaciones Operativas**:
           - Acciones concretas para mover el stock antiguo.
           - Sugerencias sobre políticas de aprovisionamiento si el stock es muy alto.

        Usa negritas y listas. Sé directo y profesional.
    `;

    try {
        const result = await genAI.getGenerativeModel({ model: MODEL_NAME }).generateContent(prompt);
        return { markdown: result.response.text() };
    } catch (error: any) {
        console.error("AI Report Error:", error);
        throw new functions.https.HttpsError("internal", "AI Generation Failed");
    }
});

export const inventoryOperate = functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "auth required");

    const uid = context.auth.uid;
    const role = normalizeRole((context.auth.token.role as string) || "");
    const section = (context.auth.token.section as string) || null;
    const user = (context.auth.token.email as string) || "unknown";
    const op = data?.op as string;
    const payload = data?.payload || {};
    const opId = (data?.opId as string) || admin.firestore().collection("_ops").doc().id;
    const now = new Date().toISOString();

    if (!["ADMIN", "SUPERADMIN", "JEFE_SECCION", "CARRETILLERO"].includes(role)) {
        throw new functions.https.HttpsError("permission-denied", "Invalid role");
    }

    const writeHistory = (tx: any, entry: any) => {
        const historyRef = admin.firestore().collection("history").doc();
        tx.set(historyRef, {
            ...entry,
            id: historyRef.id,
            timestamp: now,
            uid,
            role,
            user,
            opId,
            source: "inventoryOperate"
        });
    };

    if (op === "emptyShelf") {
        if (role !== "ADMIN" && role !== 'SUPERADMIN') {
            throw new functions.https.HttpsError("permission-denied", "Only admin can empty shelves");
        }
        const warehouse = payload?.warehouse as string;
        const shelf = payload?.shelf as string;
        if (!warehouse || !shelf) throw new functions.https.HttpsError("invalid-argument", "Missing warehouse/shelf");

        const prefix = `${warehouse}-E${shelf}-`;
        const snapshot = await admin.firestore().collection("assignments").doc(warehouse).collection("locations").get();
        const docs = snapshot.docs.filter((d: any) => d.id.startsWith(prefix));

        await admin.firestore().runTransaction(async (tx: any) => {
            for (const doc of docs) {
                const items = (doc.data()?.items || []) as any[];
                tx.delete(doc.ref);
                items.forEach((item: any) => {
                    writeHistory(tx, {
                        barcode: item.barcode || "",
                        orderId: item.orderId || "",
                        action: "removed",
                        fromLocation: doc.id,
                        toLocation: null
                    });
                });
            }
        });

        return { ok: true, opId, removedLocations: docs.length };
    }

    const barcode = (payload?.barcode as string) || "";
    const orderId = (payload?.orderId as string) || "";

    if (op === "assign") {
        const locationId = payload?.locationId as string;
        if (!locationId || !barcode || !orderId) throw new functions.https.HttpsError("invalid-argument", "Missing assign payload");
        const warehouseId = locationId.split("-")[0];
        if (!canOperateWarehouse(role, section, warehouseId)) {
            throw new functions.https.HttpsError("permission-denied", "Warehouse out of scope");
        }

        const locRef = admin.firestore().collection("assignments").doc(warehouseId).collection("locations").doc(locationId);
        await admin.firestore().runTransaction(async (tx: any) => {
            const doc = await tx.get(locRef);
            const items = (doc.data()?.items || []) as any[];
            const exists = items.some((i) => isSameIdentity(i, barcode, orderId, payload?.itemKey, payload?.containerId));
            if (!exists) {
                const newItem = {
                    barcode,
                    orderId,
                    timestamp: now,
                    assignedAt: now,
                    movedAt: null,
                    packageType: payload?.packageType || null,
                    itemKey: payload?.itemKey || null,
                    quantity: payload?.quantity ?? 1,
                    containerId: payload?.containerId || null,
                    notes: payload?.notes || null,
                    status: "UBICADO"
                };
                tx.set(locRef, { items: [...items, newItem], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                writeHistory(tx, {
                    barcode,
                    orderId,
                    action: "assigned",
                    fromLocation: null,
                    toLocation: locationId
                });
            }
        });
        return { ok: true, opId };
    }

    if (op === "remove") {
        const locationId = payload?.locationId as string;
        if (!locationId || !barcode) throw new functions.https.HttpsError("invalid-argument", "Missing remove payload");
        const warehouseId = locationId.split("-")[0];
        if (!canOperateWarehouse(role, section, warehouseId)) {
            throw new functions.https.HttpsError("permission-denied", "Warehouse out of scope");
        }

        const locRef = admin.firestore().collection("assignments").doc(warehouseId).collection("locations").doc(locationId);
        await admin.firestore().runTransaction(async (tx: any) => {
            const doc = await tx.get(locRef);
            if (!doc.exists) throw new functions.https.HttpsError("not-found", "LOCATION_NOT_FOUND");
            const items = (doc.data()?.items || []) as any[];
            const idx = items.findIndex((i) => isSameIdentity(i, barcode, orderId, payload?.itemKey, payload?.containerId));
            if (idx < 0) throw new functions.https.HttpsError("not-found", "ITEM_NOT_FOUND");
            const item = items[idx];
            const next = [...items];
            next.splice(idx, 1);
            if (next.length === 0) tx.delete(locRef);
            else tx.set(locRef, { items: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

            writeHistory(tx, {
                barcode,
                orderId: orderId || item?.orderId || "",
                action: "removed",
                fromLocation: locationId,
                toLocation: null
            });
        });
        return { ok: true, opId };
    }

    if (op === "move") {
        const fromLoc = payload?.fromLoc as string;
        const toLoc = payload?.toLoc as string;
        if (!fromLoc || !toLoc || !barcode || !orderId) throw new functions.https.HttpsError("invalid-argument", "Missing move payload");
        const fromWh = fromLoc.split("-")[0];
        const toWh = toLoc.split("-")[0];
        if (!canOperateWarehouse(role, section, fromWh) || !canOperateWarehouse(role, section, toWh)) {
            throw new functions.https.HttpsError("permission-denied", "Warehouse out of scope");
        }

        const fromRef = admin.firestore().collection("assignments").doc(fromWh).collection("locations").doc(fromLoc);
        const toRef = admin.firestore().collection("assignments").doc(toWh).collection("locations").doc(toLoc);

        await admin.firestore().runTransaction(async (tx: any) => {
            const [fromDoc, toDoc] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
            if (!fromDoc.exists) throw new functions.https.HttpsError("not-found", "SOURCE_NOT_FOUND");
            const fromItems = (fromDoc.data()?.items || []) as any[];
            const idx = fromItems.findIndex((i) => isSameIdentity(i, barcode, orderId, payload?.itemKey, payload?.containerId));
            if (idx < 0) throw new functions.https.HttpsError("not-found", "ITEM_NOT_FOUND");

            const item = fromItems[idx];
            const nextSource = [...fromItems];
            nextSource.splice(idx, 1);
            if (nextSource.length === 0) tx.delete(fromRef);
            else tx.set(fromRef, { items: nextSource, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

            const toItems = (toDoc.data()?.items || []) as any[];
            const existsInTarget = toItems.some((i) => isSameIdentity(i, barcode, orderId, item?.itemKey, item?.containerId));
            if (!existsInTarget) {
                tx.set(toRef, {
                    items: [...toItems, { ...item, timestamp: now, movedAt: now }],
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            writeHistory(tx, {
                barcode,
                orderId,
                action: "relocated",
                fromLocation: fromLoc,
                toLocation: toLoc
            });
        });
        return { ok: true, opId };
    }

    throw new functions.https.HttpsError("invalid-argument", `Unknown op: ${op}`);
});
