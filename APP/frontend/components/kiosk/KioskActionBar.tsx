import React from 'react';
import { formatArticleDisplay } from '../../lib/qrParser';
import type { KioskAction, ScanData } from './kioskShared';

interface KioskActionBarProps {
  action: KioskAction;
  scanData: ScanData | null;
  scannerActive: boolean;
  selectedPositions: string[];
  neededPositions?: number;
  onConfirmMove: () => void;
  onConfirmUbicar?: () => void;
  onCancel: () => void;
}

const KioskActionBar: React.FC<KioskActionBarProps> = ({ action, scanData, scannerActive, selectedPositions, neededPositions = 1, onConfirmMove, onConfirmUbicar, onCancel }) => {
  if (action === 'idle') return null;

  const moverReady = action === 'mover' && scanData && selectedPositions.length === neededPositions;
  const moverPartial = action === 'mover' && scanData && selectedPositions.length > 0 && selectedPositions.length < neededPositions;

  return (
    <div className="flex-shrink-0 border-b border-cyan-800/30 bg-cyan-900/20 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl shrink-0">{action === 'ubicar' ? '📦' : action === 'retirar' ? '📤' : action === 'mover' ? '🔄' : '🚚'}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-cyan-300 uppercase">{action}</p>
            {scanData && <p className="text-xs text-cyan-400/70 truncate">{formatArticleDisplay(scanData.articleCode, scanData.orderFab)}</p>}
            {scannerActive && <p className="text-xs text-cyan-400 animate-pulse">Esperando escaneo...</p>}
            {action === 'ubicar' && scanData && selectedPositions.length === 0 && (
              <p className="text-sm font-black text-emerald-300 animate-pulse">👇 Toca una celda del grid para ubicar aquí</p>
            )}
            {action === 'ubicar' && scanData && selectedPositions.length > 0 && (
              <p className="text-xs text-cyan-400">Pos. seleccionadas: {selectedPositions.map((p) => parseInt(p, 10)).join(', ')}</p>
            )}
            {action === 'retirar' && !scanData && (
              <p className="text-sm font-black text-red-300 animate-pulse">👇 Toca la celda de donde quieres retirar</p>
            )}
            {action === 'mover' && scanData && neededPositions > 0 && (
              <p className={`text-sm font-black animate-pulse ${moverReady ? 'text-emerald-400' : moverPartial ? 'text-amber-400' : 'text-blue-300'}`}>
                {moverReady ? `✓ ${selectedPositions.length}/${neededPositions} celdas listas` :
                  `👇 Selecciona ${neededPositions - selectedPositions.length} celda${neededPositions - selectedPositions.length > 1 ? 's' : ''} de destino (${selectedPositions.length}/${neededPositions})`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action === 'ubicar' && scanData && selectedPositions.length > 0 && (
            <button onClick={onConfirmUbicar} className="px-4 py-2 bg-emerald-500 text-white text-sm font-bold rounded-xl active:scale-95">
              CONFIRMAR UBICAR
            </button>
          )}
          {action === 'mover' && moverReady && (
            <button onClick={onConfirmMove} className="px-4 py-2 bg-emerald-500 text-white text-sm font-bold rounded-xl active:scale-95">
              CONFIRMAR MOVER
            </button>
          )}
          {action === 'mover' && !moverReady && neededPositions > 1 && selectedPositions.length === 0 && scanData && (
            <span className="px-3 py-1.5 bg-amber-900/40 text-amber-300 text-xs font-bold rounded-xl border border-amber-700/50">
              Necesitas {neededPositions} posiciones
            </span>
          )}
          <button onClick={onCancel} className="px-4 py-2 bg-slate-700 text-slate-300 text-sm font-bold rounded-xl active:scale-95">✕ Cancelar</button>
        </div>
      </div>
    </div>
  );
};

export default KioskActionBar;


