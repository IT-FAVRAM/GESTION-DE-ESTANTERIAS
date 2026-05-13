import { useState, useCallback } from 'react';
import { LocationId, formatLocation } from '../../lib/warehouseData';
import { useHaptic } from '../useHaptic';
import { useAppStore } from '../../lib/store';

interface RemoveConfirmationData {
  barcode: string;
  orderId: string;
  location: string;
}

interface ItemPendingDeletion {
  barcode: string;
  location: LocationId;
  orderId?: string;
}

interface RemoveWorkflowReturn {
  removeConfirmationData: RemoveConfirmationData | null;
  setRemoveConfirmationData: (data: RemoveConfirmationData | null) => void;
  itemPendingDeletion: ItemPendingDeletion | null;
  setItemPendingDeletion: (data: ItemPendingDeletion | null) => void;
  handleInitiateRemoveWorkflow: () => void;
  handleConfirmRemove: (canRemove: (loc?: string) => boolean, removeItem: (barcode: string, location: LocationId, orderId?: string) => Promise<boolean>, notify: (type: any, title: string, message: string) => void, resetScanWorkflow: () => void) => Promise<void>;
  handleInitiateDelete: (barcode: string, location: LocationId, orderId?: string, canRemove?: (loc?: string) => boolean, notify?: (type: any, title: string, message: string) => void) => void;
  handleDirectRemove: (barcode: string, location: LocationId, orderId: string, removeItem: (barcode: string, location: LocationId, orderId?: string) => Promise<boolean>, notify: (type: any, title: string, message: string) => void) => Promise<void>;
  handlePendingDeleteConfirm: (removeItem: (barcode: string, location: LocationId, orderId?: string) => Promise<boolean>, notify: (type: any, title: string, message: string) => void) => Promise<void>;
}

export const useRemoveWorkflow = (): RemoveWorkflowReturn => {
  const { triggerHaptic } = useHaptic();
  const { setModal } = useAppStore();
  const [removeConfirmationData, setRemoveConfirmationData] = useState<RemoveConfirmationData | null>(null);
  const [itemPendingDeletion, setItemPendingDeletion] = useState<ItemPendingDeletion | null>(null);

  const handleInitiateRemoveWorkflow = useCallback(() => {
    triggerHaptic('selection');
    setModal('scanner', true);
  }, [triggerHaptic, setModal]);

  const handleConfirmRemove = useCallback(
    async (canRemove: (loc?: string) => boolean, removeItem: (barcode: string, location: LocationId, orderId?: string) => Promise<boolean>, notify: (type: any, title: string, message: string) => void, resetScanWorkflow: () => void) => {
      if (!removeConfirmationData) return;
      const { barcode, location, orderId } = removeConfirmationData;

      if (!canRemove(location)) {
        notify('error', 'Permiso Denegado', `No tienes permisos para retirar de ${formatLocation(location)}. (Solo puedes retirar de tu Sección asignada)`);
        setRemoveConfirmationData(null);
        resetScanWorkflow();
        return;
      }

      const success = await removeItem(barcode, location as LocationId, orderId);
      if (success) {
        triggerHaptic('success');
        notify('success', 'Retirado', `${barcode} eliminado de ${formatLocation(location)}`);
      }
      setRemoveConfirmationData(null);
      resetScanWorkflow();
    },
    [removeConfirmationData, triggerHaptic]
  );

  const handleInitiateDelete = useCallback(
    (barcode: string, location: LocationId, orderId?: string, canRemove?: (loc?: string) => boolean, notify?: (type: any, title: string, message: string) => void) => {
      if (canRemove && !canRemove(location)) {
        if (notify) notify('error', 'Permiso Denegado', `No tienes permisos para retirar artículos de ${formatLocation(location)}.`);
        return;
      }
      setItemPendingDeletion({ barcode, location, orderId });
    },
    []
  );

  const handleDirectRemove = useCallback(
    async (barcode: string, location: LocationId, orderId: string, removeItem: (barcode: string, location: LocationId, orderId?: string) => Promise<boolean>, notify: (type: any, title: string, message: string) => void) => {
      const success = await removeItem(barcode, location, orderId);
      if (success) {
        triggerHaptic('success');
        notify('success', 'Eliminado', `${barcode} retirado de ${formatLocation(location)}`);
      }
    },
    [triggerHaptic]
  );

  const handlePendingDeleteConfirm = useCallback(
    async (removeItem: (barcode: string, location: LocationId, orderId?: string) => Promise<boolean>, notify: (type: any, title: string, message: string) => void) => {
      if (!itemPendingDeletion) return;
      await removeItem(itemPendingDeletion.barcode, itemPendingDeletion.location, itemPendingDeletion.orderId);
      setItemPendingDeletion(null);
      notify('success', 'Retirado', 'Artículo eliminado correctamente.');
    },
    [itemPendingDeletion]
  );

  return {
    removeConfirmationData,
    setRemoveConfirmationData,
    itemPendingDeletion,
    setItemPendingDeletion,
    handleInitiateRemoveWorkflow,
    handleConfirmRemove,
    handleInitiateDelete,
    handleDirectRemove,
    handlePendingDeleteConfirm
  };
};
