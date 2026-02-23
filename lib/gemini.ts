import { functions } from './firebase';
import { Assignments, HISTORY_LIMIT, HistoryEntry, WAREHOUSE_NAMES, LocationId } from './warehouseData';

// --- TYPES ---

export class GeminiError extends Error {
    constructor(public message: string, public type: 'PARSE' | 'NETWORK' | 'API' | 'UNKNOWN', public originalError?: any) {
        super(message);
        this.name = 'GeminiError';
    }
}

export interface AnomalyItem {
    type: 'duplicate' | 'overload' | 'suspicious_movements' | 'underused' | 'other';
    severity: 'low' | 'medium' | 'high';
    locationId?: string;
    articleId?: string;
    description: string;
    suggestions?: string;
}

export interface GeminiAnomalyReport {
    summary: string;
    anomalies: AnomalyItem[];
    recommendations?: string;
}

export interface GeminiLocationPredictionResult {
    summary: string;
    predictions: Array<{
        locationId: LocationId;
        probability: number; // 0-100
        reason: string;
    }>;
    notes?: string;
}

export interface CombinedItemData {
    article: string;
    orderId: string;
}

export interface MetalSheetCountResult {
    estimatedCount: number;
    theoreticalBlockHeightMm: number;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
    visualNotes: string;
    countPassA?: number;
    countPassB?: number;
    separatorsDetected?: number;
    patternRegularity?: 'high' | 'medium' | 'low';
    recommendedSource?: 'cv' | 'ai' | 'hybrid';
}

// --- CLOUD FUNCTION CALLER ---

const callGeminiFunction = async <T>(type: string, payload: any): Promise<T> => {
    try {
        const generateGeminiResponse = functions.httpsCallable('generateGeminiResponse');
        const result = await generateGeminiResponse({ type, payload });
        const data = result.data as any;

        if (!data.success) {
            throw new Error(data.error || "Unknown error from server");
        }
        return data.data as T;
    } catch (error: any) {
        console.error(`Gemini Cloud Function Error [${type}]:`, error);

        // Map Auth/Network errors
        if (error.code === 'unauthenticated') {
            throw new GeminiError("Usuario no autenticado.", 'API', error);
        }
        if (error.code === 'resource-exhausted') {
            throw new GeminiError("Límite de cuota excedido. Intente más tarde.", 'API', error);
        }
        if (error.code === 'failed-precondition') {
            throw new GeminiError("Gemini no está configurado en el servidor.", 'API', error);
        }
        if (error.code === 'permission-denied') {
            throw new GeminiError("Sin permisos para ejecutar este análisis de IA.", 'API', error);
        }

        throw new GeminiError(
            error.message || "Error al conectar con el servidor de IA.",
            'NETWORK',
            error
        );
    }
};

// --- HELPERS PROMPT (Client-side helpers just for formatting data to send) ---

const formatAssignmentsForPrompt = (assignments: Assignments) => {
    const summary: Record<string, number> = {};
    for (const locationId in assignments) {
        const warehouseCode = locationId.split('-')[0];
        const warehouseName = WAREHOUSE_NAMES[warehouseCode as keyof typeof WAREHOUSE_NAMES] || warehouseCode;
        if (!summary[warehouseName]) {
            summary[warehouseName] = 0;
        }
        summary[warehouseName] += assignments[locationId as keyof typeof assignments].length;
    }
    return JSON.stringify(summary, null, 2);
};

// --- EXPORTED FUNCTIONS ---

export const recognizeTextFromImage = async (base64Image: string): Promise<string> => {
    return callGeminiFunction<string>('textFromImage', { image: base64Image });
};

export const extractCombinedItemData = async (base64Image: string): Promise<CombinedItemData> => {
    return callGeminiFunction<CombinedItemData>('combinedData', { image: base64Image });
};

export const extractCodeFromImage = async (base64Image: string, context: 'article' | 'order' | 'location' = 'article'): Promise<string> => {
    return callGeminiFunction<string>('codeFromImage', { image: base64Image, context });
};

export const generateInventorySummary = async (assignments: Assignments): Promise<string> => {
    const assignmentsSummary = formatAssignmentsForPrompt(assignments);
    return callGeminiFunction<string>('inventorySummary', { assignmentsSummary });
};

export const generateHistorySummary = async (history: HistoryEntry[]): Promise<string> => {
    const recentHistory = history.slice(0, 50);
    if (recentHistory.length === 0) return "No hay actividad reciente.";

    // Simplificar datos para enviar menos payload
    const historySummary = JSON.stringify(recentHistory.map(h => ({
        action: h.action,
        warehouse: h.toLocation?.split('-')[0] || h.fromLocation?.split('-')[0]
    })));

    return callGeminiFunction<string>('historySummary', { historySummary });
};

export const generateTraceabilityReport = async (itemHistory: HistoryEntry[]): Promise<string> => {
    if (itemHistory.length === 0) return "No hay historial.";
    // Enviar solo 50 ultimos items para no saturar payload
    const analysisSet = itemHistory.slice(0, 50);
    return callGeminiFunction<string>('traceabilityReport', { itemHistory: analysisSet });
};

export const detectInventoryAnomalies = async (params: {
    assignments: Assignments;
    history: HistoryEntry[];
}): Promise<GeminiAnomalyReport> => {

    // Pre-process data on client to reduce payload size to Firestore function
    const barcodeToLocations: Record<string, string[]> = {};
    const locationDensity: Record<string, number> = {};

    Object.entries(params.assignments).forEach(([loc, items]) => {
        locationDensity[loc] = items.length;
        items.forEach(item => {
            if (!barcodeToLocations[item.barcode]) {
                barcodeToLocations[item.barcode] = [];
            }
            barcodeToLocations[item.barcode].push(loc);
        });
    });

    const duplicates = Object.entries(barcodeToLocations)
        .filter(([_, locs]) => locs.length > 1)
        .map(([barcode, locs]) => ({ barcode, locations: locs }))
        .slice(0, 20);

    const highDensity = Object.entries(locationDensity)
        .filter(([_, count]) => count >= 3)
        .map(([loc, count]) => ({ location: loc, count }))
        .slice(0, 20);

    const recentHistory = params.history.slice(0, 50).map(h => ({ // Reduced history size
        action: h.action,
        barcode: h.barcode,
        from: h.fromLocation,
        to: h.toLocation,
        time: h.timestamp
    }));

    return callGeminiFunction<GeminiAnomalyReport>('anomalyDetection', {
        duplicates,
        highDensity,
        history: recentHistory
    });
};

export const predictLikelyLocations = async (params: {
    articleId: string;
    assignments: Assignments;
    history: HistoryEntry[];
}): Promise<GeminiLocationPredictionResult> => {
    const { articleId, assignments, history } = params;

    const itemHistory = history
        .filter(h => h.barcode === articleId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20);

    const currentLocations = Object.entries(assignments)
        .filter(([_, items]) => items.some(i => i.barcode === articleId))
        .map(([loc]) => loc);

    return callGeminiFunction<GeminiLocationPredictionResult>('locationPrediction', {
        articleId,
        currentLocations: currentLocations.join(', '),
        history: itemHistory.map(h => ({ action: h.action, from: h.fromLocation, to: h.toLocation, date: h.timestamp }))
    });
};

export const countMetalSheets = async (params: {
    originalImage: string;
    processedImage?: string;
    material: string;
    thicknessMm: number;
    cvEstimate?: {
        count: number;
        confidence: 'high' | 'medium' | 'low';
        signalQuality: number;
        reasoning: string;
    };
    calibrationHeightPx?: number;
}): Promise<MetalSheetCountResult> => {
    return callGeminiFunction<MetalSheetCountResult>('metalCount', {
        image: params.originalImage,
        processedImage: params.processedImage,
        material: params.material,
        thickness: params.thicknessMm,
        cvEstimate: params.cvEstimate,
        calibrationHeightPx: params.calibrationHeightPx
    });
};
