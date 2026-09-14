/**
 * ShelfSelector — Botones para cambiar entre estanterías del kiosko.
 *
 * - 'row': fila horizontal (una línea por botón, desplaza si no caben).
 * - 'rail': lista vertical para el raíl lateral del kiosko en tablet horizontal.
 */

import React from 'react';
import { getShelfDisplayName } from '../../lib/shelfDisplayNames';

interface ShelfSelectorProps {
  shelves: string[];
  currentShelf: string | null;
  onSelectShelf: (shelf: string) => void;
  variant?: 'row' | 'rail';
}

const ShelfSelector: React.FC<ShelfSelectorProps> = ({ shelves, currentShelf, onSelectShelf, variant = 'row' }) => {
  if (!shelves || shelves.length <= 1) {
    return null;
  }

  if (variant === 'rail') {
    return (
      <div className="flex flex-col gap-1.5">
        {shelves.map((shelf) => (
          <button
            key={shelf}
            onClick={() => onSelectShelf(shelf)}
            aria-current={currentShelf === shelf ? 'true' : undefined}
            className={`w-full min-h-12 px-3 py-2 rounded-xl text-left text-sm font-black leading-tight transition-colors touch-manipulation ${
              currentShelf === shelf
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-700 border border-slate-300 active:bg-slate-100'
            }`}
          >
            {getShelfDisplayName(shelf)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-center min-w-0 max-w-full">
      <span className="text-xs text-slate-400 uppercase tracking-wide shrink-0">Estantería:</span>
      <div className="flex gap-2 overflow-x-auto min-w-0 [scrollbar-width:thin]">
        {shelves.map((shelf) => (
          <button
            key={shelf}
            onClick={() => onSelectShelf(shelf)}
            className={`shrink-0 whitespace-nowrap px-3 py-1 rounded text-sm font-bold transition-all ${
              currentShelf === shelf
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/50'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {getShelfDisplayName(shelf)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ShelfSelector;
