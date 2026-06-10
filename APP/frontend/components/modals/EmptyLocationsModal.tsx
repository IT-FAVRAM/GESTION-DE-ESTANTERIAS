import React, { useState, useMemo } from 'react';
import { Assignments, LocationId, WarehouseCode, formatLocation } from '../lib/warehouseData';
import { CloseIcon, TrashIcon, CheckIcon } from './Icons';
import { generateLayoutLocations } from '../lib/warehouseLayout';

interface EmptyLocationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeWarehouseId: WarehouseCode;
    assignments: Assignments;
    onConfirm: (selectedLocationIds: string[]) => Promise<void>;
}

const EmptyLocationsModal: React.FC<EmptyLocationsModalProps> = ({
    isOpen,
    onClose,
    activeWarehouseId,
    assignments,
    onConfirm
}) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Generate all locations from central layout source
    const warehouseLocations = useMemo(() => {
        const locations: { id: LocationId, code: string, count: number, isOccupied: boolean }[] = [];

        const addLoc = (id: LocationId) => {
            const locId = id as LocationId;
            const items = assignments[locId] || [];
            locations.push({
                id: locId,
                code: formatLocation(locId),
                count: items.length,
                isOccupied: items.length > 0
            });
        };

        generateLayoutLocations(activeWarehouseId).forEach(addLoc);

        return locations;
    }, [activeWarehouseId, assignments]);

    const occupiedLocations = useMemo(() => warehouseLocations.filter(l => l.isOccupied), [warehouseLocations]);

    const handleSelectAll = () => {
        setSelectedIds(occupiedLocations.map(l => l.id));
    };

    const handleDeselectAll = () => {
        setSelectedIds([]);
    };

    const toggleLocation = (id: string, isOccupied: boolean) => {
        if (!isOccupied) return;
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleConfirm = async () => {
        if (selectedIds.length === 0) return;
        setIsProcessing(true);
        try {
            await onConfirm(selectedIds);
            onClose();
        } catch (err) {
            console.error("Error confirmando limpieza:", err);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <TrashIcon className="h-6 w-6 text-red-500" /> VACIAR UBICACIONES (ADMIN)
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Sección actual: <span className="font-bold text-cyan-600 uppercase">{activeWarehouseId}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-colors shadow-sm">
                        <CloseIcon className="h-6 w-6 text-slate-400" />
                    </button>
                </div>

                {/* Controls */}
                <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex gap-2">
                        <button
                            onClick={handleSelectAll}
                            className="px-4 py-2 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 text-sm font-bold rounded-xl hover:bg-cyan-100 transition-colors border border-cyan-100 dark:border-cyan-800"
                        >
                            Seleccionar todo
                        </button>
                        <button
                            onClick={handleDeselectAll}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors border border-slate-200 dark:border-slate-700"
                        >
                            Deseleccionar todo
                        </button>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-xl border border-blue-100 dark:border-blue-800 font-bold text-sm">
                        Seleccionadas: {selectedIds.length}
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-grow overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-900/30">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {warehouseLocations.map(loc => {
                            const isSelected = selectedIds.includes(loc.id);
                            return (
                                <div
                                    key={loc.id}
                                    onClick={() => toggleLocation(loc.id, loc.isOccupied)}
                                    className={`
                                        p-3 rounded-2xl border-2 transition-all cursor-pointer relative group
                                        ${!loc.isOccupied ? 'bg-slate-100/50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800 opacity-50 cursor-not-allowed' : ''}
                                        ${loc.isOccupied && !isSelected ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-cyan-300 hover:shadow-md' : ''}
                                        ${isSelected ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-500 shadow-md ring-2 ring-cyan-500/20' : ''}
                                    `}
                                >
                                    <div className="flex flex-col h-full justify-between">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${isSelected ? 'bg-cyan-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                                                {loc.code}
                                            </span>
                                            {isSelected && <CheckIcon className="h-4 w-4 text-cyan-500" />}
                                        </div>
                                        <div>
                                            <p className={`text-[10px] font-bold ${loc.isOccupied ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                                                {loc.isOccupied ? `${loc.count} ${loc.count === 1 ? 'ARTÍCULO' : 'ARTÍCULOS'}` : 'VACÍA'}
                                            </p>
                                            <p className={`text-[9px] mt-0.5 font-mono ${isSelected ? 'text-cyan-600/60' : 'text-slate-300 dark:text-slate-600'}`}>
                                                {loc.id.split('-').pop()}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Selection Overlay for hover visibility */}
                                    {loc.isOccupied && !isSelected && (
                                        <div className="absolute inset-0 bg-cyan-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                    <p className="text-xs text-slate-500 max-w-[50%] underline decoration-dotted underline-offset-4">
                        * Esta acción vaciará completamente las ubicaciones seleccionadas y registrará el movimiento en el historial administrativo.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 text-sm font-bold text-rose-600 hover:text-rose-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={selectedIds.length === 0 || isProcessing}
                            className={`
                                px-8 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg
                                ${selectedIds.length > 0 && !isProcessing
                                    ? 'bg-red-600 text-white hover:bg-red-700 hover:-translate-y-0.5 active:translate-y-0 shadow-red-200 dark:shadow-red-900/20'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                            `}
                        >
                            {isProcessing ? 'Vaciando...' : `Confirmar Vaciado (${selectedIds.length})`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmptyLocationsModal;


