
import React, { useState } from 'react';
import { CloseIcon } from './Icons';

interface ManualEntryModalProps {
  onSubmit: (barcode: string, orderId: string) => void;
  onClose: () => void;
  onPhotoRequest?: () => void;
  isFreeTextMode?: boolean;
}

const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ onSubmit, onClose, isFreeTextMode = false }) => {
  const [barcode, setBarcode] = useState('');
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) {
      setError("El campo es obligatorio");
      return;
    }

    if (isFreeTextMode) {
      // In free text mode, we supply a generic orderId to allow storage
      // using 'GENERAL' as the convention for free text items
      onSubmit(barcode.trim().toUpperCase(), "GENERAL");
      return;
    }

    if (!orderId.trim()) {
      setError("La OF es obligatoria");
      return;
    }
    // Basic format check for OF
    if (!orderId.trim().toUpperCase().startsWith("OF")) {
      setError("La Orden de Fabricación debe empezar por 'OF'");
      return;
    }

    onSubmit(barcode.trim().toUpperCase(), orderId.trim().toUpperCase());
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-end md:items-center justify-center md:p-4" role="dialog" aria-modal="true">
      <div className="relative w-full md:max-w-md bg-slate-900 md:rounded-2xl rounded-t-2xl shadow-2xl p-5 md:p-8 border border-slate-800 max-h-[90dvh] overflow-y-auto pb-safe">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-11 w-11 inline-flex items-center justify-center text-slate-400 hover:text-white bg-slate-800/50 rounded-full transition-colors"
        >
          <CloseIcon className="h-6 w-6" />
        </button>

        <h2 className="text-2xl font-bold mb-6 text-white">
          {isFreeTextMode ? 'Añadir Texto / Nota' : 'Entrada Manual'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-2 uppercase">
              {isFreeTextMode ? 'Descripción del Contenido' : '1. Artículo'}
            </label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => { setBarcode(e.target.value.toUpperCase()); setError(null); }}
              inputMode="text"
              autoCapitalize="characters"
              autoFocus
              className="w-full p-4 bg-slate-800 border-2 border-slate-700 rounded-xl focus:ring-0 focus:outline-none focus:border-cyan-500 text-white text-base"
              placeholder={isFreeTextMode ? "EJ: TORNILLOS, GUANTES..." : "EJ: REF-123"}
              aria-label={isFreeTextMode ? "Descripción del Contenido" : "Artículo"}
              autoComplete="off"
              spellCheck="false"
            />
          </div>

          {!isFreeTextMode && (
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 uppercase">2. Orden Fabricación (OF)</label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => { setOrderId(e.target.value.toUpperCase()); setError(null); }}
                inputMode="text"
                autoCapitalize="characters"
                className="w-full p-4 bg-slate-800 border-2 border-slate-700 rounded-xl focus:ring-0 focus:outline-none focus:border-purple-500 text-white text-base"
                placeholder="EJ: OF25-06771"
                aria-label="Orden de Fabricación"
                autoComplete="off"
                spellCheck="false"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm font-bold text-center">{error}</p>}

          <button
            type="submit"
            className="w-full mt-4 p-4 bg-cyan-500 text-slate-950 font-bold text-lg rounded-xl hover:bg-cyan-400 transition-all active:scale-[0.98]"
          >
            {isFreeTextMode ? 'Añadir al Carro' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ManualEntryModal;
