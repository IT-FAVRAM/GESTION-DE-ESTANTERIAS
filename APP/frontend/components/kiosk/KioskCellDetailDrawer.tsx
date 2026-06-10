import React from 'react';
import type { KioskCellDetail } from './kioskShared';

const KioskCellDetailDrawer: React.FC<KioskCellDetail> = ({ selectedCell, onClose }) => {
  if (!selectedCell || selectedCell.isEmpty) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-slate-900 rounded-t-3xl border-t border-slate-700 p-6 animate-slide-up" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-white">Posicion {selectedCell.position}</h3>
          <span className="text-sm text-slate-400">{selectedCell.items.length} articulo(s)</span>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {selectedCell.items.map((item, index) => (
            <div key={index} className="flex items-center justify-between bg-slate-800 rounded-xl p-3">
              <div>
                <p className="font-bold text-white text-sm">{item.articleCode}</p>
                <p className="text-xs text-cyan-400">{item.orderFab}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">{new Date(item.locatedAt).toLocaleDateString('es-ES')}</p>
                <p className="text-xs text-slate-600">Op. {item.locatedBy}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-4 py-3 bg-rose-700 hover:bg-rose-600 text-rose-200 hover:text-white font-bold rounded-xl border border-rose-600 transition-all active:scale-[0.98]">Cerrar</button>
      </div>
    </div>
  );
};

export default KioskCellDetailDrawer;


