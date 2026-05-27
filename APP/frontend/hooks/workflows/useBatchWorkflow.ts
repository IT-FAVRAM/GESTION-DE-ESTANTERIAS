import { useState, useCallback } from 'react';
import { LocationId } from '../../lib/warehouseData';
import { BatchItem } from '../../types/batch';
import { useHaptic } from '../useHaptic';
import { useAppStore } from '../../lib/store';

interface BatchWorkflowReturn {
  multiSelectedLocations: LocationId[];
  setMultiSelectedLocations: (locs: LocationId[]) => void;
  handleInitiateMultiOccupancy: (canAssign?: () => boolean) => void;
  handleMultiLocationSelectionConfirm: (locations: LocationId[]) => void;
  handleBatchScanComplete: (items: BatchItem[], workflowMode?: string, setBatchItems?: (items: BatchItem[]) => void) => void;
  handleBatchAssignmentMap: (mappedItems: { item: BatchItem; location: LocationId }[], batchAssignToSingleLocation?: (items: BatchItem[], location: LocationId) => void, setBatchItems?: (items: BatchItem[]) => void) => void;
  handleConfirmBatchRequest: (batchItems: BatchItem[], requestItem?: (barcode: string, orderId: string, fromLocation?: string, priority?: 'normal' | 'high') => void, notify?: (type: any, title: string, message: string) => void, setBatchItems?: (items: BatchItem[]) => void, setWorkflowMode?: (mode: string) => void) => void;
}

export const useBatchWorkflow = (): BatchWorkflowReturn => {
  const { triggerHaptic } = useHaptic();
  const { setModal } = useAppStore();
  const [multiSelectedLocations, setMultiSelectedLocations] = useState<LocationId[]>([]);

  const handleInitiateMultiOccupancy = useCallback(
    (canAssign?: () => boolean) => {
      triggerHaptic('selection');
      if (canAssign && !canAssign()) return;
      setModal('multiLocationSelector', true);
    },
    [triggerHaptic, setModal]
  );

  const handleMultiLocationSelectionConfirm = useCallback(
    (locations: LocationId[]) => {
      setMultiSelectedLocations(locations);
      setModal('multiLocationSelector', false);
      setTimeout(() => setModal('photoAnalyzer', true), 100);
    },
    [setModal]
  );

  const handleBatchScanComplete = useCallback(
    (items: BatchItem[], workflowMode?: string, setBatchItems?: (items: BatchItem[]) => void) => {
      if (setBatchItems) setBatchItems(items);
      setModal('batchScanner', false);
      if (workflowMode === 'request') {
        setModal('requestReview', true);
      } else {
        setModal('locationCapture', true);
      }
    },
    [setModal]
  );

  const handleBatchAssignmentMap = useCallback(
    (mappedItems: { item: BatchItem; location: LocationId }[], batchAssignToSingleLocation?: (items: BatchItem[], location: LocationId) => void, setBatchItems?: (items: BatchItem[]) => void) => {
      setModal('batchAssignment', false);
      const groupedByLoc: Record<string, BatchItem[]> = {};
      mappedItems.forEach((entry) => {
        if (!groupedByLoc[entry.location]) groupedByLoc[entry.location] = [];
        groupedByLoc[entry.location].push(entry.item);
      });
      const locations = Object.keys(groupedByLoc);
      locations.forEach((loc) => {
        if (batchAssignToSingleLocation) batchAssignToSingleLocation(groupedByLoc[loc], loc as LocationId);
      });
      if (setBatchItems) setBatchItems([]);
    },
    [setModal]
  );

  const handleConfirmBatchRequest = useCallback(
    (batchItems: BatchItem[], requestItem?: (barcode: string, orderId: string, fromLocation?: string, priority?: 'normal' | 'high') => void, notify?: (type: any, title: string, message: string) => void, setBatchItems?: (items: BatchItem[]) => void, setWorkflowMode?: (mode: string) => void) => {
      if (batchItems.length === 0) return;
      triggerHaptic('success');
      batchItems.forEach((item) => {
        if (requestItem) requestItem(item.article, item.order);
      });
      if (notify) notify('success', 'Solicitud Múltiple Enviada', `Se han notificado ${batchItems.length} artículos al carretillero.`);
      if (setBatchItems) setBatchItems([]);
      setModal('requestReview', false);
      if (setWorkflowMode) setWorkflowMode('assign');
    },
    [triggerHaptic, setModal]
  );

  return {
    multiSelectedLocations,
    setMultiSelectedLocations,
    handleInitiateMultiOccupancy,
    handleMultiLocationSelectionConfirm,
    handleBatchScanComplete,
    handleBatchAssignmentMap,
    handleConfirmBatchRequest
  };
};


