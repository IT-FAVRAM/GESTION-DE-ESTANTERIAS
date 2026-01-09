import React, { useState } from 'react';
import { useWorkingItems } from '../hooks/useWorkingItems';
import { WorkingItem } from '../lib/warehouseData';
import { CheckIcon, LoadingIcon, BoxIcon, FactoryIcon } from './Icons';

interface WorkingItemsListProps {
    userRole: string; // To determine permissions if needed
}

function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`;
    if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return 'hace un momento';
}

const WorkingItemsList: React.FC<WorkingItemsListProps> = ({ userRole }) => {
    const { workingItems, loading, finishItem } = useWorkingItems();
    const [processingId, setProcessingId] = useState<string | null>(null);

    if (loading) return <div className="flex h-64 items-center justify-center"><LoadingIcon className="h-10 w-10 text-indigo-500 animate-spin" /></div>;

    if (workingItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <BoxIcon className="h-24 w-24 mb-4 text-slate-300" />
                <p className="text-xl font-bold text-slate-500">No hay artículos en proceso</p>
                <p className="text-sm text-slate-400">Los artículos retirados para trabajar aparecerán aquí.</p>
            </div>
        );
    }

    // Group by Section
    const groupedItems = workingItems.reduce((acc, item) => {
        const section = item.section || 'OTROS';
        if (!acc[section]) acc[section] = [];
        acc[section].push(item);
        return acc;
    }, {} as Record<string, WorkingItem[]>);

    const handleFinish = async (item: WorkingItem) => {
        if (processingId) return;
        setProcessingId(item.itemKey || `${item.barcode}-${item.orderId}`);
        try {
            await finishItem(item, { uid: 'user', displayName: 'Usuario' });
        } catch (error) {
            console.error(error);
            alert("Error al finalizar el artículo.");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="p-4 pb-20 space-y-8 animate-fade-in">
            {Object.entries(groupedItems).map(([section, items]: [string, WorkingItem[]]) => (
                <div key={section} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 border-b border-indigo-100 dark:border-indigo-800/50 flex justify-between items-center">
                        <h3 className="font-black text-indigo-900 dark:text-indigo-300 tracking-tight uppercase text-lg">{section}</h3>
                        <span className="bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 text-xs font-bold px-2 py-1 rounded-full">{items.length}</span>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {items.map(item => {
                            const isProcessing = processingId === (item.itemKey || `${item.barcode}-${item.orderId}`);

                            return (
                                <div key={item.itemKey || `${item.barcode}-${item.orderId}`} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="text-lg font-bold text-slate-900 dark:text-white truncate" title={item.barcode}>{item.barcode}</span>
                                            <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded truncate max-w-[150px]">{item.orderId}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1" title={item.withdrawnAt}>
                                                🕒 {timeAgo(item.withdrawnAt)}
                                            </span>
                                            <span>
                                                👤 {item.withdrawnBy || 'Desconocido'}
                                            </span>
                                            {item.fromLocationId && (
                                                <span className="text-slate-400 dark:text-slate-500">
                                                    📍 {item.fromLocationId.split('-').pop()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="ml-4">
                                        <button
                                            onClick={() => handleFinish(item)}
                                            disabled={isProcessing}
                                            className={`
                                                flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all
                                                ${isProcessing
                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                    : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 shadow-indigo-900/20'}
                                            `}
                                        >
                                            {isProcessing ? (
                                                <LoadingIcon className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <>
                                                    <CheckIcon className="h-5 w-5" />
                                                    Finalizar
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default WorkingItemsList;
