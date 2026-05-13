import { useState, useCallback } from 'react';
import { LocationId, PackageType, formatLocation } from '../../lib/warehouseData';
import { useHaptic } from '../useHaptic';
import { useAppStore } from '../../lib/store';

interface PendingPackageTypeData {
  barcode: string;
  orderId: string;
  location: LocationId | LocationId[];
  allowMultiLocation: boolean;
}

interface OccupiedLocationData {
  locationId: LocationId;
  newItem: { barcode: string; orderId: string };
  mode: 'move' | 'add';
}

interface AssignWorkflowReturn {
  addItemTarget: LocationId | null;
  setAddItemTarget: (target: LocationId | null) => void;
  inputMethodModal: { title: string; subtitle?: string } | null;
  setInputMethodModal: (modal: { title: string; subtitle?: string } | null) => void;
  selectedMapLocation: LocationId | null;
  setSelectedMapLocation: (loc: LocationId | null) => void;
  shelfDetailMode: 'view' | 'add_choice';
  setShelfDetailMode: (mode: 'view' | 'add_choice') => void;
  pendingPackageTypeData: PendingPackageTypeData | null;
  setPendingPackageTypeData: (data: PendingPackageTypeData | null) => void;
  occupiedLocationData: OccupiedLocationData | null;
  setOccupiedLocationData: (data: OccupiedLocationData | null) => void;
  handleInitiateAdd: (locationId: LocationId, canAssign?: () => boolean, notify?: (type: any, title: string, message: string) => void) => void;
  handleSelectManualAdd: () => void;
  handleSelectPhotoAdd: () => void;
  handleFabClick: () => void;
  handlePackageTypeSelect: (packageType: PackageType, assignItem?: (barcode: string, orderId: string, location: LocationId | LocationId[], options?: any) => void, notify?: (type: any, title: string, message: string) => void, resetScanWorkflow?: () => void, setModal?: (modal: string, open: boolean) => void) => void;
  handleDirectAssign: (barcode: string, orderId: string, location: LocationId, assignItem?: (barcode: string, orderId: string, location: LocationId | LocationId[], options?: any) => void, notify?: (type: any, title: string, message: string) => void) => void;
  handleConfirmOccupiedAssignment: (mode: 'merge' | 'new_batch', assignItem?: (barcode: string, orderId: string, location: LocationId | LocationId[], options?: any) => void, notify?: (type: any, title: string, message: string) => void, resetScanWorkflow?: () => void) => void;
  checkLocationAndAssign: (barcode: string, orderId: string, targetLocation: LocationId, mode: 'move' | 'add', onSuccess?: () => void) => void;
}

export const useAssignWorkflow = (assignments: Record<string, any[]>): AssignWorkflowReturn => {
  const { triggerHaptic } = useHaptic();
  const { setModal } = useAppStore();

  const [addItemTarget, setAddItemTarget] = useState<LocationId | null>(null);
  const [inputMethodModal, setInputMethodModal] = useState<{ title: string; subtitle?: string } | null>(null);
  const [selectedMapLocation, setSelectedMapLocation] = useState<LocationId | null>(null);
  const [shelfDetailMode, setShelfDetailMode] = useState<'view' | 'add_choice'>('view');
  const [pendingPackageTypeData, setPendingPackageTypeData] = useState<PendingPackageTypeData | null>(null);
  const [occupiedLocationData, setOccupiedLocationData] = useState<OccupiedLocationData | null>(null);

  const handleInitiateAdd = useCallback(
    (locationId: LocationId, canAssign?: () => boolean, notify?: (type: any, title: string, message: string) => void) => {
      triggerHaptic('selection');
      if (canAssign && !canAssign()) {
        const role = localStorage.getItem('role_debug_info') || 'Unknown';
        if (notify) notify('error', 'Permiso Denegado', `No tiene permisos para añadir artículos. (Rol: ${role})`);
        return;
      }

      if (locationId.includes('PLE C1') || locationId.includes('PLE C2')) {
        setSelectedMapLocation(locationId);
        setShelfDetailMode('add_choice');
        return;
      }

      setAddItemTarget(locationId);
      setInputMethodModal({ title: 'Añadir a Ubicación', subtitle: formatLocation(locationId) });
    },
    [triggerHaptic]
  );

  const handleSelectManualAdd = useCallback(() => {
    triggerHaptic('selection');
    setModal('manualEntry', true);
  }, [triggerHaptic, setModal]);

  const handleSelectPhotoAdd = useCallback(() => {
    triggerHaptic('selection');
    setModal('photoAnalyzer', true);
  }, [triggerHaptic, setModal]);

  const handleFabClick = useCallback(() => {
    triggerHaptic('selection');
    setModal('photoAnalyzer', true);
  }, [triggerHaptic, setModal]);

  const checkLocationAndAssign = useCallback(
    (barcode: string, orderId: string, targetLocation: LocationId, mode: 'move' | 'add', onSuccess?: () => void) => {
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
    },
    [assignments, setModal]
  );

  const handlePackageTypeSelect = useCallback(
    (packageType: PackageType, assignItem?: (barcode: string, orderId: string, location: LocationId | LocationId[], options?: any) => void, notify?: (type: any, title: string, message: string) => void, resetScanWorkflow?: () => void, setModalFunc?: (modal: string, open: boolean) => void) => {
      if (!pendingPackageTypeData) return;
      const { barcode, orderId, location, allowMultiLocation } = pendingPackageTypeData;

      triggerHaptic('success');
      if (assignItem) assignItem(barcode, orderId, location, { allowMultiLocation, packageType });
      const locText = Array.isArray(location) ? `${location.length} ubicaciones` : formatLocation(location);
      if (notify) notify('success', 'Asignado', `${barcode} -> ${locText}`);

      if (setModalFunc) setModalFunc('packageType', false);
      setPendingPackageTypeData(null);
      if (resetScanWorkflow) resetScanWorkflow();
    },
    [pendingPackageTypeData, triggerHaptic]
  );

  const handleDirectAssign = useCallback(
    (barcode: string, orderId: string, location: LocationId, assignItem?: (barcode: string, orderId: string, location: LocationId | LocationId[], options?: any) => void, notify?: (type: any, title: string, message: string) => void) => {
      triggerHaptic('success');
      if (assignItem) assignItem(barcode, orderId, location, { allowMultiLocation: true });
      if (notify) notify('success', 'Añadido', `${barcode} añadido a ${formatLocation(location)}`);
    },
    [triggerHaptic]
  );

  const handleConfirmOccupiedAssignment = useCallback(
    (mode: 'merge' | 'new_batch', assignItem?: (barcode: string, orderId: string, location: LocationId | LocationId[], options?: any) => void, notify?: (type: any, title: string, message: string) => void, resetScanWorkflow?: () => void) => {
      if (!occupiedLocationData) return;
      const { newItem, locationId } = occupiedLocationData;
      const forceMulti = mode === 'new_batch';
      triggerHaptic('success');
      if (assignItem) assignItem(newItem.barcode, newItem.orderId, locationId, { allowMultiLocation: forceMulti });

      if (mode === 'merge') {
        if (notify) notify('success', 'Lote Actualizado', `${newItem.barcode} unificado en ${formatLocation(locationId)}`);
      } else {
        if (notify) notify('success', 'Nuevo Lote Añadido', `${newItem.barcode} añadido a ${formatLocation(locationId)}`);
      }

      setOccupiedLocationData(null);
      if (resetScanWorkflow) resetScanWorkflow();
    },
    [occupiedLocationData, triggerHaptic]
  );

  return {
    addItemTarget,
    setAddItemTarget,
    inputMethodModal,
    setInputMethodModal,
    selectedMapLocation,
    setSelectedMapLocation,
    shelfDetailMode,
    setShelfDetailMode,
    pendingPackageTypeData,
    setPendingPackageTypeData,
    occupiedLocationData,
    setOccupiedLocationData,
    handleInitiateAdd,
    handleSelectManualAdd,
    handleSelectPhotoAdd,
    handleFabClick,
    handlePackageTypeSelect,
    handleDirectAssign,
    handleConfirmOccupiedAssignment,
    checkLocationAndAssign
  };
};
