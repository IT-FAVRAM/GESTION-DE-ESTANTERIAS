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
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100">
        <div className="flex gap-3 text-xs">
          <span className="text-emerald-600 font-semibold">{totalEmpty} vacíos</span>
          <span className="text-orange-600 font-semibold">{totalOccupied} ocupados</span>
          <span className="text-slate-500">{totalArticles} artículos</span>
        </div>
        {actionActive && (
          <div className="flex items-center gap-2">
            {canConfirmMove && <button onClick={onConfirmMove} className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg">CONFIRMAR</button>}
            <button onClick={onCancel} className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">✕ Cancelar</button>
          </div>
        )}
      </div>
    )}
    {scannerActive && <div className="mx-4 mt-2 p-3 rounded-xl bg-sky-50 border border-sky-300 text-center"><p className="text-sm font-bold text-sky-700 animate-pulse">📡 Esperando escaneo...</p></div>}
    {scanArticle && <div className="mx-4 mt-2 p-3 rounded-xl bg-sky-50 border border-sky-300 text-center"><p className="text-sm text-sky-700">Selecciona una celda para ubicar <strong>{scanArticle}</strong></p></div>}
  </>
);

export default ShelfNavigatorStatus;
