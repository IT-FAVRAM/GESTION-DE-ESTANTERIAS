import React, { useState, useEffect, useCallback } from 'react';

interface IdEntryModalProps {
  open: boolean;
  initialValue?: string | null;
  onConfirm: (id: string) => void;
  onClose: () => void;
}

const IdEntryModal: React.FC<IdEntryModalProps> = ({ open, initialValue, onConfirm, onClose }) => {
  const [id, setId] = useState('');

  useEffect(() => {
    if (open) {
      setId(initialValue || '');
    }
  }, [open, initialValue]);

  const handleDigit = useCallback((digit: string) => {
    setId((prev) => {
      if (prev.length >= 10) return prev;
      return prev + digit;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setId((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setId('');
  }, []);

  const handleConfirm = useCallback(() => {
    if (id.trim()) {
      onConfirm(id.trim());
    }
  }, [id, onConfirm]);

  if (!open) return null;

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Identificación</p>
          <h2 className="text-xl font-black text-white">ID del operario</h2>
          <p className="text-xs text-slate-400 mt-1">
            Introduce tu número de operario para registrar la operación
          </p>
        </div>

        {/* Display */}
        <div className="px-6 pb-4">
          <div className="bg-slate-950 border border-slate-700 rounded-2xl px-4 py-4 text-center">
            <span className={`text-4xl font-black font-mono tracking-[0.15em] ${id ? 'text-cyan-400' : 'text-slate-500'}`}>
              {id || '———'}
            </span>
          </div>
        </div>

        {/* Keypad */}
        <div className="px-4 pb-6">
          <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
            {digits.map((digit, idx) => {
              if (!digit) {
                if (idx === 9) {
                  // Empty cell top-left of 0
                  return <div key={idx} />;
                }
                if (idx === 11) {
                  // Clear button
                  return (
                    <button
                      key={idx}
                      onClick={handleClear}
                      className="h-14 rounded-2xl bg-slate-800 text-slate-300 text-sm font-bold
                        active:bg-slate-700 transition-all active:scale-95"
                    >
                      C
                    </button>
                  );
                }
                return <div key={idx} />;
              }
              return (
                <button
                  key={idx}
                  onClick={() => handleDigit(digit)}
                  className="h-14 rounded-2xl bg-slate-800 text-white text-2xl font-black
                    active:bg-slate-700 transition-all active:scale-95 shadow-sm"
                >
                  {digit}
                </button>
              );
            })}
          </div>

          {/* Backspace */}
          <div className="flex justify-center mt-2">
            <button
              onClick={handleBackspace}
              disabled={id.length === 0}
              className="w-[76px] h-12 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold
                active:bg-slate-700 transition-all active:scale-95 disabled:opacity-30"
            >
              ← Borrar
            </button>
          </div>
        </div>

        {/* Confirm / Cancel */}
        <div className="px-4 pb-6 space-y-2">
          <button
            onClick={handleConfirm}
            disabled={id.trim().length === 0}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-cyan-600 to-cyan-500
              text-white font-black text-lg shadow-lg shadow-cyan-950/40
              active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            ✅ CONFIRMAR ID
          </button>
          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl text-sm font-bold bg-rose-600 hover:bg-rose-500
              text-rose-100 hover:text-white border border-rose-500 transition-all active:scale-[0.98]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdEntryModal;

