








import React, { useMemo, useState } from 'react';
import { Assignments, AssignmentItem, LocationId, WarehouseCode, ShelfNumber, formatLocation, isUrgentLocation, WorkingItem, WAREHOUSE_TO_SECTION, getSectionFromLocation } from '../lib/warehouseData';
import { WarehouseConfig } from '../hooks/useWarehouseConfig';
import { TrashIcon, PlusCircleIcon, MoveIcon, InfoIcon, ListIcon, ShoppingCartIcon, ChevronDownIcon, ChevronUpIcon, ChevronRightIcon, BellIcon, LoadingIcon, CheckIcon, LayersIcon, SettingsIcon, CopyIcon } from './Icons';
import { useRoles } from '../hooks/useRoles';
import { can } from '../lib/permissionMatrix';
import { CartWarehouseView } from './CartWarehouseView';
import { useWorkingItems } from '../hooks/useWorkingItems';
import { generateLayoutLocations } from '../lib/warehouseLayout';
import AddMethodModal from './AddMethodModal';
import PhotoAnalyzerModal from './PhotoAnalyzerModal';
import ManualEntryModal from './ManualEntryModal';

interface AssignmentListProps {
    assignments: Assignments;
    workingItems?: WorkingItem[]; // New prop
    activeWarehouse: WarehouseCode;
    config: WarehouseConfig;
    searchQuery: string;
    searchResults: { location: LocationId; item: AssignmentItem }[];
    showEmptyOnly: boolean;
    itemToCopy: { barcode: string; fromLocation: LocationId; orderId?: string } | null;
    onInitiateCopy: (barcode: string, fromLocation: LocationId, orderId?: string) => void;
    onPasteItem: (location: LocationId) => void;
    itemToMove: { barcode: string; fromLocation: LocationId; orderId?: string } | null;
    onInitiateMove: (barcode: string, fromLocation: LocationId, orderId?: string) => void;
    onPasteMovedItem: (location: LocationId) => void;
    itemPendingDeletion: { barcode: string; location: LocationId; orderId?: string } | null;
    onInitiateDelete: (barcode: string, location: LocationId, orderId?: string) => void;
    onConfirmDelete: () => void;
    onCancelDelete: () => void;
    onInitiateEmptyShelf: (warehouse: WarehouseCode, shelf: ShelfNumber) => void;
    onInitiateValidationFlow: (locationId: LocationId) => void;
    onDirectAssign: (barcode: string, orderId: string, location: LocationId) => void;
    onDirectRemove: (barcode: string, location: LocationId, orderId: string) => void;
    onViewLocationDetails: (locationId: LocationId) => void;
    onDragMove?: (barcode: string, fromLocation: LocationId, toLocation: LocationId) => void;
    onInitiateRelocate: (locationId: LocationId) => void;
    onInitiateRequest?: (barcode: string, orderId: string, fromLocation: LocationId) => void; // New prop
    onNotifyFinishedItem?: (barcode: string, location: string, orderId: string) => void;
    collapsedShelves?: Record<string, boolean>;
    onToggleShelf?: (shelfId: string) => void;
    onToggleAllShelves?: (collapsed: boolean) => void;
    userRole: string | null;
    canAssign: () => boolean;
    canRemove: (locationId?: string) => boolean;
    canRequestItems?: () => boolean; // New prop
    viewMode?: 'grid' | 'list'; // New prop
}

const formatDate = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

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

// Optimization: Memoized Item Card
const AssignedItemCardReal = React.memo(({ item, location, onInitiateCopy, isCopying, onInitiateMove, isMoving, onInitiateDelete, onConfirmDelete, onCancelDelete, isPendingDeletion, userRole, canAssign, canRemove, canRequestItems, onInitiateRequest }: any) => {
    const canDrag = can(userRole, 'dragMove');

    // Verify permission for this specific location
    const canDeleteThis = canRemove(location);
    const canRequest = canRequestItems && canRequestItems();

    const handleDragStart = (e: React.DragEvent) => {
        if (!canDrag) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('application/json', JSON.stringify({
            barcode: item.barcode,
            fromLocation: location
        }));
        e.dataTransfer.effectAllowed = 'move';
    };

    // Status-based styling for clear visual differentiation
    const getStatusStyles = () => {
        const status = item.status || 'UBICADO';
        switch (status) {
            case 'EN_TRABAJO':
                return 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 border-l-4';
            case 'FINALIZADO':
                return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 border-l-4';
            default: // UBICADO
                return 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700';
        }
    };

    return (
        <div
            draggable={!isPendingDeletion && canDrag}
            onDragStart={handleDragStart}
            className={`p-2 md:p-4 rounded-xl mb-2 md:mb-3 transition-all duration-200 border shadow-sm 
            ${isCopying ? 'ring-2 ring-cyan-400 bg-cyan-50' : ''} 
            ${isMoving ? 'ring-2 ring-blue-400 bg-blue-50' : ''} 
            ${isPendingDeletion ? 'bg-red-50 ring-2 ring-red-500' : getStatusStyles()}
            ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
            `}
        >
            <div className="flex justify-between items-start gap-2 md:gap-3">
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {/* Package Type Emoji */}
                        {item.packageType && (
                            <span className="text-lg" title={item.packageType.replace('_', ' ')}>
                                {item.packageType === 'PALLET' ? '📦' : item.packageType === 'CAJA_GRANDE' ? '🗃️' : '📋'}
                            </span>
                        )}
                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">ART</span>
                        <p className="font-bold text-sm md:text-base text-cyan-700 dark:text-cyan-400 break-all">{item.barcode}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">OF</span>
                        <p className="text-xs md:text-sm font-mono text-slate-600 dark:text-slate-300 truncate">{item.orderId}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-[10px] md:text-xs text-slate-400">{formatDate(item.timestamp)}</p>
                        {/* Status Badge - Always visible with clear differentiation */}
                        <span className={`text-[10px] md:text-xs font-bold px-2 py-1 rounded-lg uppercase flex items-center gap-1 ${item.status === 'EN_TRABAJO'
                            ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200 ring-1 ring-indigo-300 dark:ring-indigo-700'
                            : item.status === 'FINALIZADO'
                                ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-300 dark:ring-emerald-700'
                                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                            }`}>
                            {item.status === 'EN_TRABAJO' ? '🔧 Trabajo' : item.status === 'FINALIZADO' ? '✅ Listo' : '📍 Ubicado'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {isPendingDeletion ? (
                        <div className="flex flex-col gap-2">
                            <button
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); onConfirmDelete(); }}
                                className="px-3 py-2 text-xs bg-red-600 text-white font-bold rounded-lg shadow z-10 relative touch-manipulation"
                            >
                                Confirmar
                            </button>
                            <button
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); onCancelDelete(); }}
                                className="px-3 py-2 text-xs bg-slate-200 text-slate-800 font-semibold rounded-lg z-10 relative touch-manipulation"
                            >
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-1">
                            {canRequest && (
                                <button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); onInitiateRequest(item.barcode, item.orderId, location); }}
                                    className="p-2 md:p-3 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors z-10 relative touch-manipulation"
                                    aria-label="Solicitar"
                                    title="Solicitar Material"
                                >
                                    <BellIcon className="h-5 w-5" />
                                </button>
                            )}

                            {canDeleteThis && (
                                <button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); onInitiateDelete(item.barcode, location, item.orderId); }}
                                    className="p-2 md:p-3 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors z-10 relative touch-manipulation"
                                    aria-label="Eliminar"
                                >
                                    <TrashIcon className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

// Specialized row for Carts to match "Carro SXP" style but using standard assignments
const CartShelfRow = React.memo(({ label, locId, assignments, onAdd, onViewDetails, canAssign }: any) => {
    const items = assignments[locId] || [];
    const count = items.length;

    return (
        <div className="border p-3 rounded-xl shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
                <p className="font-bold text-slate-600 dark:text-slate-400 text-sm">{label}</p>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full ${count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                        {count} {count === 1 ? 'item' : 'items'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono hidden md:inline">{locId.split('-').pop()}</span>
                </div>
            </div>
            <div className="flex gap-3">
                <button
                    onClick={() => onViewDetails(locId)}
                    className="flex-1 h-14 md:h-16 flex items-center justify-center gap-2 text-slate-500 hover:text-cyan-600 bg-slate-50 hover:bg-slate-100 rounded-lg touch-manipulation border border-slate-100 transition-colors"
                >
                    <ListIcon className="h-4 w-4" />
                    <span className="font-semibold text-xs md:text-sm">Ver Lista</span>
                </button>
                {canAssign() && (
                    <button
                        onClick={() => onAdd(locId)}
                        className="flex-1 h-14 md:h-16 flex items-center justify-center gap-2 text-cyan-600 bg-cyan-50 hover:bg-cyan-100 rounded-lg touch-manipulation border border-cyan-100 transition-colors"
                    >
                        <PlusCircleIcon className="h-4 w-4" />
                        <span className="font-semibold text-xs md:text-sm">Añadir</span>
                    </button>
                )}
            </div>
        </div>
    );
});

// Memoized Location Cell
const LocationCell = React.memo(({
    locId,
    posStr,
    displayPos,
    isPosUrgent,
    isWide,
    items = [],
    actions,
    isMoveTarget,
    canPasteCopy,
    handleDragOver,
    handleDrop,
    userRole,
    canAssign,
    canRemove,
    canRequestItems
}: any) => {
    const canDrop = can(userRole, 'dragMove');

    if (isWide) {
        return (
            <div className="border p-3 rounded-xl shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
                    <p className="font-bold text-slate-600 dark:text-slate-400 text-sm">{displayPos.startsWith('Balda') ? displayPos : `Balda ${displayPos}`}</p>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${items.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                        {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => actions.onViewLocationDetails(locId)}
                        className="flex-1 h-14 md:h-16 flex items-center justify-center gap-2 text-slate-500 hover:text-cyan-600 bg-slate-50 hover:bg-slate-100 rounded-lg touch-manipulation border border-slate-100"
                    >
                        <ListIcon className="h-5 w-5" />
                        <span className="font-semibold text-sm">Ver Lista</span>
                    </button>
                    {canAssign() && (
                        <button
                            onClick={() => actions.onInitiateValidationFlow(locId)}
                            className="flex-1 h-14 md:h-16 flex items-center justify-center gap-2 text-cyan-600 bg-cyan-50 hover:bg-cyan-100 rounded-lg touch-manipulation border border-cyan-100"
                        >
                            <PlusCircleIcon className="h-5 w-5" />
                            <span className="font-semibold text-sm">Añadir</span>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            onDragOver={canDrop ? handleDragOver : undefined}
            onDrop={canDrop ? (e) => handleDrop(e, locId) : undefined}
            className={`
                border p-2 md:p-3 rounded-xl min-h-[110px] flex flex-col justify-between shadow-sm transition-all duration-200 active:scale-[0.99]
                ${isPosUrgent ? 'bg-red-50 border-red-200' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}
                ${isMoveTarget && items.length === 0 ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20 cursor-pointer hover:bg-blue-100' : ''}
            `}
            onClick={() => {
                if (isMoveTarget && items.length === 0) actions.onPasteMovedItem(locId);
                else if (canPasteCopy) actions.onPasteItem(locId);
            }}
        >
            <div>
                <div className={`flex justify-between items-center border-b pb-2 mb-2 md:mb-3 ${isPosUrgent ? 'border-red-100' : 'border-slate-100 dark:border-slate-800'}`}>
                    <div className="flex items-center gap-2">
                        <p className={`font-bold text-sm ${isPosUrgent ? 'text-red-700' : 'text-slate-600 dark:text-slate-400'}`}>{displayPos}</p>
                        {isPosUrgent && <span className="text-[10px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded">URG</span>}
                    </div>
                    {items.length === 0 && <span className="text-[10px] md:text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Vacío</span>}
                    {items.length > 0 && canAssign() && (
                        <button
                            onClick={(e) => { e.stopPropagation(); actions.onInitiateValidationFlow(locId); }}
                            className="text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 px-2 py-1 rounded-full hover:bg-cyan-200 flex items-center gap-1 font-bold touch-manipulation"
                            title="Añadir otro artículo aquí"
                        >
                            <PlusCircleIcon className="h-3 w-3" />
                        </button>
                    )}
                </div>
                <div className="min-h-[40px]">
                    {items.length > 0 ? items.map((item: any) => (
                        <AssignedItemCardReal
                            key={`${item.barcode}-${item.orderId}`}
                            item={item}
                            location={locId}
                            onInitiateCopy={(b: string, l: string, o: string) => actions.onInitiateCopy(b, l, o)}
                            onInitiateMove={(b: string, l: string, o: string) => actions.onInitiateMove(b, l, o)}
                            onInitiateDelete={(b: string, l: string, o: string) => actions.onInitiateDelete(b, l, o)}
                            onConfirmDelete={actions.onConfirmDelete}
                            onCancelDelete={actions.onCancelDelete}
                            isPendingDeletion={actions.itemPendingDeletion?.barcode === item.barcode && actions.itemPendingDeletion?.location === locId && actions.itemPendingDeletion?.orderId === item.orderId}
                            isCopying={actions.itemToCopy?.barcode === item.barcode && actions.itemToCopy?.fromLocation === locId && actions.itemToCopy?.orderId === item.orderId}
                            isMoving={actions.itemToMove?.barcode === item.barcode && actions.itemToMove?.fromLocation === locId && actions.itemToMove?.orderId === item.orderId}
                            onInitiateRequest={actions.onInitiateRequest}
                            userRole={userRole}
                            canAssign={canAssign}
                            canRemove={canRemove}
                            canRequestItems={canRequestItems}
                        />
                    )) : (
                        canAssign() ? (
                            <button onClick={(e) => { e.stopPropagation(); actions.onInitiateValidationFlow(locId); }} className="w-full h-20 md:h-24 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:text-cyan-600 touch-manipulation">
                                <PlusCircleIcon className="h-6 w-6 md:h-8 md:w-8 opacity-50" /><span className="text-xs md:text-sm font-semibold">Asignar</span>
                            </button>
                        ) : (
                            <div className="w-full h-20 md:h-24 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-300">
                                <span className="text-xs">Sin Artículos</span>
                            </div>
                        )
                    )}
                </div>
            </div>
            {canPasteCopy && (
                <button onClick={(e) => { e.stopPropagation(); actions.onPasteItem(locId); }} className="w-full mt-2 min-h-[44px] py-2 bg-green-600 text-white font-bold rounded-lg text-sm touch-manipulation">Pegar</button>
            )}
            {isMoveTarget && items.length === 0 && (
                <button onClick={(e) => { e.stopPropagation(); actions.onPasteMovedItem(locId); }} className="w-full mt-2 min-h-[44px] py-2 bg-blue-600 text-white font-bold rounded-lg text-sm touch-manipulation">Mover Aquí</button>
            )}
            {userRole === 'ADMIN' && items.length > 1 && (
                <button
                    onClick={(e) => { e.stopPropagation(); actions.onInitiateRelocate(locId); }}
                    className="w-full mt-2 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-lg text-[10px] md:text-xs border border-slate-200 dark:border-slate-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-300 dark:hover:border-orange-800 transition-colors touch-manipulation uppercase"
                >
                    Reubicar
                </button>
            )}
        </div>
    );
});

const ShelfViewImpl: React.FC<any> = ({ shelfName, racks, positions, activeWarehouse, shelfId, assignments, showEmptyOnly, isUrgent, isYellow, isWide, forceCols, onDragMove, collapsedShelves = {}, onToggleShelf, onToggleAllShelves, userRole, canAssign, canRemove, canRequestItems, ...actions }) => {
    const borderColor = isUrgent ? 'border-red-200' : isYellow ? 'border-yellow-200' : 'border-slate-200 dark:border-slate-800';
    const bgColor = isUrgent ? 'bg-red-50/30' : isYellow ? 'bg-yellow-50/30' : 'bg-slate-50/50 dark:bg-slate-900/30';

    const gridColsClass = isWide || forceCols === 1
        ? 'grid-cols-1'
        : forceCols === 2
            ? 'grid-cols-1 md:grid-cols-2'
            : forceCols === 5
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, toLocation: LocationId) => {
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data && data.barcode && data.fromLocation && onDragMove) {
                onDragMove(data.barcode, data.fromLocation, toLocation);
            }
        } catch (err) {
            console.error("Drop error", err);
        }
    };

    // Collapse Logic
    const isCollapsed = collapsedShelves[shelfId] || (collapsedShelves['@all'] && collapsedShelves[shelfId] !== false);

    // Calculate basic statistics for the summary
    const stats = useMemo(() => {
        let total = 0;
        let occupied = 0;
        racks.forEach((rack: any) => {
            positions.forEach((pos: any) => {
                let locId;
                const posStr = String(pos);
                // (Existing logic omitted for brevity in prompt, effectively same as before, see full file context)
                if (activeWarehouse === 'MEC') locId = shelfId === 'URGENTE' ? `MEC-E-URGENTE-B1-${pos}` : (shelfId === 'GEN_A' ? `MEC-E-GEN_A-B1-${pos}` : (shelfId === 'GEN_B' ? `MEC-E-GEN_B-B1-${pos}` : (shelfId === 'GEN_C' ? `MEC-E-GEN_C-B1-${pos}` : `MEC-E-GEN_D-B1-${pos}`)));
                else if (activeWarehouse === 'SXP') locId = `SXP-E1-B1-${pos}`;
                else if (activeWarehouse === 'RSO') locId = `RSO-E1-B1-${pos}`;
                else if (activeWarehouse === 'PLE') {
                    locId = `PLE-E1-B1-${pos}`;
                }
                else if (activeWarehouse === 'REP') {
                    locId = `REP-E-${shelfId}-B1-${pos}`;
                }
                else if (activeWarehouse === 'PIN') {
                    locId = `PIN-E-${shelfId}-B1-${pos}`;
                }
                else if (activeWarehouse === 'COM') {
                    locId = `COM-E${shelfId}-B1-${pos}`;
                }
                else if (activeWarehouse === 'RPL') {
                    if (shelfId === 'EST1') { locId = `RPL-E1-B1-${pos}`; }
                    else if (shelfId === 'EST2') { locId = `RPL-E2-B1-${pos}`; }
                } else if (activeWarehouse === 'SOL') {
                    const shelfNum = shelfId === '1' ? 1 : 2;
                    locId = `SOL-E${shelfNum}-B1-${pos}`;
                }
                else if (activeWarehouse === 'CAL') {
                    if (shelfId === 'RECHAZOS') { locId = `CAL-E-RECHAZOS-B1-${pos}`; }
                    else if (shelfId === 'GENERAL') { locId = `CAL-E-GENERAL-B1-${pos}`; }
                }
                else if (activeWarehouse === 'ZIN') {
                    locId = `ZIN-E1-B${rack}-1`;
                }
                else locId = `${activeWarehouse}-E${shelfId}-B${rack}-${pos}`;

                total++;
                if (assignments[locId as LocationId]?.length > 0) occupied++;
            });
        });
        return { total, occupied };
    }, [racks, positions, assignments, activeWarehouse, shelfId]);

    return (
        <div className={`${bgColor} p-3 md:p-4 rounded-2xl mb-4 md:mb-6 border-2 ${borderColor} content-visibility-auto transition-all duration-300`}>
            {/* Header logic same as before */}
            <div
                className={`flex justify-between items-center px-1 cursor-pointer select-none ${!isCollapsed ? 'mb-4 pb-2 border-b border-slate-200 dark:border-slate-800' : ''}`}
                onClick={() => onToggleShelf && onToggleShelf(shelfId)}
            >
                <div className="flex flex-wrap items-center gap-2 md:gap-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isCollapsed ? <ChevronRightIcon className="h-5 w-5 text-slate-400" /> : <ChevronDownIcon className="h-5 w-5 text-slate-400" />}
                        <h3 className={`text-base md:text-2xl font-bold break-words leading-tight ${isUrgent ? 'text-red-600' : isYellow ? 'text-yellow-700' : 'text-slate-800 dark:text-slate-200'}`}>
                            {shelfName}
                        </h3>
                    </div>
                    {isUrgent && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded">URGENTE</span>}
                    {isYellow && <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">ALUMINIO</span>}

                    {isCollapsed && (
                        <div className="flex items-center gap-2 ml-2 flex-wrap">
                            <span className="bg-slate-200/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-[10px] md:text-sm font-bold px-2 py-0.5 rounded-full">
                                {stats.total} huecos
                            </span>
                            <span className={`text-[10px] md:text-sm font-bold px-2 py-0.5 rounded-full ${stats.occupied > 0 ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-400'}`}>
                                {stats.occupied} ocupados
                            </span>
                        </div>
                    )}

                    {/* Empty Shelf Button */}
                    {!isCollapsed && can(userRole, 'emptyShelf') && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`⚠️ ¿Estás seguro de que quieres VACIAR la estantería ${shelfName || shelfId}?\n\nEsta acción eliminará TODOS los artículos de esta estantería.`)) {
                                    if (actions.onInitiateEmptyShelf) {
                                        actions.onInitiateEmptyShelf(activeWarehouse, shelfId);
                                    }
                                }
                            }}
                            className="ml-auto md:ml-2 px-3 py-1.5 text-xs font-bold uppercase text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                            title="Vaciar Estantería Completa"
                        >
                            Vaciar estantería
                        </button>
                    )}
                </div>
                <button
                    className="h-11 w-11 inline-flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors md:hidden"
                    onClick={(e) => { e.stopPropagation(); onToggleShelf && onToggleShelf(shelfId); }}
                >
                    {isCollapsed ? <ChevronDownIcon className="h-6 w-6" /> : <ChevronUpIcon className="h-6 w-6" />}
                </button>
            </div>


            {!isCollapsed && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    {racks.map((rack: any) => (
                        <div key={rack} className="px-0 md:px-1">
                            {racks.length > 1 && <h4 className="font-semibold text-base md:text-lg text-slate-500 mb-3 pl-1">Rack {rack}</h4>}
                            <div className={`grid gap-3 md:gap-4 ${gridColsClass}`}>
                                {positions.map((pos: any) => {
                                    let locId;
                                    const posStr = String(pos);
                                    if (activeWarehouse === 'MEC') locId = shelfId === 'URGENTE' ? `MEC-E-URGENTE-B1-${pos}` : (shelfId === 'GEN_A' ? `MEC-E-GEN_A-B1-${pos}` : (shelfId === 'GEN_B' ? `MEC-E-GEN_B-B1-${pos}` : (shelfId === 'GEN_C' ? `MEC-E-GEN_C-B1-${pos}` : `MEC-E-GEN_D-B1-${pos}`)));
                                    else if (activeWarehouse === 'SXP') locId = `SXP-E1-B1-${pos}`;
                                    else if (activeWarehouse === 'RSO') locId = `RSO-E1-B1-${pos}`;
                                    else if (activeWarehouse === 'PLE') {
                                        locId = `PLE-E1-B1-${pos}`;
                                    }
                                    else if (activeWarehouse === 'REP') {
                                        locId = `REP-E-${shelfId}-B1-${pos}`;
                                    }
                                    else if (activeWarehouse === 'PIN') {
                                        locId = `PIN-E-${shelfId}-B1-${pos}`;
                                    }
                                    else if (activeWarehouse === 'COM') {
                                        locId = `COM-E${shelfId}-B1-${pos}`;
                                    }
                                    else if (activeWarehouse === 'RPL') {
                                        if (shelfId === 'EST1') { locId = `RPL-E1-B1-${pos}`; }
                                        else if (shelfId === 'EST2') { locId = `RPL-E2-B1-${pos}`; }
                                    } else if (activeWarehouse === 'SOL') {
                                        const shelfNum = shelfId === '1' ? 1 : 2;
                                        locId = `SOL-E${shelfNum}-B1-${pos}`;
                                    }
                                    else if (activeWarehouse === 'CAL') {
                                        if (shelfId === 'RECHAZOS') { locId = `CAL-E-RECHAZOS-B1-${pos}`; }
                                        else if (shelfId === 'GENERAL') { locId = `CAL-E-GENERAL-B1-${pos}`; }
                                    }
                                    else if (activeWarehouse === 'ZIN') {
                                        locId = `ZIN-E1-B${rack}-1`;
                                    }
                                    else locId = `${activeWarehouse}-E${shelfId}-B${rack}-${pos}`;

                                    const locIdTyped = locId as LocationId;
                                    const isPosUrgent = isUrgentLocation(locIdTyped);
                                    const items = assignments[locIdTyped] || [];
                                    if (showEmptyOnly && items.length > 0) return null;

                                    const canPasteCopy = can(userRole, 'copyPaste') && actions.itemToCopy && actions.itemToCopy.fromLocation !== locIdTyped;
                                    const isMoveTarget = actions.itemToMove && actions.itemToMove.fromLocation !== locIdTyped;

                                    let displayPos = posStr;
                                    if (posStr.includes('-') && !posStr.startsWith('SOL') && !posStr.startsWith('CAL') && !posStr.startsWith('SXP') && !posStr.startsWith('ROB.SOL') && !posStr.startsWith('ROB.PLE') && !posStr.startsWith('PRE') && !posStr.startsWith('REP') && !posStr.startsWith('PIN')) {
                                        displayPos = posStr.split('-').pop();
                                    }
                                    if (activeWarehouse === 'ZIN') displayPos = '1';
                                    if (activeWarehouse === 'RPL' && posStr.startsWith('ROB.PLE')) displayPos = posStr;
                                    if (activeWarehouse === 'PIN' && posStr.startsWith('PIN')) displayPos = posStr;
                                    if (activeWarehouse === 'COM' && posStr.startsWith('COM ')) displayPos = posStr;
                                    if (activeWarehouse === 'REP' && posStr.startsWith('REP ')) displayPos = posStr;

                                    return (
                                        <LocationCell
                                            key={posStr}
                                            locId={locIdTyped}
                                            posStr={posStr}
                                            displayPos={displayPos}
                                            isPosUrgent={isPosUrgent}
                                            isWide={isWide}
                                            items={items}
                                            actions={actions}
                                            isMoveTarget={isMoveTarget}
                                            canPasteCopy={canPasteCopy}
                                            handleDragOver={handleDragOver}
                                            handleDrop={handleDrop}
                                            userRole={userRole}
                                            canAssign={canAssign}
                                            canRemove={canRemove}
                                            canRequestItems={canRequestItems}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ListViewImpl: React.FC<Omit<AssignmentListProps, 'searchQuery' | 'searchResults'>> = (props) => {
    const { assignments, activeWarehouse, showEmptyOnly, itemToMove, itemToCopy, onPasteMovedItem, onPasteItem, onInitiateMove, onInitiateCopy, onViewLocationDetails, onInitiateValidationFlow, canAssign, userRole } = props;
    const canCopyPaste = can(userRole, 'copyPaste');

    // Grouping Logic for List View
    const groupedGroups = useMemo(() => {
        const groups: Record<string, { locId: LocationId, items: any[] }[]> = {};

        Object.entries(assignments).forEach(([loc, items]) => {
            if (!loc.startsWith(activeWarehouse)) return;

            // Simple Shelf Grouping Heuristic
            let shelfName = 'General';
            const parts = loc.split('-');

            // Standard Naming: WH-E[SHELF]-...
            const shelfPart = parts.find(p => p.startsWith('E') && p.length > 1 && !isNaN(Number(p.substring(1))) || p.startsWith('E-'));
            if (shelfPart) {
                shelfName = shelfPart.replace('E-', 'Estantería ').replace('E', 'Estantería ');
            } else if (parts.length > 1) {
                shelfName = parts[1]; // Fallback to second segment
            }

            if (!groups[shelfName]) groups[shelfName] = [];
            groups[shelfName].push({ locId: loc as LocationId, items: items || [] });
        });

        return groups;
    }, [assignments, activeWarehouse]);

    return (
        <div className="space-y-4 pb-24">
            {Object.keys(groupedGroups).length === 0 && (
                <div className="text-center py-10 text-slate-500 italic">
                    No hay elementos en esta vista.
                </div>
            )}

            {Object.entries(groupedGroups).map(([shelf, locations]) => {
                // Sort locations by ID
                const sortedLocs = locations.sort((a, b) => a.locId.localeCompare(b.locId));

                return (
                    <div key={shelf} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
                            <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <LayersIcon className="h-4 w-4 text-cyan-600" />
                                {shelf}
                            </h3>
                            <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full font-mono text-slate-600 dark:text-slate-300">
                                {locations.length}
                            </span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {sortedLocs.map(({ locId, items }) => {
                                const isEmpty = !items || items.length === 0;
                                // Skip empty if not requested
                                if (isEmpty && !showEmptyOnly) return null;

                                const isTargetForMove = !!itemToMove && itemToMove.fromLocation !== locId;
                                const canPasteCopy = canCopyPaste && !!itemToCopy && itemToCopy.fromLocation !== locId;

                                return (
                                    <div
                                        key={locId}
                                        onClick={() => {
                                            if (isTargetForMove) onPasteMovedItem(locId);
                                            else if (canPasteCopy) onPasteItem(locId);
                                        }}
                                        className={`p-2 md:p-3 transition-colors flex items-start gap-2 md:gap-3 content-visibility-auto
                                            ${isTargetForMove ? 'cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-900/10 ring-2 ring-cyan-500 ring-inset m-1 rounded-lg' : ''}
                                            ${canPasteCopy ? 'cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/10 ring-2 ring-purple-500 ring-inset m-1 rounded-lg' : ''}
                                        `}
                                    >
                                        {/* Location Badge */}
                                        <div className="flex-shrink-0 w-14 pt-1">
                                            <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold text-xs px-1.5 py-1 rounded text-center border border-slate-200 dark:border-slate-700 break-all">
                                                {locId.split('-').pop()}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-grow min-w-0">
                                            {isEmpty ? (
                                                <div className="h-full flex items-center text-slate-400 text-sm italic py-1">
                                                    Vacío
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {items.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800/50">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400 text-sm truncate max-w-full block">{item.barcode}</span>
                                                                    {item.quantity > 1 && <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 rounded-full font-bold">x{item.quantity}</span>}
                                                                </div>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.description}</p>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-80">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); onInitiateMove(item.barcode, locId, item.orderId); }}
                                                                    className="h-11 w-11 inline-flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded-lg transition-colors"
                                                                >
                                                                    <MoveIcon className="h-4 w-4" />
                                                                </button>
                                                                {canCopyPaste && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); onInitiateCopy(item.barcode, locId, item.orderId); }}
                                                                        className="h-11 w-11 inline-flex items-center justify-center text-slate-400 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                                                                    >
                                                                        <CopyIcon className="h-4 w-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Row Actions */}
                                        <div className="flex flex-col gap-1 pt-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onViewLocationDetails(locId); }}
                                                className="h-11 w-11 inline-flex items-center justify-center text-slate-300 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                                            >
                                                <SettingsIcon className="h-4 w-4" />
                                            </button>
                                            {canAssign() && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onInitiateValidationFlow(locId); }}
                                                    className="h-11 w-11 inline-flex items-center justify-center text-slate-300 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors"
                                                >
                                                    <PlusCircleIcon className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const WarehouseViewFull: React.FC<Omit<AssignmentListProps, 'searchQuery' | 'searchResults'>> = (props) => {
    const { activeWarehouse, config, userRole, canAssign, canRemove, workingItems } = props;
    const { finishItem, locateItem } = useWorkingItems();
    const warehouseName = config.warehouses.find((w: any) => w.code === activeWarehouse)?.name || activeWarehouse;
    const pad3 = (n: number) => n.toString().padStart(3, '0');
    const [processingWorkingKey, setProcessingWorkingKey] = useState<string | null>(null);
    const [locatingItemKey, setLocatingItemKey] = useState<string | null>(null);
    const [targetWarehouseByItem, setTargetWarehouseByItem] = useState<Record<string, string>>({});
    const [targetLocationByItem, setTargetLocationByItem] = useState<Record<string, LocationId>>({});
    const [locateValidationItem, setLocateValidationItem] = useState<WorkingItem | null>(null);
    const [showLocatePhoto, setShowLocatePhoto] = useState(false);
    const [showLocateManual, setShowLocateManual] = useState(false);

    // Filter working items for this section
    const sectionName = WAREHOUSE_TO_SECTION[activeWarehouse];
    const sectionWorkingItems = workingItems?.filter(i => {
        if (i.section === sectionName) return true;
        // Fallback: If section is OTROS or undefined, try to match by location
        if ((!i.section || i.section === 'OTROS') && i.fromLocationId) {
            const derived = getSectionFromLocation(i.fromLocationId);
            return derived === sectionName;
        }
        return false;
    }) || [];

    const getWorkingItemKey = (item: WorkingItem) => item.itemKey || `${item.barcode}-${item.orderId}`;

    const getOtherOFs = (item: WorkingItem) => sectionWorkingItems
        .filter(i => i.barcode === item.barcode && i.orderId !== item.orderId)
        .map(i => i.orderId);

    const ensureInitialLocateSelection = (item: WorkingItem) => {
        const key = getWorkingItemKey(item);
        const defaultWarehouse = (item.fromLocationId?.split('-')[0] || activeWarehouse) as string;
        if (!targetWarehouseByItem[key]) {
            const locations = generateLayoutLocations(defaultWarehouse);
            setTargetWarehouseByItem(prev => ({ ...prev, [key]: defaultWarehouse }));
            if (locations.length > 0) {
                setTargetLocationByItem(prev => ({ ...prev, [key]: locations[0] }));
            }
        }
    };

    const handleFinishAndNotify = async (item: WorkingItem) => {
        if (processingWorkingKey) return;
        const confirmed = window.confirm(`Confirmar finalizacion de ${item.barcode} (OF: ${item.orderId}) y aviso al carretillero.`);
        if (!confirmed) return;
        const key = getWorkingItemKey(item);
        setProcessingWorkingKey(key);
        try {
            if (props.onNotifyFinishedItem && item.fromLocationId) {
                props.onNotifyFinishedItem(item.barcode, item.fromLocationId, item.orderId);
            }
            await finishItem(item, { uid: 'user', displayName: 'Usuario' });
        } catch (e) {
            console.error(e);
            alert('Error al terminar el trabajo.');
        } finally {
            setProcessingWorkingKey(null);
            setLocatingItemKey(null);
        }
    };

    const validateLocateIdentity = (item: WorkingItem, barcode: string, orderId: string) => {
        const sameBarcode = item.barcode.trim().toUpperCase() === barcode.trim().toUpperCase();
        const sameOrder = item.orderId.trim().toUpperCase() === orderId.trim().toUpperCase();
        if (!sameBarcode || !sameOrder) {
            alert(`La lectura no coincide con ${item.barcode} / ${item.orderId}.`);
            return false;
        }
        return true;
    };

    const openLocateAfterValidation = (item: WorkingItem) => {
        const key = getWorkingItemKey(item);
        ensureInitialLocateSelection(item);
        setLocatingItemKey(key);
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
        const extracted = typeof result === 'string' ? { article: result, order: '' } : result;
        if (!validateLocateIdentity(locateValidationItem, extracted.article || '', extracted.order || '')) return;
        openLocateAfterValidation(locateValidationItem);
    };

    const handleFinishAndLocate = async (item: WorkingItem) => {
        if (processingWorkingKey) return;
        const key = getWorkingItemKey(item);
        const target = targetLocationByItem[key];
        if (!target) {
            alert('Selecciona una ubicacion de destino.');
            return;
        }

        setProcessingWorkingKey(key);
        try {
            await locateItem(item, target, { uid: 'user', displayName: 'Usuario' });
        } catch (e) {
            console.error(e);
            alert('Error al ubicar el articulo.');
        } finally {
            setProcessingWorkingKey(null);
            setLocatingItemKey(null);
        }
    };

    // If List View mode is active, override standard rendering
    if (props.viewMode === 'list') {
        return <ListViewImpl {...props} />;
    }

    const duplicatedWorkingByBarcode = useMemo(() => {
        const byBarcode = new Map<string, Set<string>>();
        sectionWorkingItems.forEach(item => {
            if (!byBarcode.has(item.barcode)) byBarcode.set(item.barcode, new Set());
            byBarcode.get(item.barcode)!.add(item.orderId);
        });

        return Array.from(byBarcode.entries())
            .filter(([, orderIds]) => orderIds.size > 1)
            .map(([barcode, orderIds]) => ({
                barcode,
                orderIds: Array.from(orderIds).sort()
            }));
    }, [sectionWorkingItems]);

    let content;
    // ... (Existing content logic preserved) 
    if (activeWarehouse === 'MEC') {
        const mecUrgentPos = Array.from({ length: 4 }, (_, i) => `MEC ${pad3(i + 1)}`);
        const mecGenAPos = Array.from({ length: 9 }, (_, i) => `MEC ${pad3(i + 5)}`);
        const mecGenBPos = Array.from({ length: 9 }, (_, i) => `MEC ${pad3(i + 14)}`);
        const mecGenCPos = Array.from({ length: 12 }, (_, i) => `MEC ${pad3(i + 23)}`);
        const mecGenDPos = Array.from({ length: 12 }, (_, i) => `MEC ${pad3(i + 35)}`);
        content = (
            <>
                <ShelfViewImpl {...props} shelfName="🚨 ZONA URGENTE (001-004)" shelfId="URGENTE" isUrgent racks={[1]} positions={mecUrgentPos} forceCols={1} />
                <ShelfViewImpl {...props} shelfName="ZONA GENERAL A (005-013)" shelfId="GEN_A" racks={[1]} positions={mecGenAPos} />
                <ShelfViewImpl {...props} shelfName="ZONA GENERAL B (014-022)" shelfId="GEN_B" racks={[1]} positions={mecGenBPos} />
                <ShelfViewImpl {...props} shelfName="ZONA GENERAL C (023-034)" shelfId="GEN_C" racks={[1]} positions={mecGenCPos} />
                <ShelfViewImpl {...props} shelfName="ZONA GENERAL D (035-046)" shelfId="GEN_D" racks={[1]} positions={mecGenDPos} />
            </>
        );
    }
    // ... all other else ifs must be preserved exactly as they were ...
    else if (activeWarehouse === 'PLE') {
        const est1UrgentPos = Array.from({ length: 6 }, (_, i) => `PLE ${pad3(i + 1)}`);
        const est1NormalPos = Array.from({ length: 10 }, (_, i) => `PLE ${pad3(i + 7)}`);
        const est2Pos = Array.from({ length: 14 }, (_, i) => `PLE ${pad3(i + 17)}`);
        const punzonadoraPos = Array.from({ length: 23 }, (_, i) => `PLE ${pad3(i + 31)}`);
        const carro1Pos = Array.from({ length: 4 }, (_, i) => `PLE C1-${i + 1}`);
        const carro2Pos = Array.from({ length: 4 }, (_, i) => `PLE C2-${i + 1}`);
        content = (
            <>
                <ShelfViewImpl {...props} shelfName="🚨 Estantería 1 (Urgente 1-6)" shelfId="PLE_1_URG" isUrgent racks={[1]} positions={est1UrgentPos} />
                <ShelfViewImpl {...props} shelfName="Estantería 1 (General 7-16)" shelfId="PLE_1_GEN" racks={[1]} positions={est1NormalPos} />
                <ShelfViewImpl {...props} shelfName="Estantería 2 (17-30)" shelfId="EST_2" racks={[1]} positions={est2Pos} />
                <ShelfViewImpl {...props} shelfName="Punzonadora (31-53)" shelfId="PUNZONADORA" racks={[1]} positions={punzonadoraPos} forceCols={5} />
                <div className="mt-8 pt-6 border-t-2 border-slate-200 dark:border-slate-800">
                    <h4 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-wider flex items-center gap-2">
                        <ShoppingCartIcon className="h-4 w-4" /> CARROS PLEGADORA
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-slate-50/50 dark:bg-slate-900/10 p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800">
                            <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-4 ml-1 flex items-center gap-2">CARRO 1</h5>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {carro1Pos.map((pos, i) => (
                                    <CartShelfRow
                                        key={pos}
                                        label={`Balda ${i + 1}`}
                                        locId={`PLE-E1-B1-${pos}`}
                                        assignments={props.assignments}
                                        onAdd={props.onInitiateValidationFlow}
                                        onViewDetails={props.onViewLocationDetails}
                                        canAssign={canAssign}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-50/50 dark:bg-slate-900/10 p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800">
                            <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-4 ml-1 flex items-center gap-2">CARRO 2</h5>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {carro2Pos.map((pos, i) => (
                                    <CartShelfRow
                                        key={pos}
                                        label={`Balda ${i + 1}`}
                                        locId={`PLE-E1-B1-${pos}`}
                                        assignments={props.assignments}
                                        onAdd={props.onInitiateValidationFlow}
                                        onViewDetails={props.onViewLocationDetails}
                                        canAssign={canAssign}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }
    else if (activeWarehouse === 'SOL') {
        const sol1Pos = Array.from({ length: 4 }, (_, i) => `SOL ${pad3(i + 1)}`);
        const sol2Pos = Array.from({ length: 66 }, (_, i) => {
            const num = i + 5;
            return num >= 41 ? `SOL ${num}` : `SOL ${pad3(num)}`;
        });
        content = (
            <>
                <ShelfViewImpl {...props} shelfName="🚨 ZONA URGENTE (001-004)" shelfId="1" isUrgent racks={[1]} positions={sol1Pos} forceCols={2} />
                <ShelfViewImpl {...props} shelfName="ZONA GENERAL (005-070)" shelfId="2" racks={[1]} positions={sol2Pos} />
            </>
        );
    }
    else if (activeWarehouse === 'RSO') {
        const rsoPos = Array.from({ length: 8 }, (_, i) => `ROB.SOL ${pad3(i + 1)}`);
        content = <ShelfViewImpl {...props} shelfName="Robot Soldadura (001-008)" shelfId="1" racks={[1]} positions={rsoPos} forceCols={2} />;
    }
    else if (activeWarehouse === 'REP') {
        const repUrgente = Array.from({ length: 4 }, (_, i) => `REP ${pad3(i + 1)}`);
        const repAluminio = Array.from({ length: 10 }, (_, i) => `REP ${pad3(i + 5)}`);
        const repNormal = Array.from({ length: 10 }, (_, i) => `REP ${pad3(i + 15)}`);
        const repModular = Array.from({ length: 15 }, (_, i) => `REP ${pad3(i + 25)}`);
        content = (
            <>
                <ShelfViewImpl {...props} shelfName="🚨 ZONA URGENTE (001-004)" shelfId="URGENTE" isUrgent racks={[1]} positions={repUrgente} forceCols={2} />
                <ShelfViewImpl {...props} shelfName="🟡 ZONA ALUMINIO (005-014)" shelfId="ALUMINIO" isYellow racks={[1]} positions={repAluminio} />
                <ShelfViewImpl {...props} shelfName="ZONA NORMAL (015-024)" shelfId="NORMAL" racks={[1]} positions={repNormal} />
                <ShelfViewImpl {...props} shelfName="ALMACÉN MODULAR (025-039)" shelfId="MODULAR" racks={[1]} positions={repModular} />
            </>
        );
    }
    else if (activeWarehouse === 'PIN') {
        const pinDentro = Array.from({ length: 27 }, (_, i) => `PIN ${pad3(i + 1)}`);
        const pinFuera = Array.from({ length: 12 }, (_, i) => `PIN ${pad3(i + 28)}`);
        content = (
            <>
                <ShelfViewImpl {...props} shelfName="DENTRO (001-027)" shelfId="DENTRO" racks={[1]} positions={pinDentro} />
                <ShelfViewImpl {...props} shelfName="FUERA (028-039)" shelfId="FUERA" racks={[1]} positions={pinFuera} />
            </>
        );
    }
    else if (activeWarehouse === 'SXP') {
        const sxpPos = Array.from({ length: 10 }, (_, i) => `SXP ${pad3(i + 1)}`);
        content = <ShelfViewImpl {...props} shelfName="Soldadura Puntos (001-010)" shelfId="1" racks={[1]} positions={sxpPos} />;
    }
    else if (activeWarehouse === 'COM') {
        const comodinPos = Array.from({ length: 18 }, (_, i) => `COM ${pad3(i + 1)}`);
        content = <ShelfViewImpl {...props} shelfName="Zona Comodín (001-018)" shelfId="1" racks={[1]} positions={comodinPos} />;
    }
    else if (activeWarehouse === 'RPL') {
        const est1 = Array.from({ length: 14 }, (_, i) => `ROB.PLE ${pad3(i + 1)}`);
        const est2 = Array.from({ length: 21 }, (_, i) => `ROB.PLE ${pad3(i + 15)}`);
        content = (
            <>
                <ShelfViewImpl {...props} shelfName="Estantería 1 (001-014)" shelfId="EST1" racks={[1]} positions={est1} />
                <ShelfViewImpl {...props} shelfName="Estantería 2 (015-035)" shelfId="EST2" racks={[1]} positions={est2} />
            </>
        );
    }
    else if (activeWarehouse === 'CAL') {
        const rechazos = Array.from({ length: 22 }, (_, i) => `CAL ${pad3(i + 1)}`);
        const general = Array.from({ length: 12 }, (_, i) => `CAL ${pad3(i + 23)}`);
        content = (
            <>
                <ShelfViewImpl {...props} shelfName="🛑 RECHAZOS (001-022)" shelfId="RECHAZOS" racks={[1]} positions={rechazos} />
                <ShelfViewImpl {...props} shelfName="GENERAL (023-034)" shelfId="GENERAL" racks={[1]} positions={general} />
            </>
        );
    }
    else if (activeWarehouse === 'ZIN') {
        content = (
            <ShelfViewImpl {...props} shelfName="Zincado" shelfId="1" racks={[5, 4, 3, 2, 1]} positions={['1']} forceCols={1} />
        );
    }
    else {
        content = (
            <>
                {config.shelves.map((shelf: any) => (
                    <ShelfViewImpl key={shelf} {...props} shelfName={`Estantería ${shelf}`} shelfId={shelf} racks={config.racks} positions={config.positions} />
                ))}
            </>
        )
    }

    return (
        <div className="pb-16 md:pb-10">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 md:mb-6 px-1 gap-2">
                <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight break-words">{warehouseName}</h2>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => props.onToggleAllShelves && props.onToggleAllShelves(true)}
                        className="min-h-[44px] px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors uppercase"
                    >
                        Contraer Todo
                    </button>
                    <button
                        onClick={() => props.onToggleAllShelves && props.onToggleAllShelves(false)}
                        className="min-h-[44px] px-3 py-1.5 text-xs font-bold bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors uppercase"
                    >
                        Expandir Todo
                    </button>
                </div>
            </div>

            {/* WORKING ITEMS SECTION */}
            {sectionWorkingItems.length > 0 && (
                <div className="mb-8">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 border-b border-indigo-100 dark:border-indigo-800/50 flex justify-between items-center rounded-t-2xl">
                        <h3 className="font-black text-indigo-900 dark:text-indigo-300 tracking-tight uppercase text-lg flex items-center gap-2">
                            <LoadingIcon className="h-5 w-5 animate-spin-slow" />
                            EN PRODUCCIÓN
                        </h3>
                        <span className="bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 text-xs font-bold px-2 py-1 rounded-full">{sectionWorkingItems.length}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border-x border-b border-indigo-100 dark:border-indigo-800/50 rounded-b-2xl p-4 shadow-sm">
                        {duplicatedWorkingByBarcode.length > 0 && (
                            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs md:text-sm text-red-700 dark:text-red-300">
                                <p className="font-bold mb-2">Atencion: mismo articulo activo en distintas OF.</p>
                                <div className="space-y-1">
                                    {duplicatedWorkingByBarcode.map(item => (
                                        <p key={item.barcode}>
                                            <strong>{item.barcode}</strong>: {item.orderIds.join(', ')}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {sectionWorkingItems.map(item => (
                                <div key={item.itemKey || `${item.barcode}-${item.orderId}`} className="border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-3 bg-indigo-50/30 dark:bg-indigo-900/10 flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.barcode}</span>
                                            <span className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 rounded text-slate-500">{item.orderId}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <span>🕒 {timeAgo(item.withdrawnAt)}</span>
                                            {item.fromLocationId && <span className="font-mono">({formatLocation(item.fromLocationId)})</span>}
                                        </div>

                                        {getOtherOFs(item).length > 0 && (
                                            <div className="mt-2 text-[10px] md:text-xs bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 px-2 py-1 rounded-lg border border-rose-100 dark:border-rose-800 flex items-start gap-1">
                                                <span className="text-base leading-none">⚠️</span>
                                                <span>
                                                    <strong>Duplicidad OF:</strong> este articulo tambien esta en fabricacion con OF <strong>{getOtherOFs(item).join(', ')}</strong>
                                                </span>
                                            </div>
                                        )}

                                        <div className="mt-3 grid grid-cols-1 gap-2">
                                            <button
                                                onClick={() => handleFinishAndNotify(item)}
                                                disabled={processingWorkingKey !== null}
                                                className={`min-h-[36px] px-3 py-2 text-[11px] md:text-xs font-bold rounded-lg transition-colors ${processingWorkingKey !== null
                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                    : 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200'
                                                    }`}
                                            >
                                                {processingWorkingKey === getWorkingItemKey(item) ? 'Procesando...' : 'Terminar trabajo y avisar al carretillero'}
                                            </button>

                                            <button
                                                onClick={() => {
                                                    const key = getWorkingItemKey(item);
                                                    if (locatingItemKey === key) {
                                                        setLocatingItemKey(null);
                                                        return;
                                                    }
                                                    setLocateValidationItem(item);
                                                }}
                                                disabled={processingWorkingKey !== null}
                                                className={`min-h-[36px] px-3 py-2 text-[11px] md:text-xs font-bold rounded-lg transition-colors ${processingWorkingKey !== null
                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                                                    }`}
                                            >
                                                Terminar y ubicar
                                            </button>
                                        </div>

                                        {locatingItemKey === getWorkingItemKey(item) && (
                                            <div className="mt-3 p-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white/90 dark:bg-slate-900/70 grid gap-2">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    <select
                                                        value={targetWarehouseByItem[getWorkingItemKey(item)] || activeWarehouse}
                                                        onChange={(e) => {
                                                            const selectedWarehouse = e.target.value;
                                                            const key = getWorkingItemKey(item);
                                                            const locations = generateLayoutLocations(selectedWarehouse);
                                                            setTargetWarehouseByItem(prev => ({ ...prev, [key]: selectedWarehouse }));
                                                            if (locations.length > 0) {
                                                                setTargetLocationByItem(prev => ({ ...prev, [key]: locations[0] }));
                                                            }
                                                        }}
                                                        className="w-full px-2 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                                    >
                                                        {config.warehouses.map((wh: any) => (
                                                            <option key={wh.code} value={wh.code}>{wh.name}</option>
                                                        ))}
                                                    </select>

                                                    <select
                                                        value={targetLocationByItem[getWorkingItemKey(item)] || ''}
                                                        onChange={(e) => setTargetLocationByItem(prev => ({ ...prev, [getWorkingItemKey(item)]: e.target.value as LocationId }))}
                                                        className="w-full px-2 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                                    >
                                                        {generateLayoutLocations(targetWarehouseByItem[getWorkingItemKey(item)] || activeWarehouse).map((loc) => (
                                                            <option key={loc} value={loc}>{formatLocation(loc)}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <button
                                                    onClick={() => handleFinishAndLocate(item)}
                                                    disabled={processingWorkingKey !== null || !targetLocationByItem[getWorkingItemKey(item)]}
                                                    className={`min-h-[36px] px-3 py-2 text-[11px] md:text-xs font-bold rounded-lg transition-colors ${processingWorkingKey !== null || !targetLocationByItem[getWorkingItemKey(item)]
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                                        }`}
                                                >
                                                    Confirmar ubicacion
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <span className="ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-full uppercase self-start">
                                        En Trabajo
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {content}

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



const ItemLocationsGroup: React.FC<{ barcode: string, orderId: string, locations: { id: LocationId, timestamp: string }[] }> = ({ barcode, orderId, locations }) => {
    return (
        <div className="bg-slate-50/50 dark:bg-slate-900/30 p-3 md:p-4 rounded-2xl mb-4 border-2 border-slate-200 dark:border-slate-800 content-visibility-auto">
            <div className="flex flex-wrap justify-between items-center mb-4 pb-2 border-b border-slate-200 dark:border-slate-800 px-1 gap-2">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">ARTÍCULO</span>
                        <h3 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-200">{barcode}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">OF</span>
                        <span className="font-mono text-sm md:text-base text-slate-600 dark:text-slate-300 font-medium">{orderId}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${locations.length > 1 ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                        {locations.length} {locations.length === 1 ? 'Ubicación' : 'Ubicaciones'}
                    </span>
                </div>
            </div>

            <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {locations.map(loc => {
                    const isUrgent = isUrgentLocation(loc.id);

                    const displayLoc = formatLocation(loc.id);

                    return (
                        <div key={loc.id} className={`
                            border p-3 rounded-xl min-h-[100px] flex flex-col justify-between shadow-sm transition-all hover:shadow-md
                            ${isUrgent ? 'bg-red-50 border-red-200' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}
                        `}>
                            <div className={`flex justify-between items-center border-b pb-2 mb-2 ${isUrgent ? 'border-red-100' : 'border-slate-100 dark:border-slate-800'}`}>
                                <div className="flex items-center gap-2 w-full">
                                    <p className={`font-bold text-sm truncate w-full ${isUrgent ? 'text-red-700' : 'text-slate-600 dark:text-slate-400'}`}>
                                        {displayLoc}
                                    </p>
                                    {isUrgent && <span className="text-[10px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded flex-shrink-0">URG</span>}
                                </div>
                            </div>

                            <div className="flex-grow flex flex-col justify-center items-center text-center">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Entrada</span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {new Date(loc.timestamp).toLocaleDateString()}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {new Date(loc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SearchResultsView: React.FC<{ results: { location: LocationId; item: AssignmentItem }[]; query: string }> = ({ results, query }) => {
    // Grouping Logic
    const grouped = useMemo(() => {
        const map = new Map<string, { barcode: string, orderId: string, locations: { id: LocationId, timestamp: string }[] }>();
        results.forEach(({ location, item }) => {
            const key = `${item.barcode}|${item.orderId}`;
            if (!map.has(key)) {
                map.set(key, { barcode: item.barcode, orderId: item.orderId, locations: [] });
            }
            map.get(key)!.locations.push({ id: location, timestamp: item.timestamp });
        });
        return Array.from(map.values());
    }, [results]);

    return (
        <div className="pb-10">
            <h2 className="text-lg md:text-xl font-bold mb-4 text-slate-800 dark:text-slate-200 px-1">Resultados para "{query}":</h2>
            {grouped.length > 0 ? (
                <div className="space-y-6">
                    {grouped.map(group => (
                        <ItemLocationsGroup
                            key={`${group.barcode}-${group.orderId}`}
                            barcode={group.barcode}
                            orderId={group.orderId}
                            locations={group.locations}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
                    <p className="text-lg">No se encontraron resultados.</p>
                </div>
            )}
        </div>
    );
};

const AssignmentList: React.FC<AssignmentListProps> = (props) => {
    if (props.searchQuery) {
        return <SearchResultsView results={props.searchResults} query={props.searchQuery} />;
    }
    return <WarehouseViewFull {...props} />;
};

export default AssignmentList;
