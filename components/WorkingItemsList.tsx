import React, { useState } from 'react';
import { useWorkingItems } from '../hooks/useWorkingItems';
import { DEFAULT_WAREHOUSE_NAMES, LocationId, WorkingItem, formatLocation } from '../lib/warehouseData';
import { LoadingIcon, BoxIcon, BellIcon, MoveIcon } from './Icons';
import { useAppStore } from '../lib/store';
import { generateLayoutLocations, isValidLayoutLocation } from '../lib/warehouseLayout';
import AddMethodModal from './AddMethodModal';
import PhotoAnalyzerModal from './PhotoAnalyzerModal';
import ManualEntryModal from './ManualEntryModal';

interface WorkingItemsListProps {
    userRole: string;
    notifyFinishedItem: (barcode: string, location: string, orderId: string) => void;
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

const WorkingItemsList: React.FC<WorkingItemsListProps> = ({ userRole, notifyFinishedItem }) => {
    const { workingItems, loading, finishItem, locateItem } = useWorkingItems();
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [locatingKey, setLocatingKey] = useState<string | null>(null);
    const [targetWarehouseByItem, setTargetWarehouseByItem] = useState<Record<string, string>>({});
    const [targetLocationByItem, setTargetLocationByItem] = useState<Record<string, LocationId>>({});
    const [locateValidationItem, setLocateValidationItem] = useState<WorkingItem | null>(null);
    const [showLocatePhoto, setShowLocatePhoto] = useState(false);
    const [showLocateManual, setShowLocateManual] = useState(false);
    const { notify } = useAppStore();

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

    const duplicatedByBarcode = Object.entries(
        workingItems.reduce((acc, item) => {
            if (!acc[item.barcode]) acc[item.barcode] = new Set<string>();
            acc[item.barcode].add(item.orderId);
            return acc;
        }, {} as Record<string, Set<string>>)
    )
        .filter(([, orderIds]) => orderIds.size > 1)
        .map(([barcode, orderIds]) => ({ barcode, orderIds: Array.from(orderIds).sort() }));



    const handleFinishAndNotify = async (item: WorkingItem) => {
        if (processingId) return;
        const confirmed = window.confirm(`Confirmar finalizacion de ${item.barcode} (OF: ${item.orderId}) y aviso al carretillero.`);
        if (!confirmed) return;
        const key = item.itemKey || `${item.barcode}-${item.orderId}`;
        setProcessingId(key);
        try {
            // 1. Notify Carretillero
            if (item.fromLocationId) {
                notifyFinishedItem(item.barcode, item.fromLocationId, item.orderId);
            }

            // 2. Finish Item
            await finishItem(item, { uid: 'user', displayName: 'Usuario' });
        } catch (error) {
            console.error(error);
            alert("Error al finalizar el artículo.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleFinishAndLocate = async (item: WorkingItem) => {
        if (processingId) return;
        const key = item.itemKey || `${item.barcode}-${item.orderId}`;
        const targetLocation = targetLocationByItem[key];
        if (!targetLocation || !isValidLayoutLocation(targetLocation)) {
            alert('Selecciona una ubicación de destino válida.');
            return;
        }

        setProcessingId(key);
        try {
            await locateItem(item, targetLocation, { uid: 'user', displayName: 'Usuario' });
            notify('success', 'Reubicado', `${item.barcode} ubicado en ${formatLocation(targetLocation)}.`);
        } catch (error) {
            console.error(error);
            alert("Error al ubicar el artículo.");
        } finally {
            setProcessingId(null);
            setLocatingKey(null);
        }
    };

    const initializeLocateTarget = (item: WorkingItem) => {
        const key = item.itemKey || `${item.barcode}-${item.orderId}`;
        if (targetLocationByItem[key]) return;

        const defaultWarehouse = item.fromLocationId?.split('-')[0] || 'MEC';
        const locations = generateLayoutLocations(defaultWarehouse);

        setTargetWarehouseByItem(prev => ({ ...prev, [key]: defaultWarehouse }));
        if (locations.length > 0) {
            setTargetLocationByItem(prev => ({ ...prev, [key]: locations[0] }));
        }
    };

    const validateLocateIdentity = (item: WorkingItem, barcode: string, orderId: string) => {
        const sameBarcode = item.barcode.trim().toUpperCase() === barcode.trim().toUpperCase();
        const sameOrder = item.orderId.trim().toUpperCase() === orderId.trim().toUpperCase();
        if (!sameBarcode || !sameOrder) {
            notify('error', 'No coincide', `La lectura no coincide con ${item.barcode} / ${item.orderId}.`);
            return false;
        }
        return true;
    };

    const openLocateAfterValidation = (item: WorkingItem) => {
        const key = item.itemKey || `${item.barcode}-${item.orderId}`;
        initializeLocateTarget(item);
        setLocatingKey(key);
        setLocateValidationItem(null);
        setShowLocateManual(false);
        setShowLocatePhoto(false);
    };

    const handleLocateManualSubmit = (barcode: string, orderId: string) => {
        if (!locateValidationItem) return;
        if (!validateLocateIdentity(locateValidationItem, barcode, orderId)) return;
        openLocateAfterValidation(locateValidationItem);
    };

    const handleLocatePhotoExtracted = (result: string | { article: string; order: string }) => {
        if (!locateValidationItem) return;
        const extracted = typeof result === 'string'
            ? { article: result, order: '' }
            : result;

        if (!validateLocateIdentity(locateValidationItem, extracted.article || '', extracted.order || '')) {
            return;
        }
        openLocateAfterValidation(locateValidationItem);
    };

    // Check for duplicates in Working Items (Same barcode, different OF)
    const getDuplicateWarning = (item: WorkingItem) => {
        const duplicates = workingItems.filter(i => i.barcode === item.barcode && i.orderId !== item.orderId);
        if (duplicates.length > 0) {
            return duplicates.map(d => d.orderId).join(', ');
        }
        return null;
    };

    return (
        <div className="p-4 pb-20 space-y-8 animate-fade-in">
            {duplicatedByBarcode.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
                    <p className="font-bold mb-1">Atencion: articulos en fabricacion con OF distintas</p>
                    <div className="space-y-0.5 text-xs md:text-sm">
                        {duplicatedByBarcode.map(item => (
                            <p key={item.barcode}>
                                <strong>{item.barcode}</strong>: {item.orderIds.join(', ')}
                            </p>
                        ))}
                    </div>
                </div>
            )}
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

                                        {/* Duplicate OF Warning */}
                                        {(() => {
                                            const otherOFs = getDuplicateWarning(item);
                                            if (otherOFs) {
                                                return (
                                                    <div className="mt-2 text-[10px] md:text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-1.5 rounded-lg border border-red-200 dark:border-red-800 flex items-start gap-1.5">
                                                        <span className="text-base">⚠️</span>
                                                        <span>
                                                            <strong>Mismo artículo en OF distintas:</strong> esta referencia también está activa en <strong>{otherOFs}</strong>
                                                        </span>
                                                    </div>
                                                );
                                            }
                                        })()}
                                    </div>

                                    <div className="ml-4">
                                        <div className="ml-4 flex flex-col gap-2">
                                            {/* Button 1: Finish & Notify */}
                                            <button
                                                onClick={() => handleFinishAndNotify(item)}
                                                disabled={isProcessing}
                                                className={`
                                                flex items-center w-full justify-center gap-2 px-3 py-2 rounded-lg font-bold text-xs shadow-sm transition-all
                                                ${isProcessing
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200 active:scale-95 border border-amber-200'}
                                            `}
                                            >
                                                {isProcessing ? (
                                                    <LoadingIcon className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <BellIcon className="h-4 w-4" />
                                                        Terminar trabajo y avisar al carretillero
                                                    </>
                                                )}
                                            </button>

                                            {/* Button 2: Finish & Locate */}
                                            <button
                                                onClick={() => {
                                                    const key = item.itemKey || `${item.barcode}-${item.orderId}`;
                                                    if (locatingKey === key) {
                                                        setLocatingKey(null);
                                                        return;
                                                    }
                                                    setLocateValidationItem(item);
                                                }}
                                                disabled={isProcessing}
                                                className={`
                                                flex items-center w-full justify-center gap-2 px-3 py-2 rounded-lg font-bold text-xs shadow-sm transition-all
                                                ${isProcessing
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 shadow-indigo-900/20'}
                                            `}
                                            >
                                                {isProcessing ? (
                                                    <LoadingIcon className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <MoveIcon className="h-4 w-4" />
                                                        Terminar y Ubicar
                                                    </>
                                                )}
                                            </button>

                                            {locatingKey === (item.itemKey || `${item.barcode}-${item.orderId}`) && (
                                                <div className="p-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white/90 dark:bg-slate-900/70 grid gap-2">
                                                    <select
                                                        value={targetWarehouseByItem[item.itemKey || `${item.barcode}-${item.orderId}`] || 'MEC'}
                                                        onChange={(e) => {
                                                            const key = item.itemKey || `${item.barcode}-${item.orderId}`;
                                                            const selectedWarehouse = e.target.value;
                                                            const locations = generateLayoutLocations(selectedWarehouse);
                                                            setTargetWarehouseByItem(prev => ({ ...prev, [key]: selectedWarehouse }));
                                                            if (locations.length > 0) {
                                                                setTargetLocationByItem(prev => ({ ...prev, [key]: locations[0] }));
                                                            }
                                                        }}
                                                        className="w-full px-2 py-1.5 text-[11px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                                    >
                                                        {Object.entries(DEFAULT_WAREHOUSE_NAMES).map(([code, name]) => (
                                                            <option key={code} value={code}>{name}</option>
                                                        ))}
                                                    </select>

                                                    <select
                                                        value={targetLocationByItem[item.itemKey || `${item.barcode}-${item.orderId}`] || ''}
                                                        onChange={(e) => {
                                                            const key = item.itemKey || `${item.barcode}-${item.orderId}`;
                                                            setTargetLocationByItem(prev => ({ ...prev, [key]: e.target.value as LocationId }));
                                                        }}
                                                        className="w-full px-2 py-1.5 text-[11px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                                    >
                                                        {generateLayoutLocations(targetWarehouseByItem[item.itemKey || `${item.barcode}-${item.orderId}`] || 'MEC').map((loc) => (
                                                            <option key={loc} value={loc}>{formatLocation(loc)}</option>
                                                        ))}
                                                    </select>

                                                    <button
                                                        onClick={() => handleFinishAndLocate(item)}
                                                        disabled={isProcessing || !targetLocationByItem[item.itemKey || `${item.barcode}-${item.orderId}`]}
                                                        className="w-full px-2 py-1.5 text-[11px] rounded-md font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400"
                                                    >
                                                        Confirmar ubicación
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
            {locateValidationItem && !showLocatePhoto && !showLocateManual && (
                <AddMethodModal
                    title="Validar Articulo para Ubicar"
                    subtitle={`${locateValidationItem.barcode} | ${locateValidationItem.orderId}`}
                    onSelectPhoto={() => setShowLocatePhoto(true)}
                    onSelectManual={() => setShowLocateManual(true)}
                    onClose={() => setLocateValidationItem(null)}
                />
            )}

            {showLocatePhoto && locateValidationItem && (
                <PhotoAnalyzerModal
                    mode="combined"
                    instruction="Foto para ubicar: Art + OF"
                    onCodeExtracted={handleLocatePhotoExtracted}
                    onClose={() => {
                        setShowLocatePhoto(false);
                        setLocateValidationItem(null);
                    }}
                />
            )}

            {showLocateManual && locateValidationItem && (
                <ManualEntryModal
                    onSubmit={handleLocateManualSubmit}
                    onClose={() => {
                        setShowLocateManual(false);
                        setLocateValidationItem(null);
                    }}
                />
            )}
        </div>
    );
};

export default WorkingItemsList;
