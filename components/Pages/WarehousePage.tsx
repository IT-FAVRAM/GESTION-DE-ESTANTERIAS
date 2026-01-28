
import React from 'react';
import { WarehouseHeader } from '../WarehouseHeader';
import WarehouseRoute from '../Routes/WarehouseRoute';
import { LocationId } from '../../lib/warehouseData';

interface WarehousePageProps {
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
    gemini: any;

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
    exportInventoryToExcel: () => void;

    handleInitiateCopy: (b: string, l: any, o?: string) => void;
    copyItem: any; // function
    handleInitiateMove: (b: string, l: any, o?: string) => void;
    handlePasteMovedItem: (l: any) => void;
    handleDirectAssign: (l: any) => void;
    handleDirectRemove: (b: string, l: any, o?: string) => void;
    handleInitiateAdd: (l: any) => void;
    handleInitiateDelete: (b: string, l: any, o?: string) => void;
    handleConfirmDelete: () => void;
    handleDragMove: (res: any) => void;
    handleInitiateRequest: (l: any) => void;

    handleInitiateRequest: (l: any) => void;

    // UI Helpers
    selectedMapLocation: any;
    setSelectedMapLocation: (loc: any) => void;
    setShelfDetailMode: (mode: 'view' | 'add_choice') => void;
    setRelocateSourceLoc: (loc: any) => void;
}

export const WarehousePage: React.FC<WarehousePageProps> = (props) => {

    // Auto-expand shelf when location selected
    React.useEffect(() => {
        if (props.selectedMapLocation && props.activeWarehouse) {
            const parts = props.selectedMapLocation.split('-');
            if (parts.length >= 2) {
                const shelfId = parts[1];
                // If it's in the list of collapsed shelves for this warehouse, toggle it (expand)
                // collapsedShelves is { [wh]: [ids] }
                const isCollapsed = props.collapsedShelves[props.activeWarehouse]?.includes(shelfId);
                if (isCollapsed) {
                    props.toggleShelf(props.activeWarehouse, shelfId);
                }
            }
        }
    }, [props.selectedMapLocation, props.activeWarehouse, props.collapsedShelves, props.toggleShelf]);

    return (
        <>

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
                gemini={props.gemini}
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
                collapsedShelves={props.collapsedShelves}
                toggleShelf={props.toggleShelf}
                toggleAllShelves={props.toggleAllShelves}
                canAssign={props.canAssign}
                canRemove={props.canRemove}
                canRequestItems={props.canRequestItems}
                onInitiateRequest={props.handleInitiateRequest}
                workingItems={props.workingItems}
            />
        </>
    );
};
