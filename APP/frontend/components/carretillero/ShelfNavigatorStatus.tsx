import React from 'react';

interface ShelfNavigatorStatusProps {
  totalEmpty: number;
  totalOccupied: number;
  totalArticles: number;
  actionActive: boolean;
  canConfirmMove: boolean;
  moverNeeded?: number;
  moverSelected?: number;
  scannerActive: boolean;
  scanArticle?: string;
  onConfirmMove: () => void;
  onCancel: () => void;
  fullscreenMode?: boolean;
}

const ShelfNavigatorStatus: React.FC<ShelfNavigatorStatusProps> = ({
  totalEmpty, totalOccupied, totalArticles, actionActive, canConfirmMove,
  moverNeeded, moverSelected, scannerActive, scanArticle, onConfirmMove, onCancel, fullscreenMode = false,
}) => {
  const showMoverProgress = typeof moverNeeded === 'number' && moverNeeded > 0 && typeof moverSelected === 'number';
  const moverComplete = showMoverProgress && moverSelected === moverNeeded;

  return (
    <>
      {!fullscreenMode && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100 gap-2">
          <div className="flex gap-3 text-xs">
            <span className="text-emerald-600 font-semibold">{totalEmpty} vacíos</span>
            <span className="text-orange-600 font-semibold">{totalOccupied} ocupados</span>
            <span className="text-slate-500">{totalArticles} artículos</span>
          </div>
          {actionActive && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {showMoverProgress && (
                <span className={`text-xs font-bold px-2 py-1 rounded-lg
                  ${moverComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {moverSelected}/{moverNeeded} pos.
                </span>
              )}
              {canConfirmMove && moverComplete && (
                <button onClick={onConfirmMove} className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg active:scale-95">
                  CONFIRMAR
                </button>
              )}
              <button onClick={onCancel} className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg active:scale-95">
                ✕ Cancelar
              </button>
            </div>
          )}
        </div>
      )}
      {scannerActive && (
        <div className="mx-4 mt-2 p-3 rounded-xl bg-sky-50 border border-sky-300 text-center">
          <p className="text-sm font-bold text-sky-700 animate-pulse">📡 Esperando escaneo...</p>
        </div>
      )}
      {scanArticle && (
        <div className="mx-3 mt-2 p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 shadow-lg shadow-emerald-100">
          <p className="text-lg font-black text-emerald-700 text-center">📦 {scanArticle}</p>
          <p className="text-sm font-bold text-emerald-600 text-center mt-1">👇 Toca una celda para ubicar</p>
        </div>
      )}
      {showMoverProgress && !moverComplete && moverSelected === 0 && (
        <div className="mx-3 mt-2 p-5 rounded-2xl bg-blue-50 border-2 border-blue-500 shadow-lg shadow-blue-100">
          <p className="text-lg font-black text-blue-700 text-center">🔄 Mover</p>
          <p className="text-sm font-bold text-blue-600 text-center mt-1">
            👇 Toca {moverNeeded} celda{moverNeeded !== 1 ? 's' : ''} de destino
          </p>
        </div>
      )}
      {showMoverProgress && !moverComplete && (moverSelected ?? 0) > 0 && (
        <div className="mx-3 mt-2 p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 text-center">
          <p className="text-sm font-bold text-amber-700">
            {moverSelected}/{moverNeeded} celdas — toca {(moverNeeded ?? 0) - (moverSelected ?? 0)} más
          </p>
        </div>
      )}
    </>
  );
};

export default ShelfNavigatorStatus;


