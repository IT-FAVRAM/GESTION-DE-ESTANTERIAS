import React from 'react';
import { CloseIcon, BoxIcon, CheckIcon } from './Icons';
import { PackageType } from '../lib/warehouseData';

interface PackageTypeModalProps {
    onSelect: (type: PackageType) => void;
    onClose: () => void;
}

const PACKAGE_OPTIONS: { type: PackageType; label: string; emoji: string; color: string }[] = [
    { type: 'PALLET', label: 'Pallet', emoji: '📦', color: 'bg-amber-500' },
    { type: 'CAJA_GRANDE', label: 'Caja Grande', emoji: '🗃️', color: 'bg-cyan-500' },
    { type: 'CAJA_PEQUENA', label: 'Caja Pequeña', emoji: '📋', color: 'bg-indigo-500' },
];

const PackageTypeModal: React.FC<PackageTypeModalProps> = ({ onSelect, onClose }) => {
    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">Tipo de Embalaje</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <CloseIcon className="h-6 w-6 text-slate-500" />
                    </button>
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Selecciona cómo está embalado el artículo:</p>

                <div className="grid grid-cols-1 gap-3">
                    {PACKAGE_OPTIONS.map(opt => (
                        <button
                            key={opt.type}
                            onClick={() => onSelect(opt.type)}
                            className={`flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-500 bg-slate-50 dark:bg-slate-800 transition-all active:scale-[0.98]`}
                        >
                            <span className={`text-3xl h-14 w-14 flex items-center justify-center rounded-xl ${opt.color}/20`}>{opt.emoji}</span>
                            <div className="text-left">
                                <p className="font-bold text-slate-800 dark:text-white text-lg">{opt.label}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{opt.type.replace('_', ' ')}</p>
                            </div>
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-6 py-3 text-slate-500 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
};

export default PackageTypeModal;


