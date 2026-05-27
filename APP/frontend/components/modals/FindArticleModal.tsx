
import React, { useState } from 'react';
import { CloseIcon, SearchIcon, SparklesIcon } from './Icons';

interface FindArticleModalProps {
    onClose: () => void;
    onPredict: (articleId: string) => void;
}

const FindArticleModal: React.FC<FindArticleModalProps> = ({ onClose, onPredict }) => {
    const [articleId, setArticleId] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (articleId.trim()) {
            onPredict(articleId.trim().toUpperCase());
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="relative w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl p-6 border border-slate-800">
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full transition-colors"
                >
                    <CloseIcon className="h-6 w-6" />
                </button>

                <div className="flex flex-col items-center text-center mb-6 mt-2">
                    <div className="p-3 bg-purple-900/30 rounded-full mb-3">
                        <SparklesIcon className="h-8 w-8 text-purple-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">¿Qué artículo buscas?</h2>
                    <p className="text-slate-400 text-sm mt-1">La IA analizará el historial para predecir su ubicación.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="find-input" className="sr-only">Código del artículo</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <SearchIcon className="h-5 w-5 text-slate-500" />
                            </div>
                            <input
                                id="find-input"
                                type="text"
                                value={articleId}
                                onChange={(e) => setArticleId(e.target.value)}
                                className="w-full pl-10 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:outline-none text-lg font-mono transition-all"
                                placeholder="Escribe o escanea el código..."
                                autoFocus
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={!articleId.trim()}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <SparklesIcon className="h-5 w-5" />
                        Predecir Ubicación
                    </button>
                </form>
            </div>
        </div>
    );
};

export default FindArticleModal;


