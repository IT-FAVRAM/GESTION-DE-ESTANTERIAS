


import React from 'react';
import { CloseIcon, ErrorIcon, InfoIcon, CheckIcon, DownloadIcon } from './Icons';
import { GeminiAnomalyReport, AnomalyItem } from '../lib/gemini';

interface AnomalyReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: GeminiAnomalyReport | null;
}

const SeverityBadge: React.FC<{ severity: AnomalyItem['severity'] }> = ({ severity }) => {
    const colors = {
        high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800',
        medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    };
    
    const labels = {
        high: 'ALTA',
        medium: 'MEDIA',
        low: 'BAJA'
    };

    return (
        <span className={`px-2 py-1 rounded text-[10px] font-bold border ${colors[severity]}`}>
            {labels[severity]}
        </span>
    );
};

const AnomalyCard: React.FC<{ anomaly: AnomalyItem }> = ({ anomaly }) => {
    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 dark:text-slate-200 capitalize">
                        {anomaly.type.replace('_', ' ')}
                    </span>
                    <SeverityBadge severity={anomaly.severity} />
                </div>
                {(anomaly.locationId || anomaly.articleId) && (
                    <div className="text-right text-xs font-mono text-slate-500 dark:text-slate-400">
                        {anomaly.locationId && <div>Loc: {anomaly.locationId}</div>}
                        {anomaly.articleId && <div>Item: {anomaly.articleId}</div>}
                    </div>
                )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{anomaly.description}</p>
            {anomaly.suggestions && (
                <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg text-xs text-slate-500 dark:text-slate-400 flex gap-2">
                    <span className="font-bold">💡 Sugerencia:</span>
                    {anomaly.suggestions}
                </div>
            )}
        </div>
    );
};

const renderMarkdownLite = (text: string) => {
    return text.split('\n').map((line, i) => (
        <p key={i} className="mb-2 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
            {line.replace(/^\*\s/, '• ')}
        </p>
    ));
};

const AnomalyReportModal: React.FC<AnomalyReportModalProps> = ({ isOpen, onClose, report }) => {
    if (!isOpen || !report) return null;

    const highSeverityCount = report.anomalies.filter(a => a.severity === 'high').length;

    const handleDownload = () => {
        const textContent = `
# REPORTE DE ANOMALÍAS
Fecha: ${new Date().toLocaleString()}

## RESUMEN
${report.summary}

## DETALLE DE INCIDENCIAS
${report.anomalies.map(a => `
- [${a.severity.toUpperCase()}] ${a.type}: ${a.description}
  Ubicación: ${a.locationId || 'N/A'} | Artículo: ${a.articleId || 'N/A'}
  Sugerencia: ${a.suggestions || ''}
`).join('')}

## RECOMENDACIONES
${report.recommendations || ''}
        `;
        
        const element = document.createElement("a");
        const file = new Blob([textContent], {type: 'text/markdown'});
        element.href = URL.createObjectURL(file);
        element.download = `Reporte_Anomalias_${new Date().toISOString().slice(0,10)}.md`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="relative w-full max-w-3xl bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
                
                {/* Header */}
                <header className={`p-5 border-b ${highSeverityCount > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'} flex justify-between items-center rounded-t-2xl`}>
                    <div className="flex items-center gap-3">
                        {highSeverityCount > 0 ? (
                            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600 dark:text-red-400">
                                <ErrorIcon className="h-6 w-6" />
                            </div>
                        ) : (
                            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full text-green-600 dark:text-green-400">
                                <CheckIcon className="h-6 w-6" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Reporte de Anomalías</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {report.anomalies.length} incidencias detectadas
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-black/5 transition-colors">
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </header>

                {/* Content */}
                <div className="overflow-y-auto p-4 md:p-6 space-y-6">
                    
                    {/* Summary Section */}
                    <section className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Resumen Ejecutivo</h3>
                        <div className="prose dark:prose-invert max-w-none">
                            {renderMarkdownLite(report.summary)}
                        </div>
                    </section>

                    {/* Anomalies List */}
                    <section>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex justify-between">
                            <span>Detalle de Incidencias</span>
                            {highSeverityCount > 0 && <span className="text-red-500">{highSeverityCount} Críticas</span>}
                        </h3>
                        {report.anomalies.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                <CheckIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>No se han detectado anomalías importantes.</p>
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                                {report.anomalies.map((anomaly, idx) => (
                                    <AnomalyCard key={idx} anomaly={anomaly} />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Recommendations */}
                    {report.recommendations && (
                        <section className="bg-cyan-50 dark:bg-cyan-900/10 p-4 rounded-xl border border-cyan-100 dark:border-cyan-800/30">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-3 flex items-center gap-2">
                                <InfoIcon className="h-4 w-4" /> Recomendaciones
                            </h3>
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                                {renderMarkdownLite(report.recommendations)}
                            </div>
                        </section>
                    )}
                </div>

                {/* Footer */}
                <footer className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl flex justify-end gap-3">
                    <button onClick={handleDownload} className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2">
                        <DownloadIcon className="h-4 w-4" />
                        Exportar Reporte
                    </button>
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 dark:bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors shadow-lg">
                        Entendido
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default AnomalyReportModal;