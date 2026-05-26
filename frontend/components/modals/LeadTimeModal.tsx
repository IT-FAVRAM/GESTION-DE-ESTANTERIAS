import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { X, Calendar, Activity, AlertTriangle, Clock, FileText } from 'lucide-react';

interface LeadTimeRow {
    barcode: string;
    orderId: string;
    entryDate: string; // ISO timestamp
    exitDate: string;  // ISO timestamp
    durationDays: number;
}

interface LeadTimeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const LeadTimeModal: React.FC<LeadTimeModalProps> = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<LeadTimeRow[]>([]);
    const [dateRange, setDateRange] = useState({
        from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], // Last 30 days
        to: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        if (isOpen && data.length === 0) {
            fetchData();
        }
    }, [isOpen]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const getLeadTime = httpsCallable(functions, 'leadTimeDataset');
            // Parse local dates to timestamps for the query if needed, or pass strings
            // Function expects ISO strings or timestamps? The function docs used strings in comparisons,
            // but let's pass proper ISO strings with time to be safe, or just date strings if supported.
            // The function uses >= dateFrom, so YYYY-MM-DD works if stored as ISO string.
            // But 'timestamp' in history is usually full ISO.
            // Let's stick to simple string passing.
            const result = await getLeadTime({
                dateFrom: new Date(dateRange.from).toISOString(),
                dateTo: new Date(dateRange.to + 'T23:59:59').toISOString()
            });
            const responseData = result.data as { rows: LeadTimeRow[] };
            setData(responseData.rows || []);
        } catch (error) {
            console.error("Error obteniendo tiempo de entrega:", error);
            // Handle error (toast or alert)
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const avgTime = data.length > 0
        ? (data.reduce((acc, curr) => acc + curr.durationDays, 0) / data.length).toFixed(1)
        : "0.0";

    // Find outliers (> 30 days potentially)
    const outliers = data.filter(d => d.durationDays > 30);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-cyan-500/10 rounded-xl">
                            <Activity className="w-6 h-6 text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Análisis Lead Time</h2>
                            <p className="text-sm text-slate-400">Tiempo de ciclo de inventario</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Controls */}
                <div className="p-6 border-b border-slate-700 bg-slate-900 flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                        <input
                            type="date"
                            value={dateRange.from}
                            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                            className="bg-transparent border-none text-slate-300 text-sm focus:ring-0 p-2"
                        />
                        <span className="text-slate-500">→</span>
                        <input
                            type="date"
                            value={dateRange.to}
                            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                            className="bg-transparent border-none text-slate-300 text-sm focus:ring-0 p-2"
                        />
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Calendar className="w-4 h-4" />}
                        Actualizar Datos
                    </button>

                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Metrics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
                            <p className="text-slate-400 text-sm mb-1 flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Promedio Permanencia
                            </p>
                            <div className="text-4xl font-bold text-cyan-400">{avgTime} <span className="text-lg text-slate-500">días</span></div>
                        </div>
                        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
                            <p className="text-slate-400 text-sm mb-1 flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Items Analizados
                            </p>
                            <div className="text-4xl font-bold text-white">{data.length} <span className="text-lg text-slate-500">items</span></div>
                        </div>
                        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
                            <p className="text-slate-400 text-sm mb-1 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" /> Anomalías (&gt;30 días)
                            </p>
                            <div className="text-4xl font-bold text-amber-500">{outliers.length} <span className="text-lg text-slate-500">casos</span></div>
                        </div>
                    </div>

                    {/* Quick List of Longest Duration Items */}
                    {data.length > 0 && (
                        <div>
                            <h3 className="text-white font-bold mb-4">Top Tiempos de Permanencia</h3>
                            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                                <table className="w-full text-left text-sm text-slate-400">
                                    <thead className="bg-slate-900/50 text-xs uppercase font-medium text-slate-500">
                                        <tr>
                                            <th className="px-6 py-3">Código</th>
                                            <th className="px-6 py-3">Orden (OF)</th>
                                            <th className="px-6 py-3">Entrada</th>
                                            <th className="px-6 py-3">Salida</th>
                                            <th className="px-6 py-3 text-right">Días</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {[...data].sort((a, b) => b.durationDays - a.durationDays).slice(0, 10).map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="px-6 py-3 font-medium text-white">{row.barcode}</td>
                                                <td className="px-6 py-3 text-cyan-400">{row.orderId}</td>
                                                <td className="px-6 py-3">{new Date(row.entryDate).toLocaleDateString()}</td>
                                                <td className="px-6 py-3">{new Date(row.exitDate).toLocaleDateString()}</td>
                                                <td className={`px-6 py-3 text-right font-bold ${row.durationDays > 30 ? 'text-amber-500' : 'text-slate-200'}`}>
                                                    {row.durationDays.toFixed(1)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {data.length === 0 && !loading && (
                        <div className="text-center py-12 text-slate-500">
                            No hay datos para el rango seleccionado.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


