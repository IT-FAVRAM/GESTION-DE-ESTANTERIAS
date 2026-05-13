
import { useState } from 'react';
import { Assignments, HistoryEntry } from '../lib/warehouseData';
import { 
    generateInventorySummary, 
    generateHistorySummary, 
    generateTraceabilityReport, 
    detectInventoryAnomalies, 
    predictLikelyLocations,
    GeminiAnomalyReport,
    GeminiLocationPredictionResult
} from '../lib/gemini';

interface GeminiModalState {
    isOpen: boolean;
    title: string;
    content: string;
    isLoading: boolean;
    isError: boolean;
    structuredReport?: GeminiAnomalyReport | null;
    predictionResult?: GeminiLocationPredictionResult | null;
}

export const useGeminiAnalysis = () => {
    const [modalState, setModalState] = useState<GeminiModalState>({
        isOpen: false,
        title: '',
        content: '',
        isLoading: false,
        isError: false,
        structuredReport: null,
        predictionResult: null,
    });

    const closeModal = () => {
        setModalState({ 
            isOpen: false, 
            title: '', 
            content: '', 
            isLoading: false, 
            isError: false, 
            structuredReport: null,
            predictionResult: null
        });
    };

    const runInventorySummary = async (assignments: Assignments) => {
        setModalState({ isOpen: true, title: 'Análisis de Inventario', content: '', isLoading: true, isError: false, structuredReport: null, predictionResult: null });
        try {
            const summary = await generateInventorySummary(assignments);
            setModalState(prev => ({ ...prev, content: summary, isLoading: false }));
        } catch (error) {
            setModalState(prev => ({ ...prev, content: (error as Error).message, isLoading: false, isError: true }));
        }
    };

    const runHistorySummary = async (history: HistoryEntry[]) => {
        setModalState({ isOpen: true, title: 'Resumen de Actividad', content: '', isLoading: true, isError: false, structuredReport: null, predictionResult: null });
        try {
            const summary = await generateHistorySummary(history);
            setModalState(prev => ({ ...prev, content: summary, isLoading: false }));
        } catch (error) {
            setModalState(prev => ({ ...prev, content: (error as Error).message, isLoading: false, isError: true }));
        }
    };

    const runTraceabilityReport = async (itemHistory: HistoryEntry[]) => {
        if (itemHistory.length === 0) return;
        const barcode = itemHistory[0].barcode;
        setModalState({ isOpen: true, title: `Trazabilidad de ${barcode}`, content: '', isLoading: true, isError: false, structuredReport: null, predictionResult: null });
        try {
            const report = await generateTraceabilityReport(itemHistory);
            setModalState(prev => ({ ...prev, content: report, isLoading: false }));
        } catch (error) {
            setModalState(prev => ({ ...prev, content: (error as Error).message, isLoading: false, isError: true }));
        }
    };

    const runAnomalyDetection = async (assignments: Assignments, history: HistoryEntry[]) => {
        setModalState({ isOpen: true, title: 'Detector de Anomalías', content: '', isLoading: true, isError: false, structuredReport: null, predictionResult: null });
        try {
            const report = await detectInventoryAnomalies({ assignments, history });
            setModalState(prev => ({ 
                ...prev, 
                content: report.summary, 
                structuredReport: report, 
                isLoading: false 
            }));
        } catch (error) {
            setModalState(prev => ({ ...prev, content: (error as Error).message, isLoading: false, isError: true }));
        }
    };

    const runLocationPrediction = async (articleId: string, assignments: Assignments, history: HistoryEntry[]) => {
        setModalState({ isOpen: true, title: `Buscando: ${articleId}`, content: '', isLoading: true, isError: false, structuredReport: null, predictionResult: null });
        try {
            const result = await predictLikelyLocations({ articleId, assignments, history });
            setModalState(prev => ({
                ...prev,
                content: result.summary,
                predictionResult: result,
                isLoading: false
            }));
        } catch (error) {
             setModalState(prev => ({ ...prev, content: (error as Error).message, isLoading: false, isError: true }));
        }
    };

    const isTraceabilityLoading = modalState.isOpen && modalState.title.startsWith('Trazabilidad de') && modalState.isLoading;
    const isHistoryLoading = modalState.isOpen && modalState.title === 'Resumen de Actividad' && modalState.isLoading;
    const isInventoryLoading = modalState.isOpen && modalState.title === 'Análisis de Inventario' && modalState.isLoading;
    const isAnomalyLoading = modalState.isOpen && modalState.title === 'Detector de Anomalías' && modalState.isLoading;
    const isPredictionLoading = modalState.isOpen && modalState.title.startsWith('Buscando:') && modalState.isLoading;

    return {
        modalState,
        closeModal,
        runInventorySummary,
        runHistorySummary,
        runTraceabilityReport,
        runAnomalyDetection,
        runLocationPrediction,
        isTraceabilityLoading,
        isHistoryLoading,
        isInventoryLoading,
        isAnomalyLoading,
        isPredictionLoading
    };
};
