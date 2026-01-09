import React, { useState, useMemo } from 'react';
import { Assignments, LocationId, isUrgentLocation } from '../lib/warehouseData';
import { WarehouseConfig } from '../hooks/useWarehouseConfig';
import { CloseIcon, MoveIcon, InfoIcon } from './Icons';

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

    const [activeShelfTab, setActiveShelfTab] = useState<string | number>(0);

    const currentStructure = useMemo(() => {
        const pad3 = (n: number) => n.toString().padStart(3, '0');

        if (activeWarehouse === 'MEC') {
            return {
                shelves: ['URGENTE', 'GEN_A', 'GEN_B', 'GEN_C', 'GEN_D'],
                racks: [1],
                positions: (shelf: string | number) => {
                    if (shelf === 'URGENTE') return Array.from({ length: 4 }, (_, i) => `MEC ${pad3(i + 1)}`);
                    if (shelf === 'GEN_A') return Array.from({ length: 9 }, (_, i) => `MEC ${pad3(i + 5)}`);
                    if (shelf === 'GEN_B') return Array.from({ length: 9 }, (_, i) => `MEC ${pad3(i + 14)}`);
                    if (shelf === 'GEN_C') return Array.from({ length: 12 }, (_, i) => `MEC ${pad3(i + 23)}`);
                    if (shelf === 'GEN_D') return Array.from({ length: 12 }, (_, i) => `MEC ${pad3(i + 35)}`);
                    return [];
                }
            };
        }

        if (activeWarehouse === 'SXP') {
            return {
                shelves: ['SXP_MAIN'],
                racks: [1],
                positions: () => Array.from({ length: 10 }, (_, i) => `SXP ${pad3(i + 1)}`)
            };
        }
        if (activeWarehouse === 'PLE') {
            return {
                shelves: ['EST_1_URGENTE', 'EST_1_GENERAL', 'EST_2', 'PUNZONADORA', 'CARRO_1', 'CARRO_2'],
                racks: [1],
                positions: (shelf: string | number) => {
                    if (shelf === 'EST_1_URGENTE') return Array.from({ length: 6 }, (_, i) => `PLE ${pad3(i + 1)}`);
                    if (shelf === 'EST_1_GENERAL') return Array.from({ length: 10 }, (_, i) => `PLE ${pad3(i + 7)}`);
                    if (shelf === 'EST_2') return Array.from({ length: 14 }, (_, i) => `PLE ${pad3(i + 17)}`);
                    if (shelf === 'PUNZONADORA') return Array.from({ length: 23 }, (_, i) => `PLE ${pad3(i + 31)}`);
                    if (shelf === 'CARRO_1') return Array.from({ length: 4 }, (_, i) => `PLE C1-${i + 1}`);
                    if (shelf === 'CARRO_2') return Array.from({ length: 4 }, (_, i) => `PLE C2-${i + 1}`);
                    return [];
                }
            };
        }
        if (activeWarehouse === 'REP') {
            return {
                shelves: ['URGENTE', 'ALUMINIO', 'NORMAL', 'MODULAR'],
                racks: [1],
                positions: (shelf: string | number) => {
                    if (shelf === 'URGENTE') return Array.from({ length: 4 }, (_, i) => `REP ${pad3(i + 1)}`);
                    if (shelf === 'ALUMINIO') return Array.from({ length: 10 }, (_, i) => `REP ${pad3(i + 5)}`);
                    if (shelf === 'NORMAL') return Array.from({ length: 10 }, (_, i) => `REP ${pad3(i + 15)}`);
                    if (shelf === 'MODULAR') return Array.from({ length: 15 }, (_, i) => `REP ${pad3(i + 25)}`);
                    return [];
                }
            }
        }
        if (activeWarehouse === 'PIN') {
            return {
                shelves: ['DENTRO', 'FUERA'],
                racks: [1],
                positions: (shelf: string | number) => {
                    if (shelf === 'DENTRO') return Array.from({ length: 15 }, (_, i) => `PIN ${pad3(i + 1)}`);
                    if (shelf === 'FUERA') return Array.from({ length: 12 }, (_, i) => `PIN ${pad3(i + 16)}`);
                    return [];
                }
            };
        }
        if (activeWarehouse === 'COM') {
            return {
                shelves: ['1'],
                racks: [1],
                positions: () => Array.from({ length: 18 }, (_, i) => `COM ${pad3(i + 1)}`)
            };
        }
        if (activeWarehouse === 'RPL') {
            return {
                shelves: ['EST1', 'EST2'],
                racks: [1],
                positions: (shelf: string | number) => {
                    if (shelf === 'EST1') return Array.from({ length: 14 }, (_, i) => `ROB.PLE ${pad3(i + 1)}`);
                    if (shelf === 'EST2') return Array.from({ length: 21 }, (_, i) => `ROB.PLE ${pad3(i + 15)}`);
                    return [];
                }
            };
        }
        if (activeWarehouse === 'SOL') {
            return {
                shelves: ['1', '2'],
                racks: [1],
                positions: (shelf: string | number) => {
                    if (shelf === '1') return Array.from({ length: 4 }, (_, i) => `SOL ${pad3(i + 1)}`);
                    if (shelf === '2') return Array.from({ length: 36 }, (_, i) => `SOL ${pad3(i + 5)}`);
                    return [];
                }
            };
        }
        if (activeWarehouse === 'RSO') {
            return {
                shelves: ['1'],
                racks: [1],
                positions: () => [
                    'ROB.SOL 001', 'ROB.SOL 002', 'ROB.SOL 003', 'ROB.SOL 004',
                    'ROB.SOL 005', 'ROB.SOL 006', 'ROB.SOL 007', 'ROB.SOL 008'
                ]
            };
        }
        if (activeWarehouse === 'CAL') {
            return {
                shelves: ['RECHAZOS', 'GENERAL'],
                racks: [1],
                positions: (shelf: string | number) => {
                    if (shelf === 'RECHAZOS') return Array.from({ length: 22 }, (_, i) => `CAL ${pad3(i + 1)}`);
                    if (shelf === 'GENERAL') return Array.from({ length: 12 }, (_, i) => `CAL ${pad3(i + 23)}`);
                    return [];
                }
            };
        }
        if (activeWarehouse === 'ZIN') {
            return {
                shelves: ['1'],
                racks: [1, 2, 3, 4, 5],
                positions: () => ['1']
            };
        }

        return {
            shelves: config.shelves,
            racks: config.racks,
            positions: () => config.positions
        };
    }, [activeWarehouse, config]);

    // Update active tab when structure changes
    useMemo(() => {
        if (currentStructure.shelves.length > 0) {
            setActiveShelfTab(currentStructure.shelves[0]);
        }
    }, [currentStructure]);

    const shelfDisplayName = (shelf: string | number) => {
        if (activeWarehouse === 'MEC' && shelf === 'URGENTE') return 'ZONA URGENTE';
        if (activeWarehouse === 'MEC' && shelf === 'GEN_A') return 'General A (05-13)';
        if (activeWarehouse === 'MEC' && shelf === 'GEN_B') return 'General B (14-22)';
        if (activeWarehouse === 'MEC' && shelf === 'GEN_C') return 'General C (23-34)';
        if (activeWarehouse === 'MEC' && shelf === 'GEN_D') return 'General D (35-46)';
        if (activeWarehouse === 'PLE' && shelf === 'EST_1_URGENTE') return 'Est 1 Urgente (1-6)';
        if (activeWarehouse === 'PLE' && shelf === 'EST_1_GENERAL') return 'Est 1 General (7-16)';
        if (activeWarehouse === 'PLE' && shelf === 'EST_2') return 'Estantería 2';
        if (activeWarehouse === 'PLE' && shelf === 'PUNZONADORA') return 'Punzonadora';
        if (activeWarehouse === 'PLE' && shelf === 'CARRO_1') return '🛒 CARRO 1';
        if (activeWarehouse === 'PLE' && shelf === 'CARRO_2') return '🛒 CARRO 2';
        if (activeWarehouse === 'REP') {
            if (shelf === 'URGENTE') return 'URGENTE';
            if (shelf === 'ALUMINIO') return 'ALUMINIO';
            if (shelf === 'NORMAL') return 'NORMAL';
            if (shelf === 'MODULAR') return 'ALM. MODULAR';
        }
        if (activeWarehouse === 'CAL') {
            if (shelf === 'RECHAZOS') return '🛑 RECHAZOS';
            if (shelf === 'GENERAL') return '📚 ESTANTERÍA 2';
        }
        if (activeWarehouse === 'RPL') {
            if (shelf === 'EST1') return 'Estantería 1';
            if (shelf === 'EST2') return 'Estantería 2';
        }
        if (activeWarehouse === 'PIN') {
            if (shelf === 'DENTRO') return 'DENTRO';
            if (shelf === 'FUERA') return 'FUERA';
        }
        if (activeWarehouse === 'ZIN') return 'Zincado';
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
                {currentStructure.shelves.length > 1 && (
                    <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-black/30 p-2 flex flex-wrap justify-center gap-2 flex-shrink-0">
                        {currentStructure.shelves.map(shelf => (
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
                        const racks = Array.isArray(currentStructure.racks) ? currentStructure.racks : (currentStructure.racks as Function)(shelf);

                        return (
                            <div className="space-y-4">
                                {racks.map((rack: number) => (
                                    <div key={`${activeWarehouse}-E${shelf}-B${rack}`} className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                                        {(activeWarehouse === 'PIN' || racks.length > 1) && (
                                            <h5 className="text-xs font-bold text-slate-400 mb-2 uppercase">Rack/Balda {rack}</h5>
                                        )}
                                        <div className={`grid gap-2 ${activeWarehouse === 'ZIN' ? 'grid-cols-1' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'}`}>
                                            {(typeof currentStructure.positions === 'function' ? currentStructure.positions(shelf) : currentStructure.positions).map((pos: string) => {
                                                // --- LOC ID GEN ---
                                                let locId: string;
                                                if (activeWarehouse === 'REP') locId = `REP-E-${shelf}-B1-${pos}`;
                                                else if (activeWarehouse === 'SXP') locId = `SXP-E1-B1-${pos}`;
                                                else if (activeWarehouse === 'PIN') locId = `PIN-E-${shelf}-B1-${pos}`;
                                                else if (activeWarehouse === 'COM') locId = `COM-E1-B1-${pos}`;
                                                else if (activeWarehouse === 'RPL') {
                                                    const shelfIdNum = shelf === 'EST1' ? 1 : 2;
                                                    locId = `RPL-E${shelfIdNum}-B1-${pos}`;
                                                }
                                                else if (activeWarehouse === 'SOL') {
                                                    const shelfNum = shelf === '1' ? 1 : 2;
                                                    locId = `SOL-E${shelfNum}-B1-${pos}`;
                                                }
                                                else if (activeWarehouse === 'RSO') locId = `RSO-E1-B1-${pos}`;
                                                else if (activeWarehouse === 'MEC') locId = `MEC-E-${shelf}-B1-${pos}`;
                                                else if (activeWarehouse === 'PLE') locId = `PLE-E1-B1-${pos}`;
                                                else if (activeWarehouse === 'CAL') {
                                                    locId = shelf === 'RECHAZOS' ? `CAL-E-RECHAZOS-B1-${pos}` : `CAL-E-GENERAL-B1-${pos}`;
                                                }

                                                else if (activeWarehouse === 'ZIN') locId = `ZIN-E1-B${rack}-1`;
                                                else locId = `${activeWarehouse}-E${shelf}-B${rack}-${pos}`;

                                                const finalLocId = locId as LocationId;
                                                // --- END LOC ID ---

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
                                                            {(activeWarehouse === 'ZIN') ? `Balda ${rack}` : pos}
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
                                ))}
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
