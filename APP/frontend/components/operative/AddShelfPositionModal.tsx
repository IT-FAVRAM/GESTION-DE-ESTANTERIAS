/**
 * AddShelfPositionModal — "➕ Otra sección" para UBICAR de artículos grandes.
 *
 * Extraído del antiguo ShelfNavigator para reutilizarse desde el motor único.
 * Permite añadir posiciones del mismo artículo en OTRA sección (además de la
 * estantería actual). Las posiciones se introducen en texto (ej: "5" o "3,4,5").
 */

import React, { useState } from 'react';
import { ALL_SHELVES } from '../../lib/firestoreSchema';

export interface AdditionalShelfPosition {
  shelfCode: string;
  shelfName: string;
  positions: string[];
}

interface AddShelfPositionModalProps {
  open: boolean;
  /** Sección actual — se excluye del selector. */
  currentShelfCode: string;
  onAdd: (entry: AdditionalShelfPosition) => void;
  onClose: () => void;
}

const AddShelfPositionModal: React.FC<AddShelfPositionModalProps> = ({
  open,
  currentShelfCode,
  onAdd,
  onClose,
}) => {
  const [shelfCode, setShelfCode] = useState('');
  const [positionText, setPositionText] = useState('');
  const [inputError, setInputError] = useState('');

  if (!open) return null;

  const reset = () => {
    setShelfCode('');
    setPositionText('');
    setInputError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAdd = () => {
    if (!shelfCode || !positionText.trim()) return;
    setInputError('');
    const parsedPositions = positionText
      .split(',')
      .map((p) => parseInt(p.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
      .map((n) => String(n).padStart(3, '0'));
    if (parsedPositions.length === 0) {
      setInputError('Introduce números válidos (ej: 5 ó 3,4,5)');
      return;
    }
    const shelfName = ALL_SHELVES.find((s) => s.code === shelfCode)?.name ?? shelfCode;
    onAdd({ shelfCode, shelfName, positions: parsedPositions });
    reset();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div className="w-full max-w-md bg-white rounded-t-3xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black text-slate-900">➕ Añadir posición en otra sección</h3>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sección</label>
          <select
            value={shelfCode}
            onChange={(e) => setShelfCode(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium bg-white"
          >
            <option value="">— Selecciona sección —</option>
            {ALL_SHELVES.filter((s) => s.code !== currentShelfCode).map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Posiciones (ej: 5 o 3,4,5)
          </label>
          <input
            type="text"
            value={positionText}
            onChange={(e) => setPositionText(e.target.value)}
            placeholder="3 ó 3,4,5"
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono bg-white"
          />
        </div>
        {inputError && <p className="text-xs text-red-500 font-medium">{inputError}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-3 rounded-2xl bg-rose-100 text-rose-700 font-bold text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={!shelfCode || !positionText.trim()}
            className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm active:scale-95 disabled:opacity-50"
          >
            ✓ Añadir
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddShelfPositionModal;
