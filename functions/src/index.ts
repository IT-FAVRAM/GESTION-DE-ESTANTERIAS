import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

admin.initializeApp();

// Configuration
// Ensure you set this via: firebase functions:config:set gemini.key="YOUR_KEY"
// Or use process.env if you prefer .env files
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || functions.config().gemini?.key;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const MODEL_NAME = 'gemini-2.0-flash'; // Optimized model

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

const sanitizeInput = (input: any): any => {
    if (typeof input === 'string') {
        // Remove control characters and limit length
        return input.replace(/[\x00-\x1F\x7F]/g, "").substring(0, 5000);
    }
    if (Array.isArray(input)) {
        return input.map(item => sanitizeInput(item));
    }
    if (typeof input === 'object' && input !== null) {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[key] = sanitizeInput(value);
        }
        return sanitized;
    }
    return input;
};

export const generateGeminiResponse = functions.https.onCall(async (data, context) => {
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
        if (!genAI) {
            throw new Error("Gemini API Key not configured.");
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const { type, payload: rawPayload } = data;

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
                prompt = 'Extrae código alfanumérico. Solo el texto.';
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
                    Eres experto logística. Resume en Markdown.
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
                    Analista operaciones. Resume actividad reciente (50 items) en Markdown.
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
                    Auditor logística. Informe trazabilidad breve en Markdown.
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
                    Auditor Inventario IA. Detecta anomalías JSON.
                    Datos:
                    1. Duplicados: ${JSON.stringify(payload.duplicates)}
                    2. Densidad Alta: ${JSON.stringify(payload.highDensity)}
                    3. Historial: ${JSON.stringify(payload.history)}

                    Tarea: Reporte JSON estricto.
                    Schema:
                     {
                      "summary": "string (markdown)",
                      "anomalies": [{ "type": "duplicate"|"overload"|"suspicious_movements"|"underused"|"other", "severity": "low"|"medium"|"high", "locationId": "string", "articleId": "string", "description": "string", "suggestions": "string" }],
                      "recommendations": "string (markdown)"
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
                    Detective almacén. Busca "${payload.articleId}".
                    Actual en sistema: ${payload.currentLocations}.
                    Historial: ${JSON.stringify(payload.history)}

                    Output JSON:
                    {
                        "summary": "markdown breve",
                        "predictions": [{ "locationId": "string", "probability": number, "reason": "string" }],
                        "notes": "string"
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
                // payload: { image: base64, material, thickness }
                imagePart = { inlineData: { mimeType: 'image/jpeg', data: payload.image } };
                prompt = `
                    ACTÚA COMO UN EXPERTO EN VISIÓN ARTIFICIAL Y METALURGIA.
                    TU OBJETIVO: Contar con EXACTITUD CIENTÍFICA el número de chapas metálicas en una pila, basándote en su perfil lateral.

                    DATOS DE ENTRADA:
                    - Material: ${payload.material}
                    - Grosor nominal de cada chapa: ${payload.thickness} mm
                    
                    PROTOCOLO DE ANÁLISIS VISUAL AVANZADO:
                    1. **Escaneo de Patrones**: Identifica el patrón repetitivo de "Luz-Sombra-Luz" que forman los bordes de las chapas.
                    2. **Discriminación de Artefactos**:
                       - IGNORA sombras proyectadas por la iluminación ambiental.
                       - IGNORA marcas de óxido superficial o manchas de aceite.
                       - IGNORA líneas de corte de sierra si no coinciden con la separación física.
                       - IGNORA separadores de madera o plásticos entre lotes.
                    3. **Validación de Espesor**:
                       - Estima visualmente cuántos píxeles ocupa UNA sola chapa.
                       - Si detectas una línea mucho más delgada que el promedio, probablemente sea una marca superficial.
                       - Si detectas un espacio mucho más grueso, puede ser un hueco.
                    4. **Cálculo de Densidad**:
                       - Observa la altura total del bloque en la imagen.
                       - Divide mentalmente el bloque en segmentos para verificar consistencia.

                    VERIFICACIÓN LÓGICA (SANITY CHECK):
                    - Si cuentas N chapas, la altura física teórica será N * ${payload.thickness}.
                    - ¿Es esa altura coherente con la perspectiva de la imagen?
                    - SÉ CONSERVADOR. Ante la duda, si una línea no es un borde claro, NO la cuentes.

                    SALIDA REQUERIDA (JSON ESTRICTO):
                    {
                        "estimatedCount": (Entero),
                        "theoreticalBlockHeightMm": (Número),
                        "confidence": "high" | "medium" | "low",
                        "reasoning": "Explica tu proceso...",
                        "visualNotes": "Comentario sobre la coherencia altura/cantidad."
                    }
                `;
                schema = {
                    type: SchemaType.OBJECT,
                    properties: {
                        estimatedCount: { type: SchemaType.INTEGER },
                        theoreticalBlockHeightMm: { type: SchemaType.NUMBER },
                        confidence: { type: SchemaType.STRING, enum: ["high", "medium", "low"] },
                        reasoning: { type: SchemaType.STRING },
                        visualNotes: { type: SchemaType.STRING }
                    },
                    required: ["estimatedCount", "theoreticalBlockHeightMm", "confidence", "reasoning", "visualNotes"],
                };
                break;

            default:
                throw new functions.https.HttpsError("invalid-argument", `Unknown request type: ${type}`);
        }

        // Execute Call
        const parts: any[] = [{ text: prompt }];
        if (imagePart) parts.push(imagePart); // imagePart usually goes with text in parts

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

export const notifyCarretilleroRequest = functions.firestore
    .document("notifications/{notificationId}")
    .onCreate(async (snapshot, context) => {
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

        usersQuery.forEach(doc => {
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
                url: "/?view=requests",
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
                    link: "/?view=requests"
                }
            }
        };

        try {
            const response = await admin.messaging().sendMulticast(payload);
            console.log(`Successfully sent message: ${response.successCount} success, ${response.failureCount} failure`);

            if (response.failureCount > 0) {
                const cleanupPromises: Promise<any>[] = [];

                response.responses.forEach((resp, idx) => {
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
    .onWrite(async (change, context) => {
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
export const leadTimeDataset = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');

    // Check Admin Claim
    const role = context.auth.token.role;
    if (role !== 'ADMIN' && role !== 'JEFE') { // Allow JEFE too as per UI structure
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
    snapshot.forEach(doc => {
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

        const entryDoc = historySnap.docs.find(d => d.data().action === 'assigned');

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
export const leadTimeAIReport = functions.https.onCall(async (data, context) => {
    // 1. Auth Check
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    if (context.auth.token.role !== 'ADMIN') throw new functions.https.HttpsError('permission-denied', 'Only Admins can access AI analysis.');

    if (!genAI) throw new functions.https.HttpsError("failed-precondition", "AI not configured.");

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
