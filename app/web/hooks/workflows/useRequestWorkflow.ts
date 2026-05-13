import { useState, useCallback } from 'react';
import { LocationId } from '../../lib/warehouseData';
import { useHaptic } from '../useHaptic';
import { useAppStore } from '../../lib/store';

interface RequestConfirmationData {
  barcode: string;
  orderId: string;
  location?: string;
}

interface RequestWorkflowReturn {
  requestConfirmationData: RequestConfirmationData | null;
  setRequestConfirmationData: (data: RequestConfirmationData | null) => void;
  handleInitiateRequestWorkflow: (canRequestItems?: () => boolean, notify?: (type: any, title: string, message: string) => void, resetScanWorkflow?: () => void) => void;
  handleInitiateRequest: (barcode: string, orderId: string, fromLocation: LocationId, canRequestItems?: () => boolean, notify?: (type: any, title: string, message: string) => void) => void;
  handleConfirmRequest: (priority?: 'normal' | 'high', requestItem?: (barcode: string, orderId: string, fromLocation?: string, priority?: 'normal' | 'high') => void, resetScanWorkflow?: () => void) => void;
}

export const useRequestWorkflow = (): RequestWorkflowReturn => {
  const { triggerHaptic } = useHaptic();
  const { setModal } = useAppStore();
  const [requestConfirmationData, setRequestConfirmationData] = useState<RequestConfirmationData | null>(null);

  const handleInitiateRequestWorkflow = useCallback(
    (canRequestItems?: () => boolean, notify?: (type: any, title: string, message: string) => void, resetScanWorkflow?: () => void) => {
      triggerHaptic('selection');
      if (canRequestItems && !canRequestItems()) return;
      if (resetScanWorkflow) resetScanWorkflow();
      setModal('scanner', true);
    },
    [triggerHaptic, setModal]
  );

  const handleInitiateRequest = useCallback(
    (barcode: string, orderId: string, fromLocation: LocationId, canRequestItems?: () => boolean, notify?: (type: any, title: string, message: string) => void) => {
      if (canRequestItems && !canRequestItems()) {
        if (notify) notify('error', 'Permiso Denegado', 'No tiene permisos para solicitar artículos.');
        return;
      }
      setRequestConfirmationData({ barcode, orderId, location: fromLocation });
    },
    []
  );

  const handleConfirmRequest = useCallback(
    (priority: 'normal' | 'high' = 'normal', requestItem?: (barcode: string, orderId: string, fromLocation?: string, priority?: 'normal' | 'high') => void, resetScanWorkflow?: () => void) => {
      if (!requestConfirmationData) return;
      if (requestItem) requestItem(requestConfirmationData.barcode, requestConfirmationData.orderId, requestConfirmationData.location as LocationId, priority);
      setRequestConfirmationData(null);
      if (resetScanWorkflow) resetScanWorkflow();
    },
    [requestConfirmationData]
  );

  return {
    requestConfirmationData,
    setRequestConfirmationData,
    handleInitiateRequestWorkflow,
    handleInitiateRequest,
    handleConfirmRequest
  };
};
