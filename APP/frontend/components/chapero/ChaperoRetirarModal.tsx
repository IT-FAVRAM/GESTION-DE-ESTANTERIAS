import React, { useState } from 'react';
import type { ChaperaItem } from '../../lib/schema/chapero';

interface ChaperoRetirarModalProps {
  positionId: string;
  items: ChaperaItem[];
  onConfirm: (itemIds: string[]) => void;
  onClose: () => void;
  loading?: boolean;
}

const ChaperoRetirarModal: React.FC<ChaperoRetirarModalProps> = ({ positionId, items, onConfirm, onClose, loading }) => {
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (items.length === 1) s.add(items[0].id);
    return s;
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const canConfirm = selected.size > 0 && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-red-700 px-5 py-4">
          <h2 className="text-lg font-black text-white">Retirar chapa</h2>
          <p className="text-xs text-red-200 mt-0.5">Posición <span className="font-bold text-white">{positionId}</span></p>
        </div>

        <div className="p-5 space-y-2">
          {items.length > 1 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 mb-1"
            >
              {selected.size === items.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          )}

          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className={`w-full text-left rounded-2xl border-2 p-3 transition-all ${
                selected.has(item.id) ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                  selected.has(item.id) ? 'bg-red-500 border-red-500' : 'border-slate-300'
                }`}>
                  {selected.has(item.id) && <span className="text-white text-[10px] font-black">✓</span>}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-slate-800 text-sm">
                    {item.material}
                    {item.spec && <span className="font-normal text-slate-500"> {item.spec}</span>}
                    <span className="text-slate-500 font-normal"> · {item.espesor} mm</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {item.locatedByName} · {new Date(item.locatedAt).toLocaleDateString('es-ES')}
                    {item.albaran && <> · Alb. {item.albaran}</>}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm([...selected])}
            disabled={!canConfirm}
            className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${
              canConfirm
                ? 'bg-red-600 text-white active:scale-[0.98]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Retirando...' : `Retirar ${selected.size > 0 ? selected.size : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChaperoRetirarModal;
