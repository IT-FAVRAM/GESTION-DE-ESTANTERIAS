import React, { useState, useMemo, useEffect } from 'react';
import { Assignments, LocationId } from '../lib/warehouseData';
import { isUrgentLocation } from '../lib/schema/shelves';
import { WarehouseConfig } from '../hooks/useWarehouseConfig';
import { CloseIcon, MoveIcon, InfoIcon } from './Icons';
import { generateLayoutLocations } from '../lib/warehouseLayout';

interface RelocateLocationModalProps {
    sourceLocationId: LocationId;
    onRelocate: (toLocation: LocationId) => void;
    onClose: () => void;
    assignments: Assignments;
    config: WarehouseConfig;
}

const RelocateLocationModal: React.FC<RelocateLocationModalProps> = ({ sourceLocationId, onRelocate, onClose, assignments, config }) => {
    const [selectedLocation, setSelectedLocation] = useState<LocationId | null>(null);

    // Fixed to the source location's warehouse
    const activeWarehouse = sourceLocationId.split('-')[0];
    const warehouseName = config.warehouses.find(w => w.code === activeWarehouse)?.name || activeWarehouse;

    const [activeShelfTab, setActiveShelfTab] = useState<string>('');

    const groupedLocations = useMemo(() => {
        const byShelf: Record<string, LocationId[]> = {};
        const locations = generateLayoutLocations(activeWarehouse);

        const shelfFromLocation = (locId: string) => {
            const parts = locId.split('-');
            if (parts[1] === 'E') return parts[2] || 'GENERAL';
            if (parts[1]?.startsWith('E')) return parts[1].replace('E', '') || '1';
            return 'GENERAL';
        };

        locations.forEach((locId) => {
            const shelf = shelfFromLocation(locId);
            if (!byShelf[shelf]) byShelf[shelf] = [];
            byShelf[shelf].push(locId);
        });

        Object.keys(byShelf).forEach((shelf) => {
            byShelf[shelf].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
        });

        return byShelf;
    }, [activeWarehouse]);

    const shelves = useMemo(() => Object.keys(groupedLocations), [groupedLocations]);

    useEffect(() => {
        if (shelves.length > 0 && !activeShelfTab) {
            setActiveShelfTab(shelves[0]);
        }
    }, [shelves, activeShelfTab]);

    const shelfDisplayName = (shelf: string) => {
        if (shelf === 'URGENTE') return 'ZONA URGENTE';
        if (shelf === 'RECHAZOS') return 'RECHAZOS';
        return `Estantería ${shelf}`;
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">

                <header className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-white dark:bg-slate-900 z-10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                            <MoveIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Reubicar Contenido</h2>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 text-sm">Origen: </span>
                                <span className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-bold px-2 py-0.5 rounded uppercase border border-orange-200 dark:border-orange-800">
                                    {sourceLocationId.split('-').pop()} ({warehouseName})
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-full transition-colors">
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </header>

                {/* INFO ALERT */}
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 border-b border-orange-100 dark:border-orange-800 flex items-center gap-3 text-orange-800 dark:text-orange-300 text-sm">
                    <InfoIcon className="h-5 w-5 flex-shrink-0" />
                    <p>Moviendo todos los artículos a una nueva ubicación vacía en <strong>{warehouseName}</strong>.</p>
                </div>

                {/* SHELF TABS */}
                {shelves.length > 1 && (
                    <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-black/30 p-2 flex flex-wrap justify-center gap-2 flex-shrink-0">
                        {shelves.map(shelf => (
                            <button
                                key={shelf}
                                onClick={() => setActiveShelfTab(shelf)}
                                className={`px-4 py-2 text-xs font-bold uppercase rounded-md transition-all border
                        ${activeShelfTab === shelf
                                        ? 'bg-orange-600 text-white border-orange-600 shadow'
                                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}
                        `}
                            >
                                {shelfDisplayName(shelf)}
                            </button>
                        ))}
                    </div>
                )}

                {/* GRID CONTENT */}
                <div className="overflow-y-auto p-2 flex-grow bg-slate-50 dark:bg-black/20">
                    {(() => {
                        const shelf = activeShelfTab;
                        const shelfLocations = groupedLocations[String(shelf)] || [];

                        return (
                            <div className="space-y-4">
                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                                    <div className={`grid gap-2 ${activeWarehouse === 'ZIN' ? 'grid-cols-1' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'}`}>
                                        {shelfLocations.map((finalLocId) => {
                                                const pos = finalLocId.split('-').pop() || finalLocId;

                                                const isSelected = selectedLocation === finalLocId;
                                                const isCurrentLocation = finalLocId === sourceLocationId;
                                                const isOccupied = (assignments[finalLocId] || []).length > 0;

                                                return (
                                                    <button
                                                        key={finalLocId}
                                                        onClick={() => setSelectedLocation(finalLocId)}
                                                        disabled={isOccupied || isCurrentLocation}
                                                        className={`p-2 rounded-lg min-h-[60px] text-left border transition-all duration-200 flex flex-col justify-between relative
                                    ${isSelected
                                                                ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-500 ring-2 ring-orange-400 z-10'
                                                                : isCurrentLocation
                                                                    ? 'bg-slate-200 dark:bg-slate-800 border-slate-400 opacity-70 cursor-default'
                                                                    : isOccupied
                                                                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed'
                                                                        : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700'
                                                            }`}
                                                    >
                                                        <p className="font-bold text-center w-full text-xs mb-1">
                                                            {pos}
                                                        </p>
                                                        <div className="flex-grow flex items-center justify-center w-full">
                                                            {isCurrentLocation ? (
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Actual</span>
                                                            ) : isOccupied ? (
                                                                <span className="text-[10px] text-slate-400 uppercase">Ocupado</span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-green-500 uppercase">Vacio</span>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                            </div>
                        );
                    })()}
                </div>

                <footer className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 flex justify-between items-center gap-3 flex-shrink-0">
                    <button onClick={onClose} className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={() => selectedLocation && onRelocate(selectedLocation)}
                        disabled={!selectedLocation}
                        className={`flex-grow px-6 py-3 text-white font-bold rounded-xl text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all active:scale-[0.98] ${selectedLocation ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-500/20' : 'bg-slate-400'
                            }`}
                    >
                        {selectedLocation ? 'Confirmar Reubicación' : 'Selecciona destino vacío'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default RelocateLocationModal;
