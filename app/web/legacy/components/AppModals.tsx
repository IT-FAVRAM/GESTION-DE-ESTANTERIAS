
import React, { Suspense } from 'react';
import { LoadingIcon } from './Icons';
import { LocationId, WarehouseCode } from '../lib/warehouseData';
import { validateCode } from '../lib/codeValidation';
import { can } from '../lib/permissionMatrix';

// Lazy Load Imports
import ManualEntryModal from './ManualEntryModal';
// const ManualEntryModal = React.lazy(() => import('./ManualEntryModal')); // Changed to static
const BatchAssignmentModal = React.lazy(() => import('./BatchAssignmentModal'));
const BatchScanner = React.lazy(() => import('./BatchScanner'));
const RequestReviewModal = React.lazy(() => import('./RequestReviewModal'));

const ValidationScanner = React.lazy(() => import('./ValidationScanner'));
const LocationDetailModal = React.lazy(() => import('./LocationDetailModal'));
import ShelfDetailModal from './ShelfDetailModal';
// const ShelfDetailModal = React.lazy(() => import('./ShelfDetailModal')); // Changed to static

const AdminPanel = React.lazy(() => import('./AdminPanel'));
const UserProfileModal = React.lazy(() => import('./UserProfileModal'));

const AssignmentModal = React.lazy(() => import('./AssignmentModal'));
const MoveItemModal = React.lazy(() => import('./MoveItemModal'));
const AddMethodModal = React.lazy(() => import('./AddMethodModal'));
const MoveConfirmationModal = React.lazy(() => import('./MoveConfirmationModal'));
const RemoveConfirmationModal = React.lazy(() => import('./RemoveConfirmationModal'));
const RequestConfirmationModal = React.lazy(() => import('./RequestConfirmationModal'));
const ProcessFinishedModal = React.lazy(() => import('./ProcessFinishedModal'));
const DuplicateItemModal = React.lazy(() => import('./DuplicateItemModal'));
import OccupiedLocationModal from './OccupiedLocationModal'; // Not lazy in App.tsx originally, but check usage
const MultiLocationSelector = React.lazy(() => import('./MultiLocationSelector'));
const RelocateLocationModal = React.lazy(() => import('./RelocateLocationModal'));
const PackageTypeModal = React.lazy(() => import('./PackageTypeModal'));
const EmptyLocationsModal = React.lazy(() => import('./EmptyLocationsModal'));
import Scanner from './Scanner';
// const Scanner = React.lazy(() => import('./Scanner')); // Changed to static
import { MigrationSolLocation } from './MigrationSolLocation';


interface AppModalsProps {
    activeWarehouse: string;
    modals: any;
    setModal: (key: string, val: boolean) => void;
    workflowMode: string;
    role: string | null;
    config: any;
    setConfig: any;
    assignments: any;
    setAssignments: any;
    history: any;
    setHistory: any;
    // Config Actions
    configActions: any;

    // Data States
    moveConfirmationData: any;
    removeConfirmationData: any;
    requestConfirmationData: any;
    processFinishedData: any;
    occupiedLocationData: any;
    duplicateItemData: any;
    batchItems: any[];
    pendingAssignment: any;
    itemToMove: any;
    itemToCopy: any;
    addItemTarget: any;
    inputMethodModal: any;
    selectedMapLocation: any;

    // Setters
    setMoveConfirmationData: (val: any) => void;
    setRemoveConfirmationData: (val: any) => void;
    setRequestConfirmationData: (val: any) => void;
    setProcessFinishedData: (val: any) => void;
    setOccupiedLocationData: (val: any) => void;
    setDuplicateItemData: (val: any) => void;
    setBatchItems: (val: any) => void;
    setPendingAssignment: (val: any) => void;
    setItemToMove: (val: any) => void;
    setItemToCopy: (val: any) => void;
    setAddItemTarget: (val: any) => void;
    setInputMethodModal: (val: any) => void;
    setSelectedMapLocation: (val: any) => void;
    relocateSourceLoc: any;

    // Logic Handlers
    handleConfirmMove: () => void;
    handleConfirmRemove: () => void;
    handleConfirmRequest: () => void;
    handleConfirmProcessFinish: () => void;
    handleConfirmOccupiedAssignment: (mode: 'merge' | 'new_batch') => void;
    handleDuplicateMove: () => void;
    handleDuplicateAdd: () => void;

    withdrawItem: (barcode: string, location: LocationId, orderId?: string) => Promise<boolean>;
    handleConfirmBatchRequest: () => void;


    handleSelectManualAdd: () => void;
    handleSelectPhotoAdd: () => void;

    handleWorkflowScan: (text: string) => void;
    handlePhotoAnalysisResult: (res: any) => void;
    handleLocationCaptureResult: (res: any) => void;

    multiSelectedLocations: any[];
    resetScanWorkflow: () => void;

    handleValidationSuccess: () => void;
    handleBatchScanComplete: (items: any[]) => void;
    handleBatchAssignmentMap: (items: any[]) => void;
    handleMultiLocationSelectionConfirm: (locs: any[]) => void;

    handleAssignmentModalConfirm: (barcode: string, loc: any) => void;
    handleFinishProduction: () => void;

    handleMoveModalConfirm: (loc: any) => void;
    handleRelocate: any;

    // Location Detail Handlers
    handleInitiateCopy: (b: string, l: any, o?: string) => void;
    handleInitiateMove: (b: string, l: any, o?: string) => void;
    handleInitiateDelete: (b: string, l: any, o?: string) => void;
    handlePendingDeleteConfirm: () => Promise<void>;
    handleInitiateAdd: (l: any) => void;
    handlePasteMovedItem: (l: any) => void;
    checkLocationAndAssign: (b: string, o: string, l: any, m: any) => void; // needed for shelf detail logic
    copyItem: any; // needed
    removeItem: any; // needed
    assignItem: any; // needed
    notify: any; // needed
    formatLocation: (l: any) => string;

    // Extra Modals
    // Restored props
    confirmEmptyLocations: (ids: string[]) => Promise<void>;
    handlePackageTypeSelect: (type: any) => void;
    setPendingPackageTypeData: (val: any) => void;

    canAssign: () => boolean;

    shelfDetailMode: 'view' | 'add_choice';
    setShelfDetailMode: (val: 'view' | 'add_choice') => void;
}

export const AppModals: React.FC<AppModalsProps> = (props) => {

    // Destructure commonly used props for cleaner JSX
    const {
        modals, setModal, assignments, role, config,
        moveConfirmationData, removeConfirmationData, requestConfirmationData, processFinishedData,
        occupiedLocationData, duplicateItemData, batchItems, pendingAssignment,
        itemToMove, itemToCopy, addItemTarget, inputMethodModal, selectedMapLocation,
        multiSelectedLocations,
        workflowMode
    } = props;

    return (
        <Suspense fallback={<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20"><LoadingIcon className="h-10 w-10 text-cyan-500" /></div>}>

            {/* CONFIRMATION MODALS */}
            {moveConfirmationData && <MoveConfirmationModal item={moveConfirmationData} onConfirm={props.handleConfirmMove} onCancel={() => props.setMoveConfirmationData(null)} />}
            {requestConfirmationData && <RequestConfirmationModal item={requestConfirmationData} onConfirm={props.handleConfirmRequest} onCancel={() => props.setRequestConfirmationData(null)} />}
            {processFinishedData && <ProcessFinishedModal item={processFinishedData} onConfirm={props.handleConfirmProcessFinish} onCancel={() => props.setProcessFinishedData(null)} />}

            {/* NEW OCCUPIED LOCATION MODAL */}
            {occupiedLocationData && (
                <OccupiedLocationModal
                    locationId={occupiedLocationData.locationId}
                    newItem={occupiedLocationData.newItem}
                    existingItems={assignments[occupiedLocationData.locationId] || []}
                    onConfirm={props.handleConfirmOccupiedAssignment}
                    onCancel={() => props.setOccupiedLocationData(null)}
                />
            )}

            {duplicateItemData && (
                <DuplicateItemModal
                    item={duplicateItemData}
                    onMove={props.handleDuplicateMove}
                    onAdd={props.handleDuplicateAdd}
                    onCancel={() => props.setDuplicateItemData(null)}
                />
            )}

            {removeConfirmationData && (
                <Suspense fallback={null}>
                    <RemoveConfirmationModal
                        item={removeConfirmationData}
                        onConfirm={props.handleConfirmRemove}
                        onCancel={() => { props.setRemoveConfirmationData(null); props.resetScanWorkflow(); }}
                        onWithdraw={async () => {
                            if (!removeConfirmationData) return;
                            const { barcode, location, orderId } = removeConfirmationData;
                            const success = await props.withdrawItem(barcode, location as LocationId, orderId);
                            if (success) {
                                props.setRemoveConfirmationData(null);
                                props.resetScanWorkflow();
                            }
                        }}
                    />
                </Suspense>
            )}

            {modals.requestReview && (
                <RequestReviewModal
                    items={batchItems}
                    onConfirm={props.handleConfirmBatchRequest}
                    onClose={() => props.setModal('requestReview', false)}
                    onRemoveItem={(index) => props.setBatchItems(batchItems.filter((_, i) => i !== index))}
                />
            )}

            {(addItemTarget || inputMethodModal) && !modals.photoAnalyzer && !modals.manualEntry && !moveConfirmationData && !modals.locationCapture && (
                <AddMethodModal
                    title={inputMethodModal?.title || 'Añadir Artículo'}
                    subtitle={inputMethodModal?.subtitle || (addItemTarget ? props.formatLocation(addItemTarget) : undefined)}
                    onSelectManual={() => {
                        props.handleSelectManualAdd();
                        props.setInputMethodModal(null);
                    }}
                    onSelectPhoto={() => {
                        props.handleSelectPhotoAdd();
                        props.setInputMethodModal(null);
                    }}
                    onClose={() => {
                        props.setAddItemTarget(null);
                        props.setInputMethodModal(null);
                    }}
                />
            )}

            {modals.scanner && (
                <React.Suspense fallback={null}>
                    <Scanner
                        onScan={props.handleWorkflowScan}
                        onClose={() => setModal('scanner', false)}
                        onValidate={(code) => {
                            const result = validateCode(code, workflowMode === 'finish');
                            return {
                                isValid: result.isValid,
                                message: result.message,
                                details: result.details,
                                type: result.severity as any
                            };
                        }}
                        onPhotoRequest={() => { setModal('scanner', false); setModal('photoAnalyzer', true); }}
                        instruction={workflowMode === 'request' ? "Escanee artículo para solicitar" : "Escanee artículo o ubicación"}
                    />
                </React.Suspense>
            )}
            {/* Note: Scanner component code is missing from my memory read of imports. 
                 It was 'import Scanner from ./components/Scanner' in App.tsx line 18.
                 I need to import it. I'll use lazy for consistency here.
              */}

            {modals.manualEntry && (
                <ManualEntryModal
                    onSubmit={props.handlePhotoAnalysisResult}
                    onClose={() => {
                        setModal('manualEntry', false);
                        if (multiSelectedLocations.length > 0) props.resetScanWorkflow();
                        if (addItemTarget) props.setAddItemTarget(null);
                        if (inputMethodModal) props.setInputMethodModal(null);
                    }}
                    isFreeTextMode={false} // logic was (isFreeTextTarget which was false)
                />
            )}

            {modals.validationScanner && pendingAssignment?.location && (
                <ValidationScanner
                    targetLocation={pendingAssignment.location}
                    onSuccess={props.handleValidationSuccess}
                    onClose={() => { setModal('validationScanner', false); props.resetScanWorkflow(); }}
                />
            )}

            {modals.batchScanner && (
                <BatchScanner
                    onComplete={props.handleBatchScanComplete}
                    onClose={() => { setModal('batchScanner', false); }}
                    mode={workflowMode === 'request' ? 'request' : 'assign'}
                />
            )}

            {modals.batchAssignment && (
                <BatchAssignmentModal
                    items={batchItems}
                    onAssignBatch={props.handleBatchAssignmentMap}
                    onClose={() => setModal('batchAssignment', false)}
                    assignments={assignments}
                    config={config}
                />
            )}

            {modals.multiLocationSelector && (
                <MultiLocationSelector
                    isOpen={true}
                    onClose={() => setModal('multiLocationSelector', false)}
                    onConfirm={props.handleMultiLocationSelectionConfirm}
                    assignments={assignments}
                    config={config}
                />
            )}

            {modals.assignment && ((pendingAssignment && !moveConfirmationData) || (multiSelectedLocations.length > 0)) && props.canAssign() && (
                <AssignmentModal
                    barcode={pendingAssignment?.article || ''}
                    orderId={pendingAssignment?.order || ''}
                    onAssign={props.handleAssignmentModalConfirm}
                    onClose={() => { setModal('assignment', false); }}
                    onScanRequest={() => setModal('scanner', true)}
                    onFinishProduction={props.handleFinishProduction}
                    assignments={assignments}
                    config={config}
                    isBatchMode={false}
                />
            )}

            {modals.move && itemToMove && props.canAssign() && (
                <MoveItemModal
                    item={itemToMove}
                    onMove={props.handleMoveModalConfirm}
                    onClose={() => { setModal('move', false); props.setItemToMove(null); }}
                    config={config}
                    assignments={assignments}
                />
            )}

            {modals.adminPanel && (role === 'ADMIN' || role === 'JEFE') && (
                <AdminPanel
                    currentUserRole={role}
                    config={config}
                    setConfig={props.setConfig}
                    onClose={() => setModal('adminPanel', false)}
                    assignments={assignments}
                    setAssignments={props.setAssignments}
                    history={props.history}
                    setHistory={props.setHistory}
                    {...props.configActions}
                />
            )}

            {modals.relocate && props.relocateSourceLoc && (
                <RelocateLocationModal
                    sourceLocationId={props.relocateSourceLoc}
                    onRelocate={props.handleRelocate}
                    onClose={() => {
                        setModal('relocate', false);
                    }}
                    assignments={assignments}
                    config={config} />
            )}

            {modals.userProfile && (
                <UserProfileModal
                    onClose={() => props.setModal('userProfile', false)}
                    currentRole={props.role}
                    onRoleChange={() => { }}
                />
            )}

            {/* Logic for ShelfDetailModal (Plegado Carts) */}
            {selectedMapLocation && (() => {
                const isPlegadoCart = selectedMapLocation.includes('PLE C1') || selectedMapLocation.includes('PLE C2');

                if (isPlegadoCart) {
                    const cartName = selectedMapLocation.includes('PLE C1') ? 'Carro 1' : 'Carro 2';
                    const shelfNum = selectedMapLocation.split('C')[1].split('-')[1];
                    const shelfLabel = `Balda ${shelfNum} `;

                    const adaptedItems = (assignments[selectedMapLocation] || []).map((item: any) => ({
                        id: `${item.barcode} -${item.orderId} `,
                        shelfId: shelfNum,
                        type: (item.orderId === 'GENERAL' ? 'plain' : 'article') as 'article' | 'plain',
                        description: item.orderId === 'GENERAL' ? item.barcode : `ART: ${item.barcode} | OF: ${item.orderId} `,
                        barcode: item.barcode,
                        orderId: item.orderId,
                        addedBy: 'user',
                        createdAt: item.timestamp
                    }));

                    const handleAddAdapted = async (type: 'article' | 'plain', data: any) => {
                        if (type === 'article') {
                            const { barcode, orderId } = data;
                            props.assignItem(barcode, orderId, selectedMapLocation, { allowMultiLocation: true });
                            props.notify('success', 'Añadido', `${barcode} añadido al carro.`);
                        } else {
                            const text = data.description.toUpperCase();
                            props.assignItem(text, 'GENERAL', selectedMapLocation, { allowMultiLocation: true });
                            props.notify('success', 'Nota Añadida', `Nota añadida al carro.`);
                        }
                    };

                    const handleRemoveAdapted = async (ids: string[]) => {
                        const itemsToRemove = (assignments[selectedMapLocation] || []).filter((item: any) =>
                            ids.includes(`${item.barcode} -${item.orderId} `)
                        );
                        for (const item of itemsToRemove) {
                            props.removeItem(item.barcode, selectedMapLocation, item.orderId);
                        }
                        props.notify('success', 'Eliminado', `${itemsToRemove.length} elementos retirados.`);
                    };

                    const handleMoveAdapted = async (ids: string[], targetShelf: string) => {
                        const part1 = selectedMapLocation.substring(0, selectedMapLocation.lastIndexOf('-'));
                        const targetLocId = `${part1} -${targetShelf} `;

                        const itemsToMove = (assignments[selectedMapLocation] || []).filter((item: any) =>
                            ids.includes(`${item.barcode} -${item.orderId} `)
                        );
                        for (const item of itemsToMove) {
                            props.checkLocationAndAssign(item.barcode, item.orderId, targetLocId, 'move');
                        }
                    };

                    return (
                        <ShelfDetailModal
                            cartName={cartName}
                            shelfId={shelfNum}
                            shelfLabel={shelfLabel}
                            items={adaptedItems}
                            onClose={() => props.setSelectedMapLocation(null)}
                            onAddItem={handleAddAdapted}
                            onRemoveItems={handleRemoveAdapted}
                            onMoveItems={handleMoveAdapted}
                            availableShelves={[1, 2, 3, 4]}
                            userRole={role!}
                            initialMode={props.shelfDetailMode}
                        />
                    );
                }

                return (
                    <LocationDetailModal
                        locationId={selectedMapLocation}
                        assignments={assignments}
                        onClose={() => props.setSelectedMapLocation(null)}
                        onInitiateCopy={props.handleInitiateCopy}
                        onInitiateMove={props.handleInitiateMove}
                        onInitiateDelete={props.handleInitiateDelete}
                        onInitiateAdd={props.handleInitiateAdd}
                        onPasteItem={() => itemToCopy && props.copyItem(itemToCopy.barcode, itemToCopy.fromLocation, selectedMapLocation, itemToCopy.orderId)}
                        onPasteMovedItem={() => props.handlePasteMovedItem(selectedMapLocation)}
                        onEmptyLocation={async (locationId) => {
                            const itemsInLocation = assignments[locationId] || [];
                            if (itemsInLocation.length === 0) return;

                            let removed = 0;
                            for (const item of itemsInLocation) {
                                const ok = await props.removeItem(item.barcode, locationId, item.orderId);
                                if (ok) removed++;
                            }

                            if (removed === itemsInLocation.length) {
                                props.notify('success', 'Ubicación vaciada', `${removed} artículo(s) retirados de ${locationId}.`);
                            } else {
                                props.notify('warning', 'Vaciado parcial', `Se retiraron ${removed}/${itemsInLocation.length} artículos de ${locationId}.`);
                            }
                        }}
                        canPasteCopy={can(role, 'copyPaste') && !!itemToCopy && itemToCopy.fromLocation !== selectedMapLocation}
                        canPasteMove={can(role, 'dragMove') && !!itemToMove && itemToMove.fromLocation !== selectedMapLocation}
                    />
                );
            })()}

            {modals.emptyLocations && (
                <EmptyLocationsModal
                    isOpen={modals.emptyLocations}
                    onClose={() => props.setModal('emptyLocations', false)}
                    activeWarehouseId={props.activeWarehouse as WarehouseCode}
                    assignments={assignments}
                    onConfirm={props.confirmEmptyLocations}
                />
            )}
            {modals.packageType && (
                <PackageTypeModal
                    onSelect={props.handlePackageTypeSelect}
                    onClose={() => {
                        props.setModal('packageType', false);
                        props.setPendingPackageTypeData(null);
                        props.resetScanWorkflow();
                    }}
                />
            )}
            <MigrationSolLocation assignments={assignments} setAssignments={props.setAssignments} />
        </Suspense>
    );
};
