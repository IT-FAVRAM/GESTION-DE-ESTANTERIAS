
import React from 'react';
import { WarehouseHeader } from '../WarehouseHeader';
import WarehouseRoute from '../Routes/WarehouseRoute';
import { LocationId } from '../../lib/warehouseData';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { LoadingIcon } from '../Icons';

export interface WarehousePageProps {
    activeWarehouse: string;
    config: any;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    handleTabChange: (code: string) => void;
    role: string | null;
    showEmptyOnly: boolean;
    setShowEmptyOnly: (show: boolean) => void;
    assignments: any;
    history: any;
    searchResults: any;
    itemToCopy: any;
    itemToMove: any;
    itemPendingDeletion: any;
    setItemPendingDeletion: (item: any) => void;
    workingItems: any[];
    collapsedShelves: any; // Record<string, string[]>
    toggleShelf: (wh: string, id: string) => void;
    toggleAllShelves: (wh: string, collapse: boolean) => void;
    // Permissions
    canAssign: () => boolean;
    canRemove: (loc?: string) => boolean;
    canRequestItems: () => boolean;
    canFinishProduction: () => boolean;
    canExport: () => boolean;
    canAnalyzeAnomalies: () => boolean;

    // Actions & Setters
    setWorkflowMode: (mode: any) => void;
    resetScanWorkflow: () => void;
    setModal: (key: string, val: boolean) => void;

    // Handlers
    handleInitiateRemoveWorkflow: () => void;
    handleInitiateMultiOccupancy: () => void;
    handleInitiateRequestWorkflow: () => void;
    handleInitiateFinishWorkflow: () => void;
    exportInventoryToExcel: (assignments: any, config: any) => void;

    handleInitiateCopy: (b: string, l: any, o?: string) => void;
    copyItem: any; // function
    handleInitiateMove: (b: string, l: any, o?: string) => void;
    handlePasteMovedItem: (l: any) => void;
    handleDirectAssign: (barcode: string, orderId: string, l: any) => void;
    handleDirectRemove: (barcode: string, l: any, orderId: string) => void | Promise<void>;
    handleInitiateAdd: (l: any) => void;
    handleInitiateDelete: (b: string, l: any, o?: string) => void;
    handleConfirmDelete: () => void;
    handleDragMove: (barcode: string, fromLoc: any, toLoc: any) => void;
    handleInitiateRequest: (barcode: string, orderId: string, fromLoc: any) => void;
    handleInitiateRelocate: (l: any) => void;
    handleInitiateEmptyShelf: (warehouse: any, shelf: any) => void | Promise<void>;
    onNotifyFinishedItem: (barcode: string, location: string, orderId: string) => void;
    removeItem: any;
    assignItem: any;
    notify: any;
    formatLocation: (l: any) => string;

    // UI Helpers
    selectedMapLocation: any;
    setSelectedMapLocation: (loc: any) => void;
    setShelfDetailMode: (mode: 'view' | 'add_choice') => void;
    setRelocateSourceLoc: (loc: any) => void;
    onRefresh: () => Promise<void>;
}

export const WarehousePage: React.FC<WarehousePageProps> = (props) => {

    // Pull to Refresh
    const { isRefreshing, pullProgress } = usePullToRefresh(async () => {
        await props.onRefresh();
    });

    // Auto-expand shelf when location selected
    React.useEffect(() => {
        if (props.selectedMapLocation && props.activeWarehouse) {
            const parts = props.selectedMapLocation.split('-');
            if (parts.length >= 2) {
                const shelfId = parts[1];
                // If it's in the list of collapsed shelves for this warehouse, toggle it (expand)
                // collapsedShelves is { [wh]: [ids] }
                const warehouseState = props.collapsedShelves[props.activeWarehouse] || {};
                const isAllCollapsed = warehouseState['@all'] === true;
                const shelfValue = warehouseState[shelfId];
                const isCollapsed = shelfValue !== undefined ? shelfValue : isAllCollapsed;
                if (isCollapsed) {
                    props.toggleShelf(props.activeWarehouse, shelfId);
                }
            }
        }
    }, [props.selectedMapLocation, props.activeWarehouse, props.collapsedShelves, props.toggleShelf]);

    return (
        <>
            {/* Pull to Refresh Indicator */}
            {(pullProgress > 0 || isRefreshing) && (
                <div className="fixed top-16 left-0 right-0 z-50 flex justify-center pointer-events-none transition-all duration-200" style={{ transform: `translateY(${pullProgress > 0 ? pullProgress / 2 : 0}px)` }}>
                    <div className="bg-white dark:bg-slate-900 rounded-full p-2 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                        <span style={{ transform: `rotate(${pullProgress * 3.6}deg)` }}>
                            <LoadingIcon className={`h-5 w-5 text-cyan-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </span>
                        {isRefreshing && <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Actualizando...</span>}
                    </div>
                </div>
            )}


            <WarehouseHeader
                activeWarehouse={props.activeWarehouse}
                config={props.config}
                searchQuery={props.searchQuery}
                setSearchQuery={props.setSearchQuery}
                handleTabChange={props.handleTabChange}
                role={props.role}
                showEmptyOnly={props.showEmptyOnly}
                setShowEmptyOnly={props.setShowEmptyOnly}
                canAssign={props.canAssign}
                canRemove={props.canRemove}
                canRequestItems={props.canRequestItems}
                canFinishProduction={props.canFinishProduction}
                canExport={props.canExport}
                canAnalyzeAnomalies={props.canAnalyzeAnomalies}
                setWorkflowMode={props.setWorkflowMode}
                resetScanWorkflow={props.resetScanWorkflow}
                setModal={props.setModal}
                handleInitiateRemoveWorkflow={props.handleInitiateRemoveWorkflow}
                handleInitiateMultiOccupancy={props.handleInitiateMultiOccupancy}
                handleInitiateRequestWorkflow={props.handleInitiateRequestWorkflow}
                handleInitiateFinishWorkflow={props.handleInitiateFinishWorkflow}
                exportInventoryToExcel={props.exportInventoryToExcel}
                assignments={props.assignments}
                history={props.history}
            />

            <WarehouseRoute
                role={props.role!}
                assignments={props.assignments}
                config={props.config}
                searchQuery={props.searchQuery}
                searchResults={props.searchResults}
                showEmptyOnly={props.showEmptyOnly}
                itemToCopy={props.itemToCopy}
                onInitiateCopy={props.handleInitiateCopy}
                onPasteItem={(loc: any) => props.itemToCopy && props.copyItem(props.itemToCopy.barcode, props.itemToCopy.fromLocation, loc, props.itemToCopy.orderId)}
                itemToMove={props.itemToMove}
                onInitiateMove={props.handleInitiateMove}
                onPasteMovedItem={props.handlePasteMovedItem}
                itemPendingDeletion={props.itemPendingDeletion}
                onInitiateDelete={props.handleInitiateDelete}
                onConfirmDelete={props.handleConfirmDelete}
                onCancelDelete={() => props.setItemPendingDeletion(null)}
                onInitiateValidationFlow={props.handleInitiateAdd}
                onDirectAssign={props.handleDirectAssign}
                onDirectRemove={props.handleDirectRemove}
                onViewLocationDetails={(locId: LocationId) => {
                    props.setSelectedMapLocation(locId);
                    props.setShelfDetailMode('view');
                }}
                onDragMove={props.handleDragMove}
                onInitiateRelocate={(loc: any) => { props.setRelocateSourceLoc(loc); props.setModal('relocate', true); }}
                onInitiateEmptyShelf={props.handleInitiateEmptyShelf}
                onNotifyFinishedItem={props.onNotifyFinishedItem}
                collapsedShelves={props.collapsedShelves}
                toggleShelf={props.toggleShelf}
                toggleAllShelves={props.toggleAllShelves}
                canAssign={props.canAssign}
                canRemove={props.canRemove}
                canRequestItems={props.canRequestItems}
                onInitiateRequest={props.handleInitiateRequest}
                workingItems={props.workingItems}
                viewMode="grid"
            />
        </>
    );
};


