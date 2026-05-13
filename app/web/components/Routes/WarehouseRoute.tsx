import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { WarehouseCode } from '../../lib/warehouseData';
import AssignmentList from '../AssignmentList';
import WeldingSuppliesView from '../WeldingSuppliesView';
import GenericSuppliesSection from '../GenericSuppliesSection';
import { UserRole } from '../../hooks/useRoles';

interface WarehouseRouteProps {
    role: any;
    assignments: any;
    config: any;
    searchQuery: string;
    searchResults: any;
    showEmptyOnly: boolean;
    itemToCopy: any;
    onInitiateCopy: (barcode: string, fromLocation: any, orderId?: string) => void;
    onPasteItem: (loc: any) => void;
    itemToMove: any;
    onInitiateMove: (barcode: string, fromLocation: any, orderId?: string) => void;
    onPasteMovedItem: (toLocation: any) => void;
    itemPendingDeletion: any;
    onInitiateDelete: (barcode: string, location: any, orderId?: string) => void;
    onConfirmDelete: () => void;
    onCancelDelete: () => void;
    onInitiateValidationFlow: (loc: any) => void;
    onDirectAssign: (barcode: string, orderId: string, loc: any) => void;
    onDirectRemove: (barcode: string, loc: any, orderId: string) => void | Promise<void>;
    onViewLocationDetails: (locId: any) => void;
    onDragMove: (barcode: string, fromLoc: any, toLoc: any) => void;
    onInitiateRelocate: (loc: any) => void;
    onInitiateEmptyShelf: (warehouse: any, shelf: any) => void | Promise<void>;
    onNotifyFinishedItem: (barcode: string, location: string, orderId: string) => void;
    collapsedShelves: any;
    toggleShelf: (wh: string, shelfId: string) => void;
    toggleAllShelves: (wh: string, collapsed: boolean) => void;
    canAssign: () => boolean;
    canRemove: (loc?: any) => boolean;
    canRequestItems: () => boolean;
    onInitiateRequest: (barcode: string, orderId: string, fromLoc: any) => void;
    workingItems: any;
    viewMode: 'grid' | 'list';
}

const WarehouseRoute: React.FC<WarehouseRouteProps> = ({
    role,
    assignments,
    config,
    searchQuery,
    searchResults,
    showEmptyOnly,
    itemToCopy,
    onInitiateCopy,
    onPasteItem,
    itemToMove,
    onInitiateMove,
    onPasteMovedItem,
    itemPendingDeletion,
    onInitiateDelete,
    onConfirmDelete,
    onCancelDelete,
    onInitiateValidationFlow,
    onDirectAssign,
    onDirectRemove,
    onViewLocationDetails,
    onDragMove,
    onInitiateRelocate,
    onInitiateEmptyShelf,
    onNotifyFinishedItem,
    collapsedShelves,
    toggleShelf,
    toggleAllShelves,
    canAssign,
    canRemove,
    canRequestItems,
    onInitiateRequest,
    workingItems,
    viewMode
}) => {
    const { code } = useParams<{ code: string }>();
    const { setActiveWarehouse } = useAppStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (code) {
            setActiveWarehouse(code);
        } else {
            // Fallback or redirect if no code? 
            // Usually won't happen if route is /warehouse/:code
        }
    }, [code, setActiveWarehouse]);

    // Handle invalid warehouse codes potentially, or just let it render default/empty

    switch (code) {
        case 'REP_SOL':
            return <WeldingSuppliesView userRole={role} />;
        case 'CARRO_SOL':
            return <GenericSuppliesSection userRole={role} title="Carro Soldadura" docId="CARRO_SOLDADURA" />;
        case 'CARRO_SXP':
            return <GenericSuppliesSection userRole={role} title="Carro SXP" docId="CARRO_SXP" totalShelves={4} />;
        case 'CARRO_RPL':
            return <GenericSuppliesSection userRole={role} title="Carro Autoplegadora" docId="CARRO_ROB_PLEGADO" totalShelves={4} />;
        default:
            return (
                <AssignmentList
                    assignments={assignments}
                    activeWarehouse={code as WarehouseCode}
                    config={config}
                    searchQuery={searchQuery}
                    searchResults={searchResults}
                    showEmptyOnly={showEmptyOnly}
                    itemToCopy={itemToCopy}
                    onInitiateCopy={onInitiateCopy}
                    onPasteItem={onPasteItem}
                    itemToMove={itemToMove}
                    onInitiateMove={onInitiateMove}
                    onPasteMovedItem={onPasteMovedItem}
                    itemPendingDeletion={itemPendingDeletion}
                    onInitiateDelete={onInitiateDelete}
                    onConfirmDelete={onConfirmDelete}
                    onCancelDelete={onCancelDelete}
                    onInitiateEmptyShelf={onInitiateEmptyShelf}
                    onInitiateValidationFlow={onInitiateValidationFlow}
                    onDirectAssign={onDirectAssign}
                    onDirectRemove={onDirectRemove}
                    onViewLocationDetails={onViewLocationDetails}
                    onDragMove={onDragMove}
                    onInitiateRelocate={onInitiateRelocate}
                    onNotifyFinishedItem={onNotifyFinishedItem}
                    collapsedShelves={collapsedShelves[code || ''] || {}}
                    onToggleShelf={(shelfId: string) => toggleShelf(code || '', shelfId)}
                    onToggleAllShelves={(collapsed: boolean) => toggleAllShelves(code || '', collapsed)}
                    userRole={role}
                    canAssign={canAssign}
                    canRemove={canRemove}
                    canRequestItems={canRequestItems}
                    onInitiateRequest={onInitiateRequest}
                    workingItems={workingItems}
                    viewMode={viewMode}
                />
            );
    }
};

export default WarehouseRoute;
