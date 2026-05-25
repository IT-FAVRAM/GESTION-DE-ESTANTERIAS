import type { ShelfLocationState } from '../../hooks/useShelf';

export type KioskAction = 'idle' | 'ubicar' | 'retirar' | 'mover' | 'avisar';

export interface ScanData {
  articleCode: string;
  orderFab: string;
}

export interface KioskFeedback {
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface KioskConfirmModalState {
  open: boolean;
  title: string;
  message: string;
  icon: string;
  variant: 'success' | 'danger' | 'warning' | 'info';
  confirmText?: string;
  onConfirm: () => void;
  extraButton?: { text: string; onClick: () => void };
}

export interface KioskCellDetail {
  selectedCell: ShelfLocationState | null;
  onClose: () => void;
}
