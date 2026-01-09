
import React from 'react';
import { ListIcon, PlusCircleIcon } from './Icons';

interface ShelfRowProps {
    label: string;
    itemCount: number;
    loading?: boolean;
    canAdd?: boolean;
    onViewList: () => void;
    onAdd?: () => void;
}

export const ShelfRow: React.FC<ShelfRowProps> = ({ label, itemCount, loading, canAdd, onViewList, onAdd }) => {
    return (
        <div className="border p-3 rounded-xl shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
                <p className="font-bold text-slate-600 dark:text-slate-400 text-sm">{label}</p>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${itemCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    {loading ? '...' : `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
                </span>
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={onViewList}
                    className="flex-1 h-14 md:h-16 flex items-center justify-center gap-2 text-slate-500 hover:text-cyan-600 bg-slate-50 hover:bg-slate-100 rounded-lg touch-manipulation border border-slate-100 transition-colors"
                >
                    <ListIcon className="h-5 w-5" />
                    <span className="font-semibold text-sm">Ver Lista</span>
                </button>
                {canAdd && onAdd && (
                    <button 
                        onClick={onAdd}
                        className="flex-1 h-14 md:h-16 flex items-center justify-center gap-2 text-cyan-600 bg-cyan-50 hover:bg-cyan-100 rounded-lg touch-manipulation border border-cyan-100 transition-colors"
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                        <span className="font-semibold text-sm">Añadir</span>
                    </button>
                )}
            </div>
        </div>
    );
};
