import { useState, useCallback } from 'react';
import { LocationId } from '../../lib/warehouseData';
import { useHaptic } from '../useHaptic';

interface RelocationWorkflowReturn {
  relocateSourceLoc: LocationId | null;
  setRelocateSourceLoc: (loc: LocationId | null) => void;
  handleInitiateRelocate: (location: LocationId) => void;
  handleRelocate: (toLocation: LocationId, relocateLocationContents: (from: LocationId, to: LocationId) => Promise<void>, notify: (type: any, title: string, message: string) => void, setModal: (modal: string, open: boolean) => void) => Promise<void>;
}

export const useRelocationWorkflow = (): RelocationWorkflowReturn => {
  const { triggerHaptic } = useHaptic();
  const [relocateSourceLoc, setRelocateSourceLoc] = useState<LocationId | null>(null);

  const handleInitiateRelocate = useCallback((location: LocationId) => {
    triggerHaptic('selection');
    setRelocateSourceLoc(location);
  }, [triggerHaptic]);

  const handleRelocate = useCallback(
    async (toLocation: LocationId, relocateLocationContents: (from: LocationId, to: LocationId) => Promise<void>, notify: (type: any, title: string, message: string) => void, setModal: (modal: string, open: boolean) => void) => {
      if (!relocateSourceLoc) return;
      await relocateLocationContents(relocateSourceLoc, toLocation);
      setRelocateSourceLoc(null);
      setModal('relocate', false);
      notify('success', 'Reubicado', 'Contenido de la ubicación reubicado correctamente.');
    },
    [relocateSourceLoc]
  );

  return {
    relocateSourceLoc,
    setRelocateSourceLoc,
    handleInitiateRelocate,
    handleRelocate
  };
};
