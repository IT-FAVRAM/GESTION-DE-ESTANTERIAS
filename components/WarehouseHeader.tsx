
import React, { useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, BoxIcon, ShoppingCartIcon, SearchIcon, CameraIcon, TrashIcon, BatchScanIcon, MultiLayerIcon, BellIcon, CheckIcon, DownloadIcon, ChartIcon, SparklesIcon } from './Icons';
import GeminiButton from './GeminiButton';

interface WarehouseHeaderProps {
    activeWarehouse: string;
    config: any;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    handleTabChange: (code: string) => void;
    role: string | null;
    showEmptyOnly: boolean;
    setShowEmptyOnly: (show: boolean) => void;

    // Permissions
    canAssign: () => boolean;
    canRemove: (loc?: string) => boolean;
    canRequestItems: () => boolean;
    canFinishProduction: () => boolean;
    canExport: () => boolean;
    canAnalyzeAnomalies: () => boolean;

    // Actions
    setWorkflowMode: (mode: any) => void;
    resetScanWorkflow: () => void;
    resetScanWorkflow: () => void;
    setModal: (key: string, val: boolean) => void;
    handleInitiateRemoveWorkflow: () => void;
    handleInitiateMultiOccupancy: () => void;
    handleInitiateRequestWorkflow: () => void;
    handleInitiateFinishWorkflow: () => void;
    exportInventoryToExcel: () => void;

    // Gemini
    gemini: any;
    assignments: any;
    history: any;
}

export const WarehouseHeader: React.FC<WarehouseHeaderProps> = ({
    activeWarehouse,
    config,
    searchQuery,
    setSearchQuery,
    handleTabChange,
    role,
    showEmptyOnly,
    setShowEmptyOnly,
    canAssign,
    canRemove,
    canRequestItems,
    canFinishProduction,
    canExport,
    canAnalyzeAnomalies,
    setWorkflowMode,
    resetScanWorkflow,
    setWorkflowMode,
    resetScanWorkflow,
    setModal,
    handleInitiateRemoveWorkflow,
    handleInitiateMultiOccupancy,
    handleInitiateRequestWorkflow,
    handleInitiateFinishWorkflow,
    exportInventoryToExcel,
    gemini,
    assignments,
    history
}) => {
    const warehouseListRef = useRef<HTMLDivElement>(null);

    const scrollWarehouseList = (direction: 'left' | 'right') => {
        if (warehouseListRef.current) {
            const scrollAmount = 200;
            if (direction === 'left') {
                warehouseListRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else {
                warehouseListRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        }
    };

    return (
        <div className="sticky top-16 md:top-20 z-20 bg-slate-50 dark:bg-slate-950 pb-2 -mx-3 px-3 md:mx-0 md:px-0 group">
            <div className="relative">
                <button
                    onClick={() => scrollWarehouseList('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hidden md:flex hover:bg-white dark:hover:bg-slate-800 transition-colors"
                    aria-label="Scroll Left"
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                </button>

                <div ref={warehouseListRef} className="overflow-x-auto smooth-scroll no-scrollbar flex gap-2 pb-2 snap-x w-full px-1 md:px-12">
                    {config.warehouses.map((wh: any) => (
                        <React.Fragment key={wh.code}>
                            <button
                                onClick={() => handleTabChange(wh.code)}
                                className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border
                                        ${activeWarehouse === wh.code
                                        ? 'bg-cyan-600 text-white border-cyan-700 shadow-md transform scale-105 z-10'
                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }
        `}
                            >
                                {wh.name}
                            </button>
                            {/* Inyectar secciones especiales después de Zincado */}
                            {wh.code === 'ZIN' && (
                                <>
                                    <button
                                        onClick={() => handleTabChange('REP_SOL')}
                                        className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border flex items-center gap-2
                                                ${activeWarehouse === 'REP_SOL'
                                                ? 'bg-purple-600 text-white border-purple-700 shadow-md transform scale-105 z-10'
                                                : 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/30 hover:bg-purple-50 dark:hover:bg-purple-900/10'
                                            }
        `}
                                    >
                                        <BoxIcon className="h-4 w-4" /> Repuestos Soldadura
                                    </button>
                                    <button
                                        onClick={() => handleTabChange('CARRO_SOL')}
                                        className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border flex items-center gap-2
                                                ${activeWarehouse === 'CARRO_SOL'
                                                ? 'bg-orange-600 text-white border-orange-700 shadow-md transform scale-105 z-10'
                                                : 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/30 hover:bg-orange-50 dark:hover:bg-orange-900/10'
                                            }
        `}
                                    >
                                        <ShoppingCartIcon className="h-4 w-4" /> Carro Soldadura
                                    </button>
                                    <button
                                        onClick={() => handleTabChange('CARRO_SXP')}
                                        className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border flex items-center gap-2
                                                ${activeWarehouse === 'CARRO_SXP'
                                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md transform scale-105 z-10'
                                                : 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30 hover:bg-indigo-50 dark:hover:bg-indigo-900/10'
                                            }
        `}
                                    >
                                        <ShoppingCartIcon className="h-4 w-4" /> Carro SXP
                                    </button>
                                    <button
                                        onClick={() => handleTabChange('CARRO_RPL')}
                                        className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border flex items-center gap-2
                                                ${activeWarehouse === 'CARRO_RPL'
                                                ? 'bg-pink-600 text-white border-pink-700 shadow-md transform scale-105 z-10'
                                                : 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800/30 hover:bg-pink-50 dark:hover:bg-pink-900/10'
                                            }
        `}
                                    >
                                        <ShoppingCartIcon className="h-4 w-4" /> Carro Rob. Plegado
                                    </button>
                                </>
                            )}
                        </React.Fragment>
                    ))}
                    <div className="min-w-[1rem] h-1 flex-shrink-0"></div>
                </div>

                <button
                    onClick={() => scrollWarehouseList('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hidden md:flex hover:bg-white dark:hover:bg-slate-800 transition-colors"
                    aria-label="Scroll Right"
                >
                    <ChevronRightIcon className="h-5 w-5" />
                </button>
            </div>

            {!['REP_SOL', 'CARRO_SOL', 'CARRO_SXP', 'CARRO_RPL'].includes(activeWarehouse) && (
                <div className="bg-white dark:bg-slate-900/50 p-3 md:p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 md:space-y-4">
                    <div className="relative w-full">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input type="text" placeholder="Buscar código..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-cyan-500 focus:ring-0 rounded-xl outline-none text-base" />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                        <button onClick={() => { setWorkflowMode('assign'); resetScanWorkflow(); setModal('photoAnalyzer', true); }} className="hidden md:flex w-full items-center justify-center gap-3 px-4 py-3 bg-cyan-600 text-white font-bold rounded-xl shadow hover:bg-cyan-500 transition-all">
                            <CameraIcon className="h-5 w-5" />
                            <span className="truncate">{canAssign() ? 'Asignar' : 'Buscar'}</span>
                        </button>

                        {(canRemove() || role === 'JEFE') && (
                            <button onClick={handleInitiateRemoveWorkflow} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-all border border-red-200 dark:border-red-800">
                                <TrashIcon className="h-5 w-5" /> <span className="truncate">Retirar</span>
                            </button>
                        )}

                        {canAssign() && (
                            <button onClick={() => { setWorkflowMode('assign'); setModal('batchScanner', true); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white font-bold rounded-xl shadow hover:bg-slate-700 transition-all">
                                <BatchScanIcon className="h-5 w-5" /> <span className="truncate">Lote</span>
                            </button>
                        )}

                        {canAssign() && (
                            <button
                                onClick={handleInitiateMultiOccupancy}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-all border border-indigo-200 dark:border-indigo-800"
                                title="Ocupar múltiples ubicaciones vacías"
                            >
                                <MultiLayerIcon className="h-5 w-5" /> <span className="truncate">Ocupar Varias</span>
                            </button>
                        )}

                        {canRequestItems() && (
                            <button onClick={handleInitiateRequestWorkflow} className="col-span-2 sm:col-span-1 w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-bold rounded-xl shadow hover:bg-purple-500 transition-all">
                                <BellIcon className="h-5 w-5" /> <span className="truncate">Solicitar</span>
                            </button>
                        )}

                        {canFinishProduction() && (
                            <button onClick={handleInitiateFinishWorkflow} className="col-span-2 sm:col-span-1 w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow hover:bg-emerald-500 transition-all border border-emerald-700">
                                <CheckIcon className="h-5 w-5" /> <span className="truncate">Finalizar</span>
                            </button>
                        )}

                        {canExport() && (
                            <button onClick={() => exportInventoryToExcel(assignments, config)} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all border border-emerald-200 dark:border-emerald-800" title="Exportar Inventario Excel">
                                <DownloadIcon className="h-5 w-5" /> <span className="truncate">Excel</span>
                            </button>
                        )}

                        <button onClick={() => { setWorkflowMode('assign'); setModal('manualEntry', true); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-all">
                            # <span className="truncate">Manual</span>
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center pt-1">
                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer p-1">
                            <input type="checkbox" checked={showEmptyOnly} onChange={e => setShowEmptyOnly(e.target.checked)} className="h-5 w-5 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300" />
                            Mostrar solo huecos vacíos
                        </label>
                        <div className="flex gap-2 w-full sm:w-auto">
                            {canAnalyzeAnomalies() && (
                                <>
                                    <GeminiButton onClick={() => gemini.runInventorySummary(assignments)} isLoading={gemini.isInventoryLoading} className="px-3 py-2 text-sm flex-1 sm:flex-none">
                                        <ChartIcon className="h-4 w-4" /> Resumen
                                    </GeminiButton>
                                    <GeminiButton onClick={() => gemini.runAnomalyDetection(assignments, history)} isLoading={gemini.isAnomalyLoading} className="px-3 py-2 text-sm flex-1 sm:flex-none">
                                        <SparklesIcon className="h-4 w-4" /> Anomalías
                                    </GeminiButton>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
