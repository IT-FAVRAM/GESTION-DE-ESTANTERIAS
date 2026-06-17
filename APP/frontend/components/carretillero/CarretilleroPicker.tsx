/**
 * CarretilleroPicker — Primer paso de toda solicitud al carretillero.
 *
 * El operario/jefe elige a QUÉ carretillero asigna la tarea (igual que el login
 * del carretillero). El elegido recibirá el popup bloqueante y el push; el resto
 * de carretilleros la verán igualmente en su cola.
 */

import React from 'react';
import { useCarretilleros } from '../../hooks/useCarretilleros';
import type { CarretilleroOption } from '../../lib/api/pickupQueueApi';

interface CarretilleroPickerProps {
  open: boolean;
  onSelect: (carretillero: CarretilleroOption) => void;
  onClose: () => void;
}

const CarretilleroPicker: React.FC<CarretilleroPickerProps> = ({ open, onSelect, onClose }) => {
  const { carretilleros, loading, error, refresh } = useCarretilleros(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avisar carretillero</p>
          <h3 className="text-lg font-black text-slate-900">¿A qué carretillero avisas?</h3>
        </div>

        <div className="p-3 max-h-[60vh] overflow-y-auto">
          {loading && carretilleros.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : carretilleros.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-500 mb-3">
                {error ? 'No se pudo cargar la lista de carretilleros.' : 'No hay carretilleros disponibles.'}
              </p>
              <button
                onClick={() => void refresh()}
                className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold active:scale-95 transition-all"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {carretilleros.map((c) => (
                <button
                  key={c.uid}
                  onClick={() => onSelect(c)}
                  className="py-4 px-3 rounded-2xl font-bold text-center bg-slate-50 border border-slate-200 text-slate-900 hover:border-amber-500 active:scale-95 transition-all"
                >
                  <div className="text-2xl mb-2">🚜</div>
                  <div className="text-sm truncate">{c.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white py-3 text-sm font-bold active:scale-[0.98] transition-all touch-manipulation"
          >
            ✕ Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CarretilleroPicker;
