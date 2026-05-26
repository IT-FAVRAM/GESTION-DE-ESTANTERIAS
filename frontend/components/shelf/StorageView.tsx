
import React, { useState, useMemo } from 'react';
import { FinishedItem } from '../lib/warehouseData';
import { SearchIcon, CloseIcon, BoxIcon } from './Icons';

interface StorageViewProps {
    finishedItems: FinishedItem[];
}

const StorageView: React.FC<StorageViewProps> = ({ finishedItems }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredItems = useMemo(() => {
        if (!searchQuery) return finishedItems;
        const lowerQ = searchQuery.toLowerCase();
        return finishedItems.filter(item => 
            item.barcode.toLowerCase().includes(lowerQ) || 
            item.orderId.toLowerCase().includes(lowerQ)
        );
    }, [finishedItems, searchQuery]);

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString('es-ES', { 
            day: '2-digit', 
            month: 'short', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-24">
             {/* Header */}
            <div className="flex flex-col items-center justify-center gap-2 mb-2 text-center">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400">
                    <BoxIcon className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Almacén Final</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Artículos terminados y subidos a almacén.
                </p>
            </div>

            {/* Search */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
                 <div className="relative">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400"/>
                    <input 
                        type="text" 
                        placeholder="Buscar artículo o OF..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="w-full pl-12 pr-10 py-3 bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 focus:ring-0 rounded-xl outline-none text-base transition-colors"
                    />
                     {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                            <CloseIcon className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div>
                 {filteredItems.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <BoxIcon className="h-12 w-12 mb-2 opacity-50" />
                        <p className="font-bold">No hay artículos</p>
                        <p className="text-sm">Finaliza una producción escaneando "ALMACEN".</p>
                     </div>
                 ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {filteredItems.map(item => (
                             <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow animate-slide-up relative overflow-hidden">
                                 <div className="absolute top-0 right-0 p-2 opacity-10">
                                     <BoxIcon className="h-20 w-20 text-emerald-500" />
                                 </div>
                                 <div className="relative z-10">
                                     <div className="flex justify-between items-start mb-2">
                                         <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Terminado</span>
                                         <span className="text-xs font-mono text-slate-400">{formatDate(item.timestamp)}</span>
                                     </div>
                                     <div className="mb-1">
                                         <p className="text-xs font-bold text-slate-400 uppercase">Artículo</p>
                                         <p className="text-lg font-black text-slate-800 dark:text-white break-all">{item.barcode}</p>
                                     </div>
                                     <div>
                                         <p className="text-xs font-bold text-slate-400 uppercase">Orden (OF)</p>
                                         <p className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{item.orderId}</p>
                                     </div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 )}
            </div>
        </div>
    );
};

export default StorageView;


