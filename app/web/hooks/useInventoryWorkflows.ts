
import { useCallback } from 'react';
import { useAppStore } from '../lib/store';
import { LocationId, formatLocation } from '../lib/warehouseData';

export const useInventoryWorkflows = (
    inventoryOps: any,
    assignments: any,
    notify: any,
    findItemLocation: (barcode: string, orderId?: string) => LocationId | null
) => {
    const {
        workflowMode,
        setWorkflowMode,
        setPendingAssignment,
        setModal,
        setBatchItems,
        batchItems,
        pendingAssignment
    } = useAppStore();

    const resetScanWorkflow = useCallback(() => {
        setPendingAssignment(null);
        setModal('scanner', false);
        setModal('photoAnalyzer', false);
        setModal('locationCapture', false);
        setModal('validationScanner', false);
        setModal('duplicateAlert', false);
        setBatchItems([]);
        setModal('occupiedAlert', false);
        setModal('multiLocationSelector', false);
        setModal('emptyLocations', false);
    }, [setPendingAssignment, setModal, setBatchItems]);

    const processScanInput = useCallback((code: string, order: string | null) => {
        const finalOrder = order || 'PENDIENTE';

        setModal('scanner', false);
        setModal('photoAnalyzer', false);
        setModal('manualEntry', false);

        if (workflowMode === 'finish') {
            const location = findItemLocation(code, finalOrder);
            if (location) {
                return { action: 'finish', data: { barcode: code, orderId: finalOrder, location } };
            } else {
                notify('error', 'No encontrado en planta', `El artículo ${code} (OF: ${finalOrder}) no tiene asignada ninguna ubicación.`);
                resetScanWorkflow();
            }
            return null;
        }

        if (workflowMode === 'request') {
            const location = findItemLocation(code, finalOrder);
            return { action: 'request', data: { barcode: code, orderId: finalOrder, location: location || undefined } };
        }

        if (workflowMode === 'remove') {
            const location = findItemLocation(code, finalOrder);
            if (location) {
                return { action: 'remove', data: { barcode: code, orderId: finalOrder, location } };
            } else {
                const locationLoose = findItemLocation(code);
                if (locationLoose) {
                    const itemsInLoc = assignments[locationLoose] || [];
                    const matches = itemsInLoc.filter((i: any) => i.barcode === code);
                    if (matches.length === 1) {
                        return { action: 'remove', data: { barcode: code, orderId: matches[0].orderId, location: locationLoose } };
                    } else {
                        notify('warning', 'Múltiples coincidencias', `Existen varios artículos ${code} con distintas OF. Por favor, retíralo manualmente.`);
                        resetScanWorkflow();
                    }
                } else {
                    notify('error', 'No encontrado', `El artículo ${code} no está en inventario.`);
                    resetScanWorkflow();
                }
            }
            return null;
        }

        // ASSIGN LOGIC
        const existingLoc = findItemLocation(code, finalOrder);
        if (existingLoc && !pendingAssignment?.location) {
            return { action: 'duplicate', data: { barcode: code, orderId: finalOrder, location: existingLoc } };
        }

        setPendingAssignment({ article: code, order: finalOrder, location: pendingAssignment?.location, mode: 'move' });

        if (pendingAssignment?.location) {
            return { action: 'assign_to_target', data: { barcode: code, orderId: finalOrder, target: pendingAssignment.location } };
        } else {
            setModal('locationCapture', true);
        }
        return null;
    }, [workflowMode, findItemLocation, notify, resetScanWorkflow, setModal, setPendingAssignment, pendingAssignment, assignments]);

    return {
        resetScanWorkflow,
        processScanInput
    };
};
