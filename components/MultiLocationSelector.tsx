

import React, { useState, useMemo, useEffect } from 'react';
import { Assignments, LocationId } from '../lib/warehouseData';
import { WarehouseConfig } from '../hooks/useWarehouseConfig';
import { CloseIcon, CheckIcon, MapIcon, InfoIcon } from './Icons';

interface MultiLocationSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (locations: LocationId[]) => void;
    assignments: Assignments;
    config: WarehouseConfig;
}

const MultiLocationSelector: React.FC<MultiLocationSelectorProps> = ({
    isOpen,
    onClose,
    onConfirm,
    assignments,
    config
}) => {
    const [selectedLocations, setSelectedLocations] = useState<LocationId[]>([]);
    const [activeWarehouse, setActiveWarehouse] = useState<string>(config.warehouses[0]?.code || '');
    const [activeShelfTab, setActiveShelfTab] = useState<string | number>('');

    const currentStructure = useMemo(() => {
        const pad3 = (n: number) => n.toString().padStart(3, '0');

        if (activeWarehouse === 'MEC') {
            return {
                shelves: ['URGENTE', 'GENERAL'],
                racks: [1],
                positions: (shelf: string | number) => {
                    if (shelf === 'URGENTE') return Array.from({ length: 4 }, (_, i) => `MEC ${pad3(i + 1)}`);
                    return Array.from({ length: 18 }, (_, i) => `MEC ${pad3(i + 5)}`);
                }
            };
        }
        if (activeWarehouse === 'PLE') {
            return {
                shelves: ['EST_1_URGENTE', 'EST_1_GENERAL', 'EST_2', 'PUNZONADORA'],
                racks: [1],
                positions: (shelf: string | number) => {
                    if (shelf === 'EST_1_URGENTE') return Array.from({ length: 6 }, (_, i) => `PLE ${pad3(i + 1)}`);
                    if (shelf === 'EST_1_GENERAL') return Array.from({ length: 10 }, (_, i) => `PLE ${pad3(i + 7)}`);
                    if (shelf === 'EST_2') return Array.from({ length: 16 }, (_, i) => `PLE ${pad3(i + 17)}`);
                    if (shelf === 'PUNZONADORA') return Array.from({ length: 21 }, (_, i) => `PLE ${pad3(i + 33)}`);
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
        if (activeWarehouse === 'ZIN') {
            return {
                shelves: ['1'],
                racks: [1, 2, 3, 4, 5],
                positions: () => ['1']
            };
        }
        if (activeWarehouse === 'RSO') {
            return {
                shelves: ['1'],
                racks: [1],
                positions: () => ['ROB.SOL 001', 'ROB.SOL 002', 'ROB.SOL 003', 'ROB.SOL 004', 'ROB.SOL 005', 'ROB.SOL 006', 'ROB.SOL 007', 'ROB.SOL 008']
            };
        }

        return {
            shelves: config.shelves,
            racks: config.racks,
            positions: () => config.positions
        };
    }, [activeWarehouse, config]);

    useEffect(() => {
        if (currentStructure.shelves.length > 0) {
            setActiveShelfTab(currentStructure.shelves[0]);
        }
    }, [currentStructure]);

    const handleToggleLocation = (locId: LocationId) => {
        setSelectedLocations(prev => {
            if (prev.includes(locId)) {
                return prev.filter(id => id !== locId);
            } else {
                return [...prev, locId];
            }
        });
    };

    const shelfDisplayName = (shelf: string | number) => {
        if (activeWarehouse === 'MEC' && shelf === 'URGENTE') return 'URGENTE';
        if (activeWarehouse === 'MEC' && shelf === 'GENERAL') return 'GENERAL';
        if (String(shelf).includes('URGENTE')) return 'URGENTE';
        return typeof shelf === 'number' ? `Estantería ${shelf}` : shelf;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-white md:bg-black/90 z-50 flex items-center justify-center md:p-4" role="dialog" aria-modal="true">
            <div className="relative w-full h-full md:h-auto md:max-w-6xl bg-white dark:bg-slate-900 md:rounded-2xl shadow-2xl flex flex-col max-h-full md:max-h-[90vh] overflow-hidden">

                {/* Header */}
                <header className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <MapIcon className="h-6 w-6 text-cyan-600" />
                            Ocupar Varias Ubicaciones
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Selecciona los huecos <span className="font-bold text-green-600 dark:text-green-400">VACÍOS</span>.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-full transition-colors">
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </header>

                {/* Warehouse Tabs */}
                <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
                    <div className="overflow-x-auto smooth-scroll no-scrollbar flex p-2 gap-2 snap-x">
                        {config.warehouses.map(wh => (
                            <button
                                key={wh.code}
                                onClick={() => setActiveWarehouse(wh.code)}
                                className={`flex-shrink-0 px-4 py-2 text-sm font-medium transition-all rounded-lg whitespace-nowrap snap-start border
                    ${activeWarehouse === wh.code
                                        ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800 shadow-sm'
                                        : 'bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                                    }`}
                            >
                                {wh.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Shelf Tabs (If applicable) */}
                {currentStructure.shelves.length > 1 && (
                    <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-black/20 p-2 flex flex-wrap justify-center gap-2 shrink-0">
                        {currentStructure.shelves.map(shelf => (
                            <button
                                key={shelf}
                                onClick={() => setActiveShelfTab(shelf)}
                                className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all border
                        ${activeShelfTab === shelf
                                        ? 'bg-cyan-600 text-white border-cyan-600 shadow'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}
                        `}
                            >
                                {shelfDisplayName(shelf)}
                            </button>
                        ))}
                    </div>
                )}

                {/* Grid Content */}
                <div className="overflow-y-auto p-4 flex-grow bg-slate-50 dark:bg-black/10">
                    {/* Render active shelf */}
                    {(() => {
                        const shelf = activeShelfTab;
                        const racks = Array.isArray(currentStructure.racks) ? currentStructure.racks : (currentStructure.racks as Function)(shelf);

                        return (
                            <div className="space-y-6 pb-20">
                                {racks.map((rack: number) => (
                                    <div key={`${activeWarehouse}-E${shelf}-B${rack}`} className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                                        {(racks.length > 1 || activeWarehouse === 'PIN') && (
                                            <h5 className="text-xs font-bold text-slate-400 mb-3 uppercase border-b border-slate-100 dark:border-slate-800 pb-1">
                                                {activeWarehouse === 'ZIN' ? `Balda ${rack}` : `Rack ${rack}`}
                                            </h5>
                                        )}
                                        <div className={`grid gap-3 ${activeWarehouse === 'ZIN' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'}`}>
                                            {(typeof currentStructure.positions === 'function' ? currentStructure.positions(shelf) : currentStructure.positions).map((pos: string) => {
                                                // Generación de LocationId (Logic reutilizada)
                                                let locId;
                                                const pad3 = (n: number) => n.toString().padStart(3, '0');

                                                if (activeWarehouse === 'MEC') locId = shelf === 'URGENTE' ? `MEC-E-URGENTE-B1-${pos}` : `MEC-E-GENERAL-B1-${pos}`;
                                                else if (activeWarehouse === 'PRE') locId = `PRE-E1-B1-${pos}`;
                                                else if (activeWarehouse === 'SXP') locId = `SXP-E1-B1-${pos}`;
                                                else if (activeWarehouse === 'PIN') locId = `PIN-E-${shelf}-B1-${pos}`;
                                                else if (activeWarehouse === 'REP') locId = `REP-E-${shelf}-B1-${pos}`;
                                                else if (activeWarehouse === 'SOL') {
                                                    const shelfNum = shelf === '1' ? 1 : 2;
                                                    locId = `SOL-E${shelfNum}-B1-${pos}`;
                                                }
                                                else if (activeWarehouse === 'COM') {
                                                    locId = `COM-E1-B1-${pos}`;
                                                }
                                                else if (activeWarehouse === 'RPL') {
                                                    const shelfIdNum = shelf === 'EST1' ? 1 : 2;
                                                    locId = `RPL-E${shelfIdNum}-B1-${pos}`;
                                                }
                                                else if (activeWarehouse === 'CAL') {
                                                    if (shelf === 'RECHAZOS') locId = `CAL-E-RECHAZOS-B1-${pos}`;
                                                    else locId = `CAL-E-GENERAL-B1-${pos}`;
                                                }
                                                else if (activeWarehouse === 'ZIN') locId = `ZIN-E1-B${rack}-1`;
                                                else if (activeWarehouse === 'RSO') locId = `RSO-E1-B1-${pos}`;
                                                else locId = `${activeWarehouse}-E${shelf}-B${rack}-${pos}`;

                                                const locationId = locId as LocationId;
                                                const occupiedItems = assignments[locationId] || [];
                                                const isOccupied = occupiedItems.length > 0;
                                                const isSelected = selectedLocations.includes(locationId);

                                                return (
                                                    <button
                                                        key={locationId}
                                                        onClick={() => !isOccupied && handleToggleLocation(locationId)}
                                                        disabled={isOccupied}
                                                        className={`
                                        p-3 rounded-xl min-h-[80px] text-left border-2 transition-all duration-200 flex flex-col justify-between relative overflow-hidden touch-manipulation
                                        ${isOccupied
                                                                ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed grayscale'
                                                                : isSelected
                                                                    ? 'bg-cyan-50 dark:bg-cyan-900/40 border-cyan-500 ring-2 ring-cyan-400 z-10 transform scale-[1.02]'
                                                                    : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-cyan-300 dark:hover:border-cyan-700'
                                                            }
                                    `}
                                                    >
                                                        <div className="flex justify-between w-full mb-1">
                                                            <span className="font-bold text-xs">{pos.replace(`${activeWarehouse} `, '')}</span>
                                                            {isSelected && <div className="bg-cyan-500 text-white rounded-full p-0.5"><CheckIcon className="h-3 w-3" /></div>}
                                                        </div>

                                                        <div className="flex-grow flex items-center justify-center w-full">
                                                            {isOccupied ? (
                                                                <div className="flex flex-col items-center">
                                                                    <InfoIcon className="h-4 w-4 text-slate-400 mb-1" />
                                                                    <span className="text-[10px] text-slate-400 font-medium">Ocupado</span>
                                                                </div>
                                                            ) : (
                                                                <span className={`text-xs font-bold ${isSelected ? 'text-cyan-600 dark:text-cyan-300' : 'text-green-500'}`}>
                                                                    {isSelected ? 'Seleccionado' : 'Disponible'}
                                                                </span>
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

                {/* Footer */}
                <footer className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 flex gap-3 shrink-0 safe-area-inset-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onConfirm(selectedLocations)}
                        disabled={selectedLocations.length === 0}
                        className="flex-[2] py-4 bg-cyan-600 text-white font-bold rounded-xl shadow-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <span>CONTINUAR</span>
                        {selectedLocations.length > 0 && (
                            <span className="bg-white text-cyan-600 px-2 py-0.5 rounded-full text-xs font-black">
                                {selectedLocations.length}
                            </span>
                        )}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default MultiLocationSelector;