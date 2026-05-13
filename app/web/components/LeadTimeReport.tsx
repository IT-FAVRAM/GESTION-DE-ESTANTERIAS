import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebaseV3';
import ReactMarkdown from 'react-markdown';
import { ChartIcon, SparklesIcon, LoadingIcon, ErrorIcon } from './Icons';

interface InventoryCycleMetric {
    barcode: string;
    orderId: string;
    entryDate: string;
    exitDate: string;
    durationDays: number;
}

export const LeadTimeReport: React.FC = () => {
    // State
    const [dateFrom, setDateFrom] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<InventoryCycleMetric[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    // AI State
    const [aiLoading, setAiLoading] = useState(false);
    const [aiReport, setAiReport] = useState<string | null>(null);

    const fetchDataset = async () => {
        setLoading(true);
        setError(null);
        setAiReport(null);
        try {
            const callable = httpsCallable(functions, 'leadTimeDataset');
            const result = await callable({
                dateFrom: new Date(dateFrom).toISOString(),
                dateTo: new Date(dateTo).toISOString()
            });

            // The backend will now return a list of items with entry/exit times
            const rows = (result.data as { rows: InventoryCycleMetric[] }).rows;

            // Sort by duration descending (bottlenecks first)
            rows.sort((a, b) => b.durationDays - a.durationDays);

            setData(rows);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const runAIAnalysis = async () => {
        if (!data || data.length === 0) return;
        setAiLoading(true);
        try {
            // Compute summary stats to send to AI
            const avgDuration = data.reduce((acc, curr) => acc + curr.durationDays, 0) / data.length;
            const maxDuration = Math.max(...data.map(d => d.durationDays));
            const minDuration = Math.min(...data.map(d => d.durationDays));

            const stats = {
                totalItemsAnalyzed: data.length,
                avgDaysInWarehouse: avgDuration.toFixed(2),
                maxDaysInWarehouse: maxDuration.toFixed(2),
                minDaysInWarehouse: minDuration.toFixed(2),
                // itemsOver30Days: data.filter(d => d.durationDays > 30).length
            };

            const callable = httpsCallable(functions, 'leadTimeAIReport');
            const result = await callable({
                rows: data.slice(0, 20), // Send top 20 bottlenecks
                summaryStats: stats
            });
            setAiReport((result.data as { markdown: string }).markdown);
        } catch (err: any) {
            setError('Error IA: ' + err.message);
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* CONTROLS */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Desde (Salida)</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Hasta (Salida)</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                </div>
                <div className="flex-grow">
                    <p className="text-xs text-slate-500 italic mt-4">
                        Analiza el tiempo que los artículos permanecieron en el almacén antes de salir (en el rango de fechas seleccionado).
                    </p>
                </div>
                <button onClick={fetchDataset} disabled={loading} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2">
                    {loading ? <LoadingIcon className="animate-spin h-5 w-5" /> : <ChartIcon className="h-5 w-5" />}
                    Analizar
                </button>
            </div>

            {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg flex items-center gap-2">
                    <ErrorIcon className="h-5 w-5" /> {error}
                </div>
            )}

            {data && (
                <div className="animate-fade-in space-y-6">
                    {/* KPI CARDS */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <p className="text-slate-400 text-xs font-bold uppercase">Items Analizados</p>
                            <p className="text-2xl font-bold text-white">{data.length}</p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <p className="text-slate-400 text-xs font-bold uppercase">Tiempo Promedio</p>
                            <p className="text-2xl font-bold text-cyan-400">
                                {(data.reduce((acc, curr) => acc + curr.durationDays, 0) / data.length).toFixed(1)}
                                <span className="text-sm text-slate-500 ml-1">días</span>
                            </p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <p className="text-slate-400 text-xs font-bold uppercase">Max. Permanencia</p>
                            <p className="text-2xl font-bold text-orange-400">
                                {Math.max(...data.map(d => d.durationDays)).toFixed(0)}
                                <span className="text-sm text-slate-500 ml-1">días</span>
                            </p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <p className="text-slate-400 text-xs font-bold uppercase">Rotación Lenta ({'>'}30d)</p>
                            <p className="text-2xl font-bold text-red-400">{data.filter(d => d.durationDays > 30).length}</p>
                        </div>
                    </div>

                    {/* AI BUTTON */}
                    <div className="flex justify-end">
                        <button
                            onClick={runAIAnalysis}
                            disabled={aiLoading}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-900/20"
                        >
                            {aiLoading ? <LoadingIcon className="animate-spin h-5 w-5" /> : <SparklesIcon className="h-5 w-5 text-yellow-300" />}
                            Analizar Tiempos con IA
                        </button>
                    </div>

                    {/* AI REPORT */}
                    {aiReport && (
                        <div className="bg-indigo-900/10 border border-indigo-500/30 p-6 rounded-2xl animate-slide-up">
                            <h3 className="text-xl font-bold text-indigo-300 mb-4 flex items-center gap-2"><SparklesIcon className="h-6 w-6" /> Análisis de Ciclo de Vida</h3>
                            <div className="prose prose-invert max-w-none prose-sm">
                                <ReactMarkdown>{aiReport}</ReactMarkdown>
                            </div>
                        </div>
                    )}

                    {/* DETAILED TABLE */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="bg-slate-800 text-xs uppercase font-bold text-slate-400 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3">Artículo</th>
                                    <th className="px-4 py-3">Orden (OF)</th>
                                    <th className="px-4 py-3 text-right">Entrada</th>
                                    <th className="px-4 py-3 text-right">Salida</th>
                                    <th className="px-4 py-3 text-right">Días en Almacén</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {data.map((row, idx) => (
                                    <tr key={`${row.barcode}-${idx}`} className="hover:bg-slate-800/50">
                                        <td className="px-4 py-3 font-mono text-white font-bold">{row.barcode}</td>
                                        <td className="px-4 py-3 text-slate-400">{row.orderId}</td>
                                        <td className="px-4 py-3 text-right font-mono text-xs">{new Date(row.entryDate).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-right font-mono text-xs">{new Date(row.exitDate).toLocaleDateString()}</td>
                                        <td className={`px-4 py-3 text-right font-bold ${row.durationDays > 30 ? 'text-red-400' :
                                                row.durationDays > 7 ? 'text-yellow-400' : 'text-green-400'
                                            }`}>
                                            {row.durationDays.toFixed(1)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

