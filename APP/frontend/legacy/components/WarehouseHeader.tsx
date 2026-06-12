
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, BoxIcon, ShoppingCartIcon, SearchIcon, CameraIcon, TrashIcon, BatchScanIcon, MultiLayerIcon, BellIcon, CheckIcon, DownloadIcon, MenuIcon, CloseIcon } from './Icons';

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
    setModal: (key: string, val: boolean) => void;
    handleInitiateRemoveWorkflow: () => void;
    handleInitiateMultiOccupancy: () => void;
    handleInitiateRequestWorkflow: () => void;
    handleInitiateFinishWorkflow: () => void;
    exportInventoryToExcel: (assignments: any, config: any) => void;

    assignments: any;
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
    setModal,
    handleInitiateRemoveWorkflow,
    handleInitiateMultiOccupancy,
    handleInitiateRequestWorkflow,
    handleInitiateFinishWorkflow,
    exportInventoryToExcel,
    assignments,
}) => {
    const warehouseListRef = useRef<HTMLDivElement>(null);
    const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);

    useEffect(() => {
        if (!isMobileActionsOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isMobileActionsOpen]);

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
        <div className="md:sticky md:top-20 z-20 bg-slate-50 dark:bg-slate-950 pb-2 -mx-3 px-3 md:mx-0 md:px-0 group min-w-0">
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
                                        onClick={() => handleTabChange('CS')}
                                        className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border flex items-center gap-2
                                                ${activeWarehouse === 'CS'
                                                ? 'bg-orange-600 text-white border-orange-700 shadow-md transform scale-105 z-10'
                                                : 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/30 hover:bg-orange-50 dark:hover:bg-orange-900/10'
                                            }
        `}
                                    >
                                        <ShoppingCartIcon className="h-4 w-4" /> Carro Soldadura
                                    </button>
                                    <button
                                        onClick={() => handleTabChange('CP1')}
                                        className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border flex items-center gap-2
                                                ${activeWarehouse === 'CP1'
                                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md transform scale-105 z-10'
                                                : 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30 hover:bg-indigo-50 dark:hover:bg-indigo-900/10'
                                            }
        `}
                                    >
                                        <ShoppingCartIcon className="h-4 w-4" /> Carro Plegado 1
                                    </button>
                                    <button
                                        onClick={() => handleTabChange('CP2')}
                                        className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border flex items-center gap-2
                                                ${activeWarehouse === 'CP2'
                                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md transform scale-105 z-10'
                                                : 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30 hover:bg-indigo-50 dark:hover:bg-indigo-900/10'
                                            }
        `}
                                    >
                                        <ShoppingCartIcon className="h-4 w-4" /> Carro Plegado 2
                                    </button>
                                    <button
                                        onClick={() => handleTabChange('CRP')}
                                        className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border flex items-center gap-2
                                                ${activeWarehouse === 'CRP'
                                                ? 'bg-pink-600 text-white border-pink-700 shadow-md transform scale-105 z-10'
                                                : 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800/30 hover:bg-pink-50 dark:hover:bg-pink-900/10'
                                            }
        `}
                                    >
                                        <ShoppingCartIcon className="h-4 w-4" /> Carro Robot Plegado
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

            {!['CS', 'CP1', 'CP2', 'CRP'].includes(activeWarehouse) && (
                <div className="bg-white dark:bg-slate-900/50 p-3 md:p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 md:space-y-4">
                    <div className="relative w-full">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input type="text" inputMode="search" placeholder="Buscar código..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-cyan-500 focus:ring-0 rounded-xl outline-none text-base" />
                    </div>

                    <div className="md:hidden space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => { setWorkflowMode('assign'); resetScanWorkflow(); setModal('photoAnalyzer', true); }} className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 bg-cyan-600 text-white font-bold rounded-xl shadow active:scale-[0.98] transition-transform">
                                <CameraIcon className="h-5 w-5" />
                                <span className="truncate">{canAssign() ? 'Asignar' : 'Buscar'}</span>
                            </button>

                            {(canRemove() || role === 'JEFE') && (
                                <button onClick={handleInitiateRemoveWorkflow} className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold rounded-xl border border-red-200 dark:border-red-800 active:scale-[0.98] transition-transform">
                                    <TrashIcon className="h-5 w-5" /> <span className="truncate">Retirar</span>
                                </button>
                            )}

                            {canAssign() && (
                                <button onClick={() => { setWorkflowMode('assign'); setModal('batchScanner', true); }} className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 text-white font-bold rounded-xl shadow active:scale-[0.98] transition-transform">
                                    <BatchScanIcon className="h-5 w-5" /> <span className="truncate">Lote</span>
                                </button>
                            )}

                            {canAssign() && (
                                <button onClick={handleInitiateMultiOccupancy} className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 active:scale-[0.98] transition-transform">
                                    <MultiLayerIcon className="h-5 w-5" /> <span className="truncate">Ocupar Varias</span>
                                </button>
                            )}

                            {canRequestItems() && (
                                <button onClick={handleInitiateRequestWorkflow} className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 bg-purple-600 text-white font-bold rounded-xl shadow active:scale-[0.98] transition-transform">
                                    <BellIcon className="h-5 w-5" /> <span className="truncate">Solicitar</span>
                                </button>
                            )}

                            {canFinishProduction() && (
                                <button onClick={handleInitiateFinishWorkflow} className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow border border-emerald-700 active:scale-[0.98] transition-transform">
                                    <CheckIcon className="h-5 w-5" /> <span className="truncate">Finalizar</span>
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => setIsMobileActionsOpen(prev => !prev)}
                            aria-expanded={isMobileActionsOpen}
                            aria-controls="mobile-more-actions"
                            className={`w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 font-semibold rounded-xl border transition-colors ${isMobileActionsOpen
                                ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                                }`}
                        >
                            {isMobileActionsOpen ? <CloseIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />} Más acciones
                        </button>
                    </div>

                    <div className="hidden md:grid grid-cols-2 xl:grid-cols-4 gap-2 md:gap-3">
                        <button onClick={() => { setWorkflowMode('assign'); resetScanWorkflow(); setModal('photoAnalyzer', true); }} className="w-full items-center justify-center gap-3 px-4 py-3 bg-cyan-600 text-white font-bold rounded-xl shadow hover:bg-cyan-500 transition-all inline-flex">
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
                            <button onClick={handleInitiateRequestWorkflow} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-bold rounded-xl shadow hover:bg-purple-500 transition-all">
                                <BellIcon className="h-5 w-5" /> <span className="truncate">Solicitar</span>
                            </button>
                        )}

                        {canFinishProduction() && (
                            <button onClick={handleInitiateFinishWorkflow} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow hover:bg-emerald-500 transition-all border border-emerald-700">
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

                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center pt-1 w-full">
                        <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer p-1 w-full sm:w-auto">
                            <input type="checkbox" checked={showEmptyOnly} onChange={e => setShowEmptyOnly(e.target.checked)} className="h-5 w-5 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300" />
                            Mostrar solo huecos vacíos
                        </label>
                        <div className="hidden md:flex gap-2 w-full sm:w-auto">
                        </div>
                    </div>
                </div>
            )}

            {isMobileActionsOpen && (
                <div className="md:hidden fixed inset-0 z-50 bg-black/55" onClick={() => setIsMobileActionsOpen(false)}>
                    <div id="mobile-more-actions" className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-4 pb-safe max-h-[75dvh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Acciones rápidas</h4>
                            <button onClick={() => setIsMobileActionsOpen(false)} className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center">
                                <CloseIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex flex-col gap-3">
                            {canExport() && (
                                <button onClick={() => { exportInventoryToExcel(assignments, config); setIsMobileActionsOpen(false); }} className="w-full flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-left rounded-2xl border border-emerald-100 dark:border-emerald-800/30 transition-all active:scale-[0.98]">
                                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 rounded-xl shadow-sm">
                                        <DownloadIcon className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-emerald-900 dark:text-emerald-100 text-base">Exportar Excel</div>
                                        <div className="text-xs text-emerald-600 dark:text-emerald-400/80 font-medium">Descargar inventario actual</div>
                                    </div>
                                </button>
                            )}

                            <button onClick={() => { setWorkflowMode('assign'); setModal('manualEntry', true); setIsMobileActionsOpen(false); }} className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-left rounded-2xl border border-slate-200 dark:border-slate-700/50 transition-all active:scale-[0.98]">
                                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl shadow-sm font-bold text-xl">
                                    #
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-slate-900 dark:text-slate-100 text-base">Añadir Manualmente</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Insertar códigos sin escáner</div>
                                </div>
                            </button>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


