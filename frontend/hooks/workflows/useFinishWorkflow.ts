import { useState, useCallback } from 'react';
import { LocationId } from '../../lib/warehouseData';
import { useHaptic } from '../useHaptic';
import { useAppStore } from '../../lib/store';

interface ProcessFinishedData {
  barcode: string;
  orderId: string;
  location: string;
}

interface FinishWorkflowReturn {
  processFinishedData: ProcessFinishedData | null;
  setProcessFinishedData: (data: ProcessFinishedData | null) => void;
  handleInitiateFinishWorkflow: () => void;
  handleConfirmProcessFinish: (removeItem: (barcode: string, location: LocationId, orderId?: string) => Promise<boolean>, addHistoryEntry: (entry: any) => void, addFinishedItem: (item: any) => void, notify: (type: any, title: string, message: string) => void, resetScanWorkflow: () => void) => Promise<void>;
  handleFinishProduction: (pendingAssignment: { article: string; order: string; location?: LocationId; mode?: 'move' | 'add' } | null, findItemLocation: (barcode: string, orderId?: string) => LocationId | null, setModal: (modal: string, open: boolean) => void) => void;
}

export const useFinishWorkflow = (): FinishWorkflowReturn => {
  const { triggerHaptic } = useHaptic();
  const { setModal } = useAppStore();
  const [processFinishedData, setProcessFinishedData] = useState<ProcessFinishedData | null>(null);

  const handleInitiateFinishWorkflow = useCallback(() => {
    triggerHaptic('selection');
    setModal('photoAnalyzer', true);
  }, [triggerHaptic, setModal]);

  const handleConfirmProcessFinish = useCallback(
    async (removeItem: (barcode: string, location: LocationId, orderId?: string) => Promise<boolean>, addHistoryEntry: (entry: any) => void, addFinishedItem: (item: any) => void, notify: (type: any, title: string, message: string) => void, resetScanWorkflow: () => void) => {
      if (!processFinishedData) return;
      const { barcode, orderId, location } = processFinishedData;
      const now = new Date().toISOString();
      const success = await removeItem(barcode, location as LocationId, orderId);

      if (success === true) {
        triggerHaptic('success');
        addHistoryEntry({ barcode, orderId, action: 'process_finished', fromLocation: location as LocationId, timestamp: now });
        addFinishedItem({ barcode, orderId, timestamp: now, finishedAt: now, status: 'FINALIZADO' });
        notify('success', 'Producción Finalizada', `El artículo ${barcode} ha pasado a ALMACÉN.`);
      }
      setProcessFinishedData(null);
      resetScanWorkflow();
    },
    [processFinishedData, triggerHaptic]
  );

  const handleFinishProduction = useCallback(
    (pendingAssignment: { article: string; order: string; location?: LocationId; mode?: 'move' | 'add' } | null, findItemLocation: (barcode: string, orderId?: string) => LocationId | null, setModalFunc: (modal: string, open: boolean) => void) => {
      setModalFunc('assignment', false);
      if (pendingAssignment) {
        const currentLoc = findItemLocation(pendingAssignment.article, pendingAssignment.order);
        if (currentLoc) {
          setProcessFinishedData({ barcode: pendingAssignment.article, orderId: pendingAssignment.order, location: currentLoc });
        }
      }
    },
    []
  );

  return {
    processFinishedData,
    setProcessFinishedData,
    handleInitiateFinishWorkflow,
    handleConfirmProcessFinish,
    handleFinishProduction
  };
};


