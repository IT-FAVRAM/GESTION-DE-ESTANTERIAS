import React from 'react';

interface ShelfNavigatorStatusProps {
  totalEmpty: number;
  totalOccupied: number;
  totalArticles: number;
  actionActive: boolean;
  canConfirmMove: boolean;
  scannerActive: boolean;
  scanArticle?: string;
  onConfirmMove: () => void;
  onCancel: () => void;
  fullscreenMode?: boolean;
}

const ShelfNavigatorStatus: React.FC<ShelfNavigatorStatusProps> = ({ totalEmpty, totalOccupied, totalArticles, actionActive, canConfirmMove, scannerActive, scanArticle, onConfirmMove, onCancel, fullscreenMode = false }) => (
  <>
    {!fullscreenMode && (
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-slate-900/30">
        <div className="flex gap-3 text-xs text-slate-500">
          <span className="text-emerald-400">{totalEmpty} vacíos</span>
          <span className="text-orange-400">{totalOccupied} ocupados</span>
          <span>{totalArticles} artículos</span>
        </div>
        {actionActive && (
          <div className="flex items-center gap-2">
            {canConfirmMove && <button onClick={onConfirmMove} className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg">CONFIRMAR</button>}
            <button onClick={onCancel} className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs font-bold rounded-lg">✕ Cancelar</button>
          </div>
        )}
      </div>
    )}
    {scannerActive && <div className="mx-4 mt-2 p-3 rounded-xl bg-cyan-900/20 border border-cyan-500/20 text-center"><p className="text-sm font-bold text-cyan-400 animate-pulse">📡 Esperando escaneo...</p></div>}
    {scanArticle && <div className="mx-4 mt-2 p-3 rounded-xl bg-cyan-900/20 border border-cyan-500/20 text-center"><p className="text-sm text-cyan-300">Selecciona una celda para ubicar <strong>{scanArticle}</strong></p></div>}
  </>
);

export default ShelfNavigatorStatus;
