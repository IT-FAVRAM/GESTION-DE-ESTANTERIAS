





import React, { useState, useMemo, useEffect } from 'react';
import { Assignments, LocationId } from '../lib/warehouseData';
import { isUrgentLocation } from '../lib/schema/shelves';
import { WarehouseConfig } from '../hooks/useWarehouseConfig';
import { CloseIcon, MoveIcon, InfoIcon } from './Icons';
import { generateLayoutLocations } from '../lib/warehouseLayout';

interface MoveItemModalProps {
    item: { barcode: string; fromLocation: LocationId };
    onMove: (toLocation: LocationId) => void;
    onClose: () => void;
    assignments: Assignments;
    config: WarehouseConfig;
}

const MoveItemModal: React.FC<MoveItemModalProps> = ({ item, onMove, onClose, assignments, config }) => {
    const [selectedLocation, setSelectedLocation] = useState<LocationId | null>(null);

    // Initialize active warehouse based on item's current location
    const initialWarehouse = item.fromLocation.split('-')[0];
    const [activeWarehouse, setActiveWarehouse] = useState<string>(
        config.warehouses.some(w => w.code === initialWarehouse) ? initialWarehouse : (config.warehouses[0]?.code || '')
    );

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

    // Update active tab when warehouse changes
    useEffect(() => {
        if (shelves.length > 0) setActiveShelfTab(shelves[0]);
    }, [shelves]);

    const shelfDisplayName = (shelf: string) => {
        if (shelf === 'URGENTE') return 'ZONA URGENTE';
        if (shelf === 'RECHAZOS') return 'RECHAZOS';
        return `Estantería ${shelf}`;
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-end md:items-center justify-center md:p-4" role="dialog" aria-modal="true">
            <div className="relative w-full md:max-w-5xl bg-white dark:bg-slate-900 rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-[95dvh] overflow-hidden">

                <header className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-white dark:bg-slate-900 z-10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                            <MoveIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mover Artículo</h2>
                            <div className="flex items-center gap-2">
                                <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold px-2 py-0.5 rounded uppercase">{item.barcode}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="h-11 w-11 inline-flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-full transition-colors">
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </header>

                {/* WAREHOUSE SELECTOR - WRAPPED GRID */}
                <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
                    <div className="flex flex-wrap gap-2 p-2 justify-center">
                        {config.warehouses.map(wh => (
                            <button
                                key={wh.code}
                                onClick={() => { setActiveWarehouse(wh.code); setSelectedLocation(null); }}
                                className={`flex-grow md:flex-grow-0 px-3 py-2 text-xs md:text-sm font-bold transition-all rounded-lg border
                    ${activeWarehouse === wh.code
                                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900'
                                        : 'bg-white dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-800'
                                    }`}
                            >
                                {wh.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* SHELF TABS - WRAPPED */}
                {shelves.length > 1 && (
                    <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-black/30 p-2 flex flex-wrap justify-center gap-2 flex-shrink-0">
                        {shelves.map(shelf => (
                            <button
                                key={shelf}
                                onClick={() => setActiveShelfTab(shelf)}
                                className={`px-4 py-2 text-xs font-bold uppercase rounded-md transition-all border
                        ${activeShelfTab === shelf
                                        ? 'bg-blue-600 text-white border-blue-600 shadow'
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
                    {/* Render only active shelf */}
                    {(() => {
                        const shelf = activeShelfTab;
                        const isUrgentZone = String(shelf).includes('URGENTE') || (activeWarehouse === 'SOL' && shelf === '1');
                        const shelfLocations = groupedLocations[String(shelf)] || [];

                        return (
                            <div className="space-y-4">
                                {isUrgentZone && (
                                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-bold border border-red-200 dark:border-red-800 justify-center">
                                        <InfoIcon className="h-5 w-5" /> ZONA URGENTE - Se notificará al responsable.
                                    </div>
                                )}
                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                                    <div className={`grid gap-2 ${activeWarehouse === 'ZIN' ? 'grid-cols-1' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'}`}>
                                        {shelfLocations.map((locId) => {
                                            const pos = locId.split('-').pop() || locId;
                                            const isSelected = selectedLocation === locId;
                                            const isCurrentLocation = locId === item.fromLocation;
                                            const occupiedItems = assignments[locId] || [];
                                            const isOccupied = occupiedItems.length > 0;

                                            return (
                                                <button
                                                    key={locId}
                                                    onClick={() => setSelectedLocation(locId)}
                                                    disabled={isOccupied || isCurrentLocation}
                                                    className={`p-2 rounded-lg min-h-[60px] text-left border transition-all duration-200 flex flex-col justify-between relative overflow-hidden
                                    ${isSelected
                                                                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 ring-2 ring-blue-400 z-10'
                                                                : isCurrentLocation
                                                                    ? 'bg-slate-200 dark:bg-slate-800 border-slate-400 opacity-70 cursor-default'
                                                                    : isOccupied
                                                                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed'
                                                                        : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                                                            }`}
                                                >
                                                    <p className="font-bold text-center w-full text-xs mb-1">{pos}</p>
                                                    <div className="flex-grow flex items-center justify-center w-full">
                                                        {isCurrentLocation ? (
                                                            <span className="text-[10px] font-bold text-slate-500">ORIGEN</span>
                                                        ) : isOccupied ? (
                                                            <span className="text-[10px] text-slate-400">Ocupado</span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-green-500">Libre</span>
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

                <footer className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 flex justify-between items-center gap-3 flex-shrink-0 pb-safe">
                    <button onClick={onClose} className="min-h-[44px] px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={() => selectedLocation && onMove(selectedLocation)}
                        disabled={!selectedLocation}
                        className={`flex-grow min-h-[44px] px-6 py-3 text-white font-bold rounded-xl text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all active:scale-[0.98] ${(selectedLocation && isUrgentLocation(selectedLocation))
                            ? 'bg-red-600 hover:bg-red-500'
                            : 'bg-blue-600 hover:bg-blue-500'
                            }`}
                    >
                        {selectedLocation ? 'Confirmar Mover' : 'Selecciona destino'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default MoveItemModal;
