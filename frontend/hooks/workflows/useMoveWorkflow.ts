import { useState, useCallback } from 'react';
import { LocationId, formatLocation } from '../../lib/warehouseData';
import { useHaptic } from '../useHaptic';
import { useAppStore } from '../../lib/store';

interface ItemToMove {
  barcode: string;
  fromLocation: LocationId;
  orderId?: string;
}

interface ItemToCopy {
  barcode: string;
  fromLocation: LocationId;
  orderId?: string;
}

interface MoveConfirmationData {
  barcode: string;
  orderId: string;
  currentLoc: string;
  targetLoc: string;
}

interface MoveWorkflowReturn {
  itemToMove: ItemToMove | null;
  setItemToMove: (item: ItemToMove | null) => void;
  itemToCopy: ItemToCopy | null;
  setItemToCopy: (item: ItemToCopy | null) => void;
  moveConfirmationData: MoveConfirmationData | null;
  setMoveConfirmationData: (data: MoveConfirmationData | null) => void;
  handleInitiateMove: (barcode: string, fromLocation: LocationId, orderId?: string, isAdmin?: boolean, canAssign?: () => boolean, notify?: (type: any, title: string, message: string) => void, setPendingAssignment?: (a: any) => void) => void;
  handleInitiateCopy: (barcode: string, fromLocation: LocationId, orderId?: string, isAdmin?: boolean, canAssign?: () => boolean, notify?: (type: any, title: string, message: string) => void) => void;
  handlePasteMovedItem: (toLocation: LocationId, checkLocationAndAssign?: (barcode: string, orderId: string, targetLocation: LocationId, mode: 'move' | 'add', onSuccess?: () => void) => void, isAdmin?: boolean) => void;
  handleDragMove: (barcode: string, fromLocation: LocationId, toLocation: LocationId, assignments?: Record<string, any[]>, isAdmin?: boolean, canAssign?: () => boolean, checkLocationAndAssign?: (barcode: string, orderId: string, targetLocation: LocationId, mode: 'move' | 'add', onSuccess?: () => void) => void) => void;
  handleMoveItemModalConfirm: (toLocation: LocationId, isAdmin?: boolean, checkLocationAndAssign?: (barcode: string, orderId: string, targetLocation: LocationId, mode: 'move' | 'add', onSuccess?: () => void) => void, setModal?: (modal: string, open: boolean) => void) => void;
  handleConfirmMove: (checkLocationAndAssign?: (barcode: string, orderId: string, targetLocation: LocationId, mode: 'move' | 'add', onSuccess?: () => void) => void) => void;
}

export const useMoveWorkflow = (): MoveWorkflowReturn => {
  const { triggerHaptic } = useHaptic();
  const { setModal } = useAppStore();
  const [itemToMove, setItemToMove] = useState<ItemToMove | null>(null);
  const [itemToCopy, setItemToCopy] = useState<ItemToCopy | null>(null);
  const [moveConfirmationData, setMoveConfirmationData] = useState<MoveConfirmationData | null>(null);

  const handleInitiateCopy = useCallback(
    (barcode: string, fromLocation: LocationId, orderId?: string, isAdmin?: boolean, canAssign?: () => boolean, notify?: (type: any, title: string, message: string) => void) => {
      triggerHaptic('selection');
      if (!isAdmin) {
        if (notify) notify('error', 'Solo Admin', 'Copiar y pegar articulos solo esta permitido para Admin.');
        return;
      }
      if (canAssign && !canAssign()) return;
      setItemToMove(null);
      setItemToCopy((prev) => (prev?.barcode === barcode && prev?.fromLocation === fromLocation && prev?.orderId === orderId) ? null : { barcode, fromLocation, orderId });
    },
    [triggerHaptic]
  );

  const handleInitiateMove = useCallback(
    (barcode: string, fromLocation: LocationId, orderId?: string, isAdmin?: boolean, canAssign?: () => boolean, notify?: (type: any, title: string, message: string) => void, setPendingAssignment?: (a: any) => void) => {
      triggerHaptic('selection');
      if (canAssign && !canAssign()) return;

      if (!isAdmin) {
        setItemToCopy(null);
        setItemToMove(null);
        if (setPendingAssignment) setPendingAssignment({ article: barcode, order: orderId || 'PENDIENTE', location: undefined, mode: 'move' });
        setModal('locationCapture', true);
        if (notify) notify('info', 'Mover con foto', 'Haz una foto de la ubicacion final para completar el movimiento.');
        return;
      }

      setItemToCopy(null);
      setItemToMove({ barcode, fromLocation, orderId });
      setModal('move', true);
    },
    [triggerHaptic, setModal]
  );

  const handlePasteMovedItem = useCallback(
    (toLocation: LocationId, checkLocationAndAssign?: (barcode: string, orderId: string, targetLocation: LocationId, mode: 'move' | 'add', onSuccess?: () => void) => void, isAdmin?: boolean) => {
      if (!isAdmin) return;
      if (!itemToMove) return;
      if (checkLocationAndAssign) {
        checkLocationAndAssign(itemToMove.barcode, itemToMove.orderId || 'PENDIENTE', toLocation, 'move');
      }
      setItemToMove(null);
    },
    [itemToMove]
  );

  const handleDragMove = useCallback(
    (barcode: string, fromLocation: LocationId, toLocation: LocationId, assignments?: Record<string, any[]>, isAdmin?: boolean, canAssign?: () => boolean, checkLocationAndAssign?: (barcode: string, orderId: string, targetLocation: LocationId, mode: 'move' | 'add', onSuccess?: () => void) => void) => {
      if (!isAdmin) return;
      if (canAssign && !canAssign()) return;
      if (fromLocation === toLocation) return;
      const item = assignments?.[fromLocation]?.find((i) => i.barcode === barcode);
      if (item && checkLocationAndAssign) {
        checkLocationAndAssign(barcode, item.orderId, toLocation, 'move');
      }
    },
    []
  );

  const handleMoveItemModalConfirm = useCallback(
    (toLocation: LocationId, isAdmin?: boolean, checkLocationAndAssign?: (barcode: string, orderId: string, targetLocation: LocationId, mode: 'move' | 'add', onSuccess?: () => void) => void, setModalFunc?: (modal: string, open: boolean) => void) => {
      if (!isAdmin) return;
      if (itemToMove && checkLocationAndAssign) {
        checkLocationAndAssign(itemToMove.barcode, itemToMove.orderId || 'PENDIENTE', toLocation, 'move');
        if (setModalFunc) setModalFunc('move', false);
        setItemToMove(null);
      }
    },
    [itemToMove]
  );

  const handleConfirmMove = useCallback(
    (checkLocationAndAssign?: (barcode: string, orderId: string, targetLocation: LocationId, mode: 'move' | 'add', onSuccess?: () => void) => void) => {
      if (!moveConfirmationData) return;
      const { barcode, orderId, targetLoc } = moveConfirmationData;

      if (checkLocationAndAssign) {
        checkLocationAndAssign(barcode, orderId, targetLoc as LocationId, 'move', () => {
          setMoveConfirmationData(null);
        });
      }
    },
    [moveConfirmationData]
  );

  return {
    itemToMove,
    setItemToMove,
    itemToCopy,
    setItemToCopy,
    moveConfirmationData,
    setMoveConfirmationData,
    handleInitiateMove,
    handleInitiateCopy,
    handlePasteMovedItem,
    handleDragMove,
    handleMoveItemModalConfirm,
    handleConfirmMove
  };
};


