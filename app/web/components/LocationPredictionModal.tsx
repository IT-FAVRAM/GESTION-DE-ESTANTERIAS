
import React from 'react';
import { CloseIcon, SparklesIcon, MapIcon } from './Icons';
import { GeminiLocationPredictionResult } from '../lib/gemini';

interface LocationPredictionModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: GeminiLocationPredictionResult | null;
    itemName: string;
}

const ProbabilityBar: React.FC<{ value: number }> = ({ value }) => {
    let colorClass = 'bg-red-500';
    if (value >= 75) colorClass = 'bg-emerald-500';
    else if (value >= 40) colorClass = 'bg-amber-500';

    return (
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
            <div 
                className={`h-full rounded-full ${colorClass} transition-all duration-500`} 
                style={{ width: `${value}%` }}
            />
        </div>
    );
};

const LocationPredictionModal: React.FC<LocationPredictionModalProps> = ({ isOpen, onClose, result, itemName }) => {
    if (!isOpen || !result) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="relative w-full max-w-md bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
                
                <header className="p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                            <SparklesIcon className="h-5 w-5" />
                            <span className="text-xs font-bold uppercase tracking-wider">IA Predicción</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            ¿Dónde está <span className="text-cyan-600 dark:text-cyan-400">{itemName}</span>?
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-black/5 transition-colors">
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </header>

                <div className="overflow-y-auto p-5 space-y-6">
                    {/* Summary */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                            {result.summary}
                        </p>
                    </div>

                    {/* Predictions List */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                            Ubicaciones Sugeridas
                        </h3>
                        <div className="space-y-3">
                            {result.predictions.map((pred, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-mono font-bold text-lg text-slate-900 dark:text-white">
                                            {pred.locationId}
                                        </span>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                            pred.probability > 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            pred.probability > 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                            {pred.probability}% Probable
                                        </span>
                                    </div>
                                    
                                    <ProbabilityBar value={pred.probability} />
                                    
                                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1">
                                        <span className="text-base">💡</span>
                                        {pred.reason}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {result.notes && (
                        <p className="text-xs text-center text-slate-400 italic">
                            Nota: {result.notes}
                        </p>
                    )}
                </div>

                <footer className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl">
                    <button onClick={onClose} className="w-full py-3 bg-slate-800 dark:bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors shadow-lg">
                        Cerrar
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default LocationPredictionModal;
