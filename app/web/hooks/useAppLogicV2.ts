import { useCallback, useMemo } from 'react';
import { LocationId, PackageType, formatLocation } from '../lib/warehouseData';
import { BatchItem } from '../types/batch';
import { useAppStore } from '../lib/store';
import { validateCode } from '../lib/codeValidation';
import { parseLocationFromText } from '../lib/locationParser';
import { useHaptic } from './useHaptic';

// Import workflow hooks
import { useAssignWorkflow } from './workflows/useAssignWorkflow';
import { useMoveWorkflow } from './workflows/useMoveWorkflow';
import { useRemoveWorkflow } from './workflows/useRemoveWorkflow';
import { useRequestWorkflow } from './workflows/useRequestWorkflow';
import { useFinishWorkflow } from './workflows/useFinishWorkflow';
import { useBatchWorkflow } from './workflows/useBatchWorkflow';
import { useRelocationWorkflow } from './workflows/useRelocationWorkflow';

interface UseAppLogicV2Props {
  role: string | null;
  assignments: Record<string, any[]>;
  setAssignments: (a: any) => void;
  addHistoryEntry: (entry: any) => void;
  addFinishedItem: (item: any) => void;
  notify: (type: any, title: string, message: string) => void;
  assignItem: (barcode: string, orderId: string, location: LocationId | LocationId[], options?: any) => void;
  requestItem: (barcode: string, orderId: string, fromLocation?: string, priority?: 'normal' | 'high') => void;
  removeItem: (barcode: string, location: LocationId, orderId?: string) => Promise<boolean>;
  findItemLocation: (barcode: string, orderId?: string) => LocationId | null;
  batchAssignToSingleLocation: (items: any[], location: LocationId) => void;
  withdrawItem: (barcode: string, location: LocationId, orderId: string) => Promise<boolean>;
  canAssign: () => boolean;
  canRemove: (loc?: string) => boolean;
  canRequestItems: () => boolean;
  canFinishProduction: () => boolean;
  shouldSkipValidation: () => boolean;
  processScanInput: (code: string, orderId?: string) => { action: string; data: any } | null;
  relocateLocationContents: (from: LocationId, to: LocationId) => Promise<void>;
}

export const useAppLogicV2 = ({
  role,
  assignments,
  setAssignments,
  addHistoryEntry,
  addFinishedItem,
  notify,
  assignItem,
  requestItem,
  removeItem,
  findItemLocation,
  batchAssignToSingleLocation,
  withdrawItem,
  canAssign,
  canRemove,
  canRequestItems,
  canFinishProduction,
  relocateLocationContents,
  shouldSkipValidation,
  processScanInput
}: UseAppLogicV2Props) => {
  const { triggerHaptic } = useHaptic();
  const {
    workflowMode,
    setWorkflowMode,
    setModal,
    pendingAssignment,
    setPendingAssignment,
    batchItems,
    setBatchItems
  } = useAppStore();

  const isAdmin = role === 'ADMIN';

  // Import all workflow hooks
  const assignWorkflow = useAssignWorkflow(assignments);
  const moveWorkflow = useMoveWorkflow();
  const removeWorkflow = useRemoveWorkflow();
  const requestWorkflow = useRequestWorkflow();
  const finishWorkflow = useFinishWorkflow();
  const batchWorkflow = useBatchWorkflow();
  const relocationWorkflow = useRelocationWorkflow();

  // Reset helper
  const resetScanWorkflow = useCallback(() => {
    setPendingAssignment(null);
    setBatchItems([]);
  }, [setPendingAssignment, setBatchItems]);

  // Workflow initialization handlers
  const handleInitiateRemoveWorkflow = useCallback(() => {
    triggerHaptic('selection');
    setWorkflowMode('remove');
    resetScanWorkflow();
    assignWorkflow.setInputMethodModal({ title: 'Retirar Artículo', subtitle: 'Seleccione cómo identificar el artículo' });
  }, [triggerHaptic, setWorkflowMode, resetScanWorkflow, assignWorkflow]);

  const handleInitiateRequestWorkflow = useCallback(() => {
    triggerHaptic('selection');
    if (!canRequestItems()) return;
    setWorkflowMode('request');
    resetScanWorkflow();
    assignWorkflow.setInputMethodModal({ title: 'Realizar Solicitud', subtitle: 'Escanee o introduzca manualmente los artículos' });
  }, [triggerHaptic, setWorkflowMode, resetScanWorkflow, canRequestItems, assignWorkflow]);

  const handleInitiateFinishWorkflow = useCallback(() => {
    triggerHaptic('selection');
    if (!canFinishProduction()) return;
    setWorkflowMode('finish');
    resetScanWorkflow();
    finishWorkflow.handleInitiateFinishWorkflow();
  }, [triggerHaptic, setWorkflowMode, resetScanWorkflow, canFinishProduction, finishWorkflow]);

  // Cross-workflow handlers
  const handleScanActionResult = useCallback(
    (result: { action: string; data: any } | null) => {
      if (!result) return;

      const { barcode, orderId, location, target } = result.data;

      switch (result.action) {
        case 'remove':
          removeWorkflow.setRemoveConfirmationData({ barcode, orderId, location });
          break;
        case 'request':
          requestWorkflow.setRequestConfirmationData({ barcode, orderId, location });
          break;
        case 'finish':
          finishWorkflow.setProcessFinishedData({ barcode, orderId, location });
          break;
        case 'duplicate': {
          assignWorkflow.setOccupiedLocationData({ locationId: location, newItem: { barcode, orderId }, mode: 'add' });
          break;
        }
        case 'assign_to_target': {
          const intent = pendingAssignment?.mode || 'move';
          if (intent === 'add') {
            assignWorkflow.checkLocationAndAssign(barcode, orderId, target as LocationId, 'add');
          } else {
            const currentLoc = findItemLocation(barcode, orderId);
            if (currentLoc && currentLoc !== target) {
              moveWorkflow.setMoveConfirmationData({
                barcode,
                orderId,
                currentLoc,
                targetLoc: target
              });
            } else {
              assignWorkflow.checkLocationAndAssign(barcode, orderId, target as LocationId, 'move');
            }
          }
          break;
        }
        default:
          break;
      }
    },
    [pendingAssignment, findItemLocation, removeWorkflow, requestWorkflow, finishWorkflow, assignWorkflow, moveWorkflow]
  );

  const handlePhotoAnalysisResult = useCallback(
    (result: string | { article: string; order: string }) => {
      let barcode = '';
      let orderId = 'PENDIENTE';
      if (typeof result === 'object') {
        barcode = result.article;
        orderId = result.order;
      } else {
        barcode = result;
      }

      if (batchWorkflow.multiSelectedLocations.length > 0) {
        setModal('photoAnalyzer', false);
        assignItem(barcode, orderId, batchWorkflow.multiSelectedLocations, { allowMultiLocation: true });
        notify('success', 'Asignación Masiva', `Artículo ${barcode} asignado a ${batchWorkflow.multiSelectedLocations.length} ubicaciones.`);
        resetScanWorkflow();
        return;
      }
      const scanResult = processScanInput(barcode, orderId);
      handleScanActionResult(scanResult);
    },
    [batchWorkflow.multiSelectedLocations, assignItem, notify, resetScanWorkflow, processScanInput, handleScanActionResult, setModal]
  );

  const handleLocationCaptureResult = useCallback(
    async (extractedText: string | { article: string; order: string }) => {
      let locationText = typeof extractedText === 'string' ? extractedText.toUpperCase().trim() : '';
      if (!locationText) return;

      if (locationText.includes('ALMACEN') || locationText.includes('ALMACÉN') || locationText.includes('FINAL')) {
        if (batchItems.length > 0) {
          const now = new Date().toISOString();
          for (const item of batchItems) {
            const currentLoc = findItemLocation(item.article, item.order);
            if (currentLoc) await removeItem(item.article, currentLoc, item.order);
            addHistoryEntry({ barcode: item.article, orderId: item.order, action: 'process_finished', fromLocation: currentLoc || undefined, timestamp: now });
            addFinishedItem({ barcode: item.article, orderId: item.order, timestamp: now, finishedAt: now, status: 'FINALIZADO' });
          }
          notify('success', 'Lote Finalizado', `${batchItems.length} artículos movidos a ALMACÉN.`);
          setModal('locationCapture', false);
          setBatchItems([]);
          resetScanWorkflow();
          return;
        }

        if (pendingAssignment) {
          const currentLoc = findItemLocation(pendingAssignment.article, pendingAssignment.order);
          if (currentLoc) {
            finishWorkflow.setProcessFinishedData({ barcode: pendingAssignment.article, orderId: pendingAssignment.order, location: currentLoc });
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
            assignWorkflow.checkLocationAndAssign(pendingAssignment.article, pendingAssignment.order, matchedLocation, 'add');
          } else {
            const currentLoc = findItemLocation(pendingAssignment.article, pendingAssignment.order);
            setModal('locationCapture', false);
            if (currentLoc && currentLoc !== matchedLocation) {
              moveWorkflow.setMoveConfirmationData({ barcode: pendingAssignment.article, orderId: pendingAssignment.order, currentLoc, targetLoc: matchedLocation });
            } else {
              assignWorkflow.checkLocationAndAssign(pendingAssignment.article, pendingAssignment.order, matchedLocation, 'move');
            }
          }
        }
      } else {
        notify('error', 'Ubicación no reconocida', `Texto detectado: "${locationText}". Inténtelo de nuevo.`);
      }
    },
    [batchItems, pendingAssignment, findItemLocation, removeItem, addHistoryEntry, addFinishedItem, notify, resetScanWorkflow, setModal, setBatchItems, batchAssignToSingleLocation, assignments, assignWorkflow, moveWorkflow, finishWorkflow]
  );

  const handleWorkflowScan = useCallback(
    (decodedText: string) => {
      const result = validateCode(decodedText);
      const code = result.normalizedCode;
      if (result.type === 'special' && code === 'ALMACEN') {
        if (pendingAssignment) {
          const location = findItemLocation(pendingAssignment.article, pendingAssignment.order);
          if (location) {
            finishWorkflow.setProcessFinishedData({ barcode: pendingAssignment.article, orderId: pendingAssignment.order, location });
            setModal('scanner', false);
            setModal('assignment', false);
          }
        }
        return;
      }
      const scanResult = processScanInput(code, 'PENDIENTE');
      handleScanActionResult(scanResult);
    },
    [pendingAssignment, findItemLocation, processScanInput, handleScanActionResult, finishWorkflow, setModal]
  );

  const handleAssignmentModalConfirm = useCallback(
    (barcode: string, locationOrLocations: LocationId | LocationId[]) => {
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
          assignWorkflow.checkLocationAndAssign(barcode, finalOrder, singleTarget, intent);
        } else {
          setModal('validationScanner', true);
        }
      }
    },
    [canAssign, pendingAssignment, setModal, setPendingAssignment, assignItem, notify, resetScanWorkflow, shouldSkipValidation, assignWorkflow]
  );

  const handleValidationSuccess = useCallback(() => {
    if (pendingAssignment && pendingAssignment.location) {
      const intent = pendingAssignment.mode || 'move';
      const existingLoc = findItemLocation(pendingAssignment.article, pendingAssignment.order);

      if (intent === 'add') {
        assignWorkflow.checkLocationAndAssign(pendingAssignment.article, pendingAssignment.order, pendingAssignment.location, 'add');
      } else {
        if (existingLoc && existingLoc !== pendingAssignment.location) {
          moveWorkflow.setMoveConfirmationData({ barcode: pendingAssignment.article, orderId: pendingAssignment.order, currentLoc: existingLoc, targetLoc: pendingAssignment.location });
        } else {
          assignWorkflow.checkLocationAndAssign(pendingAssignment.article, pendingAssignment.order, pendingAssignment.location, 'move');
        }
      }
    }
    setModal('validationScanner', false);
  }, [pendingAssignment, findItemLocation, assignWorkflow, moveWorkflow, setModal]);

  // Consolidate all handlers and state
  return {
    // Workflow states
    ...assignWorkflow,
    ...moveWorkflow,
    ...removeWorkflow,
    ...requestWorkflow,
    ...finishWorkflow,
    ...batchWorkflow,
    ...relocationWorkflow,

    // Workflow initialization
    handleInitiateRemoveWorkflow,
    handleInitiateRequestWorkflow,
    handleInitiateFinishWorkflow,

    // Cross-workflow handlers
    handleScanActionResult,
    handlePhotoAnalysisResult,
    handleLocationCaptureResult,
    handleWorkflowScan,
    handleAssignmentModalConfirm,
    handleValidationSuccess,

    // Utilities
    resetScanWorkflow
  };
};
