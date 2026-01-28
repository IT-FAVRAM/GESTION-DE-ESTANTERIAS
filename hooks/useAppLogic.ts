
import { useState, useCallback, useMemo } from 'react';
import { LocationId, PackageType, formatLocation } from '../lib/warehouseData';
import { BatchItem } from '../App';
import { useAppStore } from '../lib/store';
import { validateCode } from '../lib/codeValidation';
import { parseLocationFromText } from '../lib/locationParser';

// Type definitions for dependencies
interface UseAppLogicProps {
    assignments: Record<string, any[]>;
    setAssignments: (a: any) => void;
    addHistoryEntry: (entry: any) => void;
    addFinishedItem: (item: any) => void;
    notify: (type: any, title: string, message: string) => void;
    assignItem: (barcode: string, orderId: string, location: LocationId | LocationId[], options?: any) => void;
    requestItem: (article: string, order: string) => void;
    removeItem: (barcode: string, location: LocationId, orderId?: string) => boolean;
    findItemLocation: (barcode: string, orderId?: string) => LocationId | null;
    batchAssignToSingleLocation: (items: BatchItem[], location: LocationId) => void;
    canAssign: () => boolean;
    canRemove: (loc?: string) => boolean;
    canRequestItems: () => boolean;
    canFinishProduction: () => boolean;
    shouldSkipValidation: () => boolean;
    resetScanWorkflow: () => void;
    processScanInput: (code: string, orderId?: string) => void;
}

export const useAppLogic = ({
    assignments,
    addHistoryEntry,
    addFinishedItem,
    notify,
    assignItem,
    requestItem,
    removeItem,
    findItemLocation,
    batchAssignToSingleLocation,
    canAssign,
    canRemove,
    canRequestItems,
    canFinishProduction,
    shouldSkipValidation,
    resetScanWorkflow,
    processScanInput
}: UseAppLogicProps) => {

    const {
        workflowMode, setWorkflowMode,
        setModal,
        pendingAssignment, setPendingAssignment,
        batchItems, setBatchItems
    } = useAppStore();

    // Local State
    const [multiSelectedLocations, setMultiSelectedLocations] = useState<LocationId[]>([]);
    const [relocateSourceLoc, setRelocateSourceLoc] = useState<LocationId | null>(null);
    const [pendingPackageTypeData, setPendingPackageTypeData] = useState<{
        barcode: string;
        orderId: string;
        location: LocationId | LocationId[];
        allowMultiLocation: boolean;
    } | null>(null);

    const [itemToCopy, setItemToCopy] = useState<{ barcode: string; fromLocation: LocationId; orderId?: string } | null>(null);
    const [itemToMove, setItemToMove] = useState<{ barcode: string; fromLocation: LocationId; orderId?: string } | null>(null);
    const [itemPendingDeletion, setItemPendingDeletion] = useState<{ barcode: string; location: LocationId; orderId?: string } | null>(null);

    const [addItemTarget, setAddItemTarget] = useState<LocationId | null>(null);
    const [inputMethodModal, setInputMethodModal] = useState<{ title: string, subtitle?: string } | null>(null);
    const [selectedMapLocation, setSelectedMapLocation] = useState<LocationId | null>(null);
    const [shelfDetailMode, setShelfDetailMode] = useState<'view' | 'add_choice'>('view');

    // Confirmation Data State
    const [moveConfirmationData, setMoveConfirmationData] = useState<{ barcode: string; orderId: string; currentLoc: string; targetLoc: string } | null>(null);
    const [removeConfirmationData, setRemoveConfirmationData] = useState<{ barcode: string; orderId: string; location: string } | null>(null);
    const [requestConfirmationData, setRequestConfirmationData] = useState<{ barcode: string; orderId: string; location?: string } | null>(null);
    const [processFinishedData, setProcessFinishedData] = useState<{ barcode: string; orderId: string; location: string } | null>(null);
    const [duplicateItemData, setDuplicateItemData] = useState<{ barcode: string; orderId: string; location: string } | null>(null);

    // Occupied Data State
    const [occupiedLocationData, setOccupiedLocationData] = useState<{ locationId: LocationId; newItem: { barcode: string; orderId: string }; mode: 'move' | 'add' } | null>(null);


    // --- HANDLERS ---

    const handleInitiateRemoveWorkflow = () => {
        setWorkflowMode('remove');
        resetScanWorkflow();
        setInputMethodModal({ title: 'Retirar Artículo', subtitle: 'Seleccione cómo identificar el artículo' });
    };

    const handleInitiateRequestWorkflow = () => {
        if (!canRequestItems()) return;
        setWorkflowMode('request');
        resetScanWorkflow();
        setInputMethodModal({ title: 'Realizar Solicitud', subtitle: 'Escanee o introduzca manualmente los artículos' });
    };

    const handleInitiateFinishWorkflow = () => {
        if (!canFinishProduction()) return;
        setWorkflowMode('finish');
        resetScanWorkflow();
        setModal('photoAnalyzer', true);
    };

    const handleInitiateAdd = (locationId: LocationId) => {
        if (!canAssign()) {
            notify('error', 'Permiso Denegado', 'No tiene permisos para añadir artículos.');
            return;
        }

        if (locationId.includes('PLE C1') || locationId.includes('PLE C2')) {
            setSelectedMapLocation(locationId);
            setShelfDetailMode('add_choice');
            return;
        }

        setWorkflowMode('assign');
        setAddItemTarget(locationId);
        setInputMethodModal({ title: 'Añadir a Ubicación', subtitle: formatLocation(locationId) });
    };

    const handleSelectManualAdd = () => {
        setModal('manualEntry', true);
    };

    const handleSelectPhotoAdd = () => {
        setModal('photoAnalyzer', true);
    };

    const handleFabClick = () => {
        setWorkflowMode('assign');
        resetScanWorkflow();
        setModal('photoAnalyzer', true);
    };

    const handleInitiateCopy = (barcode: string, fromLocation: LocationId, orderId?: string) => {
        if (!canAssign()) return;
        setItemToMove(null);
        setItemToCopy(prev => (prev?.barcode === barcode && prev?.fromLocation === fromLocation && prev?.orderId === orderId) ? null : { barcode, fromLocation, orderId });
        if (selectedMapLocation) setSelectedMapLocation(null);
    };

    const handleInitiateMove = (barcode: string, fromLocation: LocationId, orderId?: string) => {
        if (!canAssign()) return;
        setItemToCopy(null);
        setItemToMove({ barcode, fromLocation, orderId });
        setModal('move', true);
        if (selectedMapLocation) setSelectedMapLocation(null);
    };

    const handlePasteMovedItem = (toLocation: LocationId) => {
        if (!itemToMove) return;
        checkLocationAndAssign(itemToMove.barcode, itemToMove.orderId || 'PENDIENTE', toLocation, 'move');
        setItemToMove(null);
    };

    const handleDragMove = (barcode: string, fromLocation: LocationId, toLocation: LocationId) => {
        if (!canAssign()) return;
        if (fromLocation === toLocation) return;
        const item = assignments[fromLocation]?.find(i => i.barcode === barcode);
        if (item) {
            checkLocationAndAssign(barcode, item.orderId, toLocation, 'move');
        }
    };

    const handleMoveItemModalConfirm = (toLocation: LocationId) => {
        if (itemToMove) {
            checkLocationAndAssign(itemToMove.barcode, itemToMove.orderId || 'PENDIENTE', toLocation, 'move');
            setModal('move', false);
            setItemToMove(null);
        }
    };


    const handleInitiateMultiOccupancy = () => {
        if (!canAssign()) return;
        setWorkflowMode('assign');
        resetScanWorkflow();
        setModal('multiLocationSelector', true);
    };

    const handleMultiLocationSelectionConfirm = (locations: LocationId[]) => {
        setMultiSelectedLocations(locations);
        setModal('multiLocationSelector', false);
        setTimeout(() => setModal('photoAnalyzer', true), 100);
    };

    const checkLocationAndAssign = (
        barcode: string,
        orderId: string,
        targetLocation: LocationId,
        mode: 'move' | 'add',
        onSuccess?: () => void
    ) => {
        const existingItems = assignments[targetLocation] || [];
        const isOccupied = existingItems.length > 0;

        if (isOccupied) {
            setOccupiedLocationData({
                locationId: targetLocation,
                newItem: { barcode, orderId },
                mode
            });
            if (onSuccess) onSuccess();
            return;
        }

        setPendingPackageTypeData({
            barcode,
            orderId,
            location: targetLocation,
            allowMultiLocation: mode === 'add'
        });
        setModal('packageType', true);
        if (onSuccess) onSuccess();
    };

    const handleConfirmMove = () => {
        if (!moveConfirmationData) return;
        const { barcode, orderId, targetLoc } = moveConfirmationData;

        checkLocationAndAssign(barcode, orderId, targetLoc as LocationId, 'move', () => {
            setMoveConfirmationData(null);
        });
    };

    const handleConfirmRemove = () => {
        if (!removeConfirmationData) return;
        const { barcode, location, orderId } = removeConfirmationData;

        if (!canRemove(location)) {
            notify('error', 'Permiso Denegado', `No tienes permisos para retirar artículos de ${formatLocation(location)}.`);
            setRemoveConfirmationData(null);
            resetScanWorkflow();
            return;
        }

        const success = removeItem(barcode, location as LocationId, orderId);
        if (success) {
            notify('success', 'Retirado', `${barcode} eliminado de ${formatLocation(location)}`);
        }
        setRemoveConfirmationData(null);
        resetScanWorkflow();
    };

    const handleInitiateDelete = (barcode: string, location: LocationId, orderId?: string) => {
        if (!canRemove(location)) {
            notify('error', 'Permiso Denegado', `No tienes permisos para retirar artículos de ${formatLocation(location)}.`);
            return;
        }
        setItemPendingDeletion({ barcode, location, orderId });
    };

    const handlePendingDeleteConfirm = () => {
        if (!itemPendingDeletion) return;
        const success = removeItem(itemPendingDeletion.barcode, itemPendingDeletion.location, itemPendingDeletion.orderId);
        setItemPendingDeletion(null);
        if (success) {
            notify('success', 'Retirado', 'Artículo eliminado correctamente.');
        }
    };


    const handleConfirmProcessFinish = () => {
        if (!processFinishedData) return;
        const { barcode, orderId, location } = processFinishedData;
        const now = new Date().toISOString();
        const success = removeItem(barcode, location as LocationId, orderId);

        if (success) {
            addHistoryEntry({ barcode, orderId, action: 'process_finished', fromLocation: location as LocationId, timestamp: now });
            addFinishedItem({ barcode, orderId, timestamp: now, finishedAt: now, status: 'FINALIZADO' });
            notify('success', 'Producción Finalizada', `El artículo ${barcode} ha pasado a ALMACÉN.`);
        }
        setProcessFinishedData(null);
        resetScanWorkflow();
    };

    const handleFinishProduction = () => {
        setModal('assignment', false);
        if (pendingAssignment) {
            const currentLoc = findItemLocation(pendingAssignment.article, pendingAssignment.order);
            if (currentLoc) {
                setProcessFinishedData({ barcode: pendingAssignment.article, orderId: pendingAssignment.order, location: currentLoc });
            }
        }
    };


    const handleConfirmBatchRequest = () => {
        if (batchItems.length === 0) return;
        batchItems.forEach(item => requestItem(item.article, item.order));
        notify('success', 'Solicitud Múltiple Enviada', `Se han notificado ${batchItems.length} artículos al carretillero.`);
        setBatchItems([]);
        setModal('requestReview', false);
        setWorkflowMode('assign');
    };

    const handleInitiateRequest = (barcode: string, orderId: string, fromLocation: LocationId) => {
        if (!canRequestItems()) {
            notify('error', 'Permiso Denegado', 'No tiene permisos para solicitar artículos.');
            return;
        }
        setRequestConfirmationData({ barcode, orderId, location: fromLocation });
    };

    const handleConfirmRequest = (priority: 'normal' | 'high' = 'normal') => {
        if (!requestConfirmationData) return;
        requestItem(requestConfirmationData.barcode, requestConfirmationData.orderId, requestConfirmationData.location as LocationId, priority);
        setRequestConfirmationData(null);
        resetScanWorkflow();
    };


    const handleDuplicateMove = () => {
        if (duplicateItemData) {
            setPendingAssignment({ article: duplicateItemData.barcode, order: duplicateItemData.orderId, location: undefined, mode: 'move' });
            setDuplicateItemData(null);
            setModal('locationCapture', true);
        }
    };

    const handleDuplicateAdd = () => {
        if (duplicateItemData) {
            setPendingAssignment({ article: duplicateItemData.barcode, order: duplicateItemData.orderId, location: undefined, mode: 'add' });
            setDuplicateItemData(null);
            setModal('locationCapture', true);
        }
    };

    const handleConfirmOccupiedAssignment = (mode: 'merge' | 'new_batch') => {
        if (!occupiedLocationData) return;
        const { newItem, locationId } = occupiedLocationData;
        const forceMulti = mode === 'new_batch';
        assignItem(newItem.barcode, newItem.orderId, locationId, { allowMultiLocation: forceMulti });

        if (mode === 'merge') notify('success', 'Lote Actualizado', `${newItem.barcode} unificado en ${formatLocation(locationId)}`);
        else notify('success', 'Nuevo Lote Añadido', `${newItem.barcode} añadido a ${formatLocation(locationId)}`);

        setOccupiedLocationData(null);
        resetScanWorkflow();
    };

    const handleDirectAssign = useCallback((barcode: string, orderId: string, location: LocationId) => {
        assignItem(barcode, orderId, location, { allowMultiLocation: true });
        notify('success', 'Añadido', `${barcode} añadido a ${formatLocation(location)}`);
    }, [assignItem, notify]);

    const handleDirectRemove = useCallback((barcode: string, location: LocationId, orderId: string) => {
        const success = removeItem(barcode, location, orderId);
        if (success) notify('success', 'Eliminado', `${barcode} retirado de ${formatLocation(location)}`);
    }, [removeItem, notify]);

    const handlePackageTypeSelect = (packageType: PackageType) => {
        if (!pendingPackageTypeData) return;
        const { barcode, orderId, location, allowMultiLocation } = pendingPackageTypeData;

        assignItem(barcode, orderId, location, { allowMultiLocation, packageType });
        const locText = Array.isArray(location) ? `${location.length} ubicaciones` : formatLocation(location);
        notify('success', 'Asignado', `${barcode} -> ${locText}`);

        setModal('packageType', false);
        setPendingPackageTypeData(null);
        resetScanWorkflow();
    };

    const handlePhotoAnalysisResult = (result: string | { article: string; order: string }) => {
        let barcode = '';
        let orderId = 'PENDIENTE';
        if (typeof result === 'object') {
            barcode = result.article;
            orderId = result.order;
        } else {
            barcode = result;
        }

        if (multiSelectedLocations.length > 0) {
            setModal('photoAnalyzer', false);
            assignItem(barcode, orderId, multiSelectedLocations, { allowMultiLocation: true });
            notify('success', 'Asignación Masiva', `Artículo ${barcode} asignado a ${multiSelectedLocations.length} ubicaciones.`);
            resetScanWorkflow();
            return;
        }
        processScanInput(barcode, orderId);
    };

    const handleLocationCaptureResult = (extractedText: string | { article: string; order: string }) => {
        let locationText = typeof extractedText === 'string' ? extractedText.toUpperCase().trim() : '';
        if (!locationText) return;

        if (locationText.includes("ALMACEN") || locationText.includes("ALMACÉN") || locationText.includes("FINAL")) {
            if (batchItems.length > 0) {
                const now = new Date().toISOString();
                batchItems.forEach(item => {
                    const currentLoc = findItemLocation(item.article, item.order);
                    if (currentLoc) removeItem(item.article, currentLoc, item.order);
                    addHistoryEntry({ barcode: item.article, orderId: item.order, action: 'process_finished', fromLocation: currentLoc || undefined, timestamp: now });
                    addFinishedItem({ barcode: item.article, orderId: item.order, timestamp: now, finishedAt: now, status: 'FINALIZADO' });
                });
                notify('success', 'Lote Finalizado', `${batchItems.length} artículos movidos a ALMACÉN.`);
                setModal('locationCapture', false);
                setBatchItems([]);
                resetScanWorkflow();
                return;
            }

            if (pendingAssignment) {
                const currentLoc = findItemLocation(pendingAssignment.article, pendingAssignment.order);
                if (currentLoc) {
                    setProcessFinishedData({ barcode: pendingAssignment.article, orderId: pendingAssignment.order, location: currentLoc });
                    setModal('locationCapture', false);
                } else {
                    notify('error', 'Error', 'El artículo no está asignado, no se puede finalizar.');
                    resetScanWorkflow();
                }
                return;
            }
        }

        const matchedLocation = parseLocationFromText(locationText, assignments);

        if (matchedLocation) {
            if (batchItems.length > 0) {
                batchAssignToSingleLocation(batchItems, matchedLocation);
                setModal('locationCapture', false);
                setBatchItems([]);
                resetScanWorkflow();
                return;
            }

            if (pendingAssignment) {
                const intent = pendingAssignment.mode || 'move';
                if (intent === 'add') {
                    setModal('locationCapture', false);
                    checkLocationAndAssign(pendingAssignment.article, pendingAssignment.order, matchedLocation, 'add');
                } else {
                    const currentLoc = findItemLocation(pendingAssignment.article, pendingAssignment.order);
                    setModal('locationCapture', false);
                    if (currentLoc && currentLoc !== matchedLocation) {
                        setMoveConfirmationData({ barcode: pendingAssignment.article, orderId: pendingAssignment.order, currentLoc: currentLoc, targetLoc: matchedLocation });
                    } else {
                        checkLocationAndAssign(pendingAssignment.article, pendingAssignment.order, matchedLocation, 'move');
                    }
                }
            }
        } else {
            notify('error', 'Ubicación no reconocida', `Texto detectado: "${locationText}". Inténtelo de nuevo.`);
        }
    };

    const handleWorkflowScan = useCallback((decodedText: string) => {
        const result = validateCode(decodedText);
        const code = result.normalizedCode;
        if (result.type === 'special' && code === 'ALMACEN') {
            if (pendingAssignment) {
                const location = findItemLocation(pendingAssignment.article, pendingAssignment.order);
                if (location) {
                    setProcessFinishedData({ barcode: pendingAssignment.article, orderId: pendingAssignment.order, location });
                    setModal('scanner', false);
                    setModal('assignment', false);
                }
            }
            return;
        }
        processScanInput(code, 'PENDIENTE');
    }, [pendingAssignment, findItemLocation, processScanInput]);

    const handleAssignmentModalConfirm = (barcode: string, locationOrLocations: LocationId | LocationId[]) => {
        if (!canAssign()) return;
        const targetLocs = Array.isArray(locationOrLocations) ? locationOrLocations : [locationOrLocations];
        const singleTarget = targetLocs[0];

        setModal('assignment', false);
        const finalOrder = pendingAssignment?.order || 'PENDIENTE';
        const intent = pendingAssignment?.mode || 'move';

        setPendingAssignment(pendingAssignment ? { ...pendingAssignment, location: singleTarget } : { article: barcode, order: finalOrder, location: singleTarget, mode: intent });

        if (targetLocs.length > 1) {
            assignItem(barcode, finalOrder, locationOrLocations, { allowMultiLocation: true });
            notify('success', 'Asignado Múltiple', `Artículo asignado a ${targetLocs.length} ubicaciones.`);
            resetScanWorkflow();
        } else {
            if (shouldSkipValidation()) {
                checkLocationAndAssign(barcode, finalOrder, singleTarget, intent);
            } else {
                setModal('validationScanner', true);
            }
        }
    };

    const handleValidationSuccess = () => {
        if (pendingAssignment && pendingAssignment.location) {
            const intent = pendingAssignment.mode || 'move';
            const existingLoc = findItemLocation(pendingAssignment.article, pendingAssignment.order);

            if (intent === 'add') {
                checkLocationAndAssign(pendingAssignment.article, pendingAssignment.order, pendingAssignment.location, 'add');
            } else {
                if (existingLoc && existingLoc !== pendingAssignment.location) {
                    setMoveConfirmationData({ barcode: pendingAssignment.article, orderId: pendingAssignment.order, currentLoc: existingLoc, targetLoc: pendingAssignment.location });
                } else {
                    checkLocationAndAssign(pendingAssignment.article, pendingAssignment.order, pendingAssignment.location, 'move');
                }
            }
        }
        setModal('validationScanner', false);
    };

    const handleBatchScanComplete = (items: BatchItem[]) => {
        setBatchItems(items);
        setModal('batchScanner', false);
        if (workflowMode === 'request') {
            setModal('requestReview', true);
        } else {
            setModal('locationCapture', true);
        }
    };

    const handleBatchAssignmentMap = (mappedItems: { item: BatchItem; location: LocationId }[]) => {
        setModal('batchAssignment', false);
        const groupedByLoc: Record<string, BatchItem[]> = {};
        mappedItems.forEach(entry => {
            if (!groupedByLoc[entry.location]) groupedByLoc[entry.location] = [];
            groupedByLoc[entry.location].push(entry.item);
        });
        const locations = Object.keys(groupedByLoc);
        locations.forEach(loc => batchAssignToSingleLocation(groupedByLoc[loc], loc as LocationId));
    };

    return {
        // State
        multiSelectedLocations, setMultiSelectedLocations,
        relocateSourceLoc, setRelocateSourceLoc,
        pendingPackageTypeData, setPendingPackageTypeData,
        itemToCopy, setItemToCopy,
        itemToMove, setItemToMove,
        itemPendingDeletion, setItemPendingDeletion,
        addItemTarget, setAddItemTarget,
        inputMethodModal, setInputMethodModal,
        selectedMapLocation, setSelectedMapLocation,
        shelfDetailMode, setShelfDetailMode,
        moveConfirmationData, setMoveConfirmationData,
        removeConfirmationData, setRemoveConfirmationData,
        requestConfirmationData, setRequestConfirmationData,
        processFinishedData, setProcessFinishedData,
        duplicateItemData, setDuplicateItemData,
        occupiedLocationData, setOccupiedLocationData,

        // Handlers
        handleInitiateRemoveWorkflow,
        handleInitiateRequestWorkflow,
        handleInitiateFinishWorkflow,
        handleInitiateMultiOccupancy,
        handleMultiLocationSelectionConfirm,
        checkLocationAndAssign,
        handleConfirmMove,
        handleConfirmRemove,
        handleConfirmProcessFinish,
        handleConfirmBatchRequest,
        handleDuplicateMove,
        handleDuplicateAdd,
        handleConfirmOccupiedAssignment,
        handleDirectAssign,
        handleDirectRemove,
        handlePackageTypeSelect,
        handlePhotoAnalysisResult,
        handleLocationCaptureResult,
        handleWorkflowScan,
        handleAssignmentModalConfirm,
        handleValidationSuccess,
        handleBatchScanComplete,
        handleBatchScanComplete,
        handleBatchAssignmentMap,
        handleInitiateAdd,
        handleSelectManualAdd,
        handleSelectPhotoAdd,
        handleFabClick,
        handleInitiateCopy,
        handleInitiateMove,
        handlePasteMovedItem,
        handleDragMove,
        handleMoveItemModalConfirm,
        handleInitiateDelete,
        handlePendingDeleteConfirm,
        handleFinishProduction,
        handleInitiateRequest,
        handleConfirmRequest
    };
};
