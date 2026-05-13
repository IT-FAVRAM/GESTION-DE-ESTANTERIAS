import React from 'react';
import { formatArticleDisplay } from '../../lib/qrParser';
import type { KioskAction, ScanData } from './kioskShared';

interface KioskActionBarProps {
  action: KioskAction;
  scanData: ScanData | null;
  scannerActive: boolean;
  selectedPositions: string[];
  onConfirmMove: () => void;
  onCancel: () => void;
}

const KioskActionBar: React.FC<KioskActionBarProps> = ({ action, scanData, scannerActive, selectedPositions, onConfirmMove, onCancel }) => {
  if (action === 'idle') return null;

  return (
    <div className="flex-shrink-0 border-b border-cyan-800/30 bg-cyan-900/20 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">{action === 'ubicar' ? '📦' : action === 'retirar' ? '📤' : action === 'mover' ? '🔄' : '🚚'}</span>
          <div>
            <p className="text-sm font-bold text-cyan-300 uppercase">{action}</p>
            {scanData && <p className="text-xs text-cyan-400/70">{formatArticleDisplay(scanData.articleCode, scanData.orderFab)}</p>}
            {scannerActive && <p className="text-xs text-cyan-400 animate-pulse">Esperando escaneo...</p>}
            {action === 'mover' && scanData && selectedPositions.length > 0 && <p className="text-xs text-cyan-400">Seleccionados: {selectedPositions.map((p) => parseInt(p, 10)).join(', ')}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {action === 'mover' && scanData && selectedPositions.length > 0 && <button onClick={onConfirmMove} className="px-4 py-2 bg-emerald-500 text-white text-sm font-bold rounded-xl">CONFIRMAR MOVER</button>}
          <button onClick={onCancel} className="px-4 py-2 bg-slate-700 text-slate-300 text-sm font-bold rounded-xl">✕ Cancelar</button>
        </div>
      </div>
    </div>
  );
};

export default KioskActionBar;
