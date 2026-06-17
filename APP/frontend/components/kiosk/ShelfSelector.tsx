/**
 * ShelfSelector — Botón simple para cambiar entre estanterías del kiosko
 */

import React from 'react';
import { getShelfDisplayName } from '../../lib/shelfDisplayNames';

interface ShelfSelectorProps {
  shelves: string[];
  currentShelf: string | null;
  onSelectShelf: (shelf: string) => void;
}

const ShelfSelector: React.FC<ShelfSelectorProps> = ({ shelves, currentShelf, onSelectShelf }) => {
  if (!shelves || shelves.length <= 1) {
    return null;
  }

  return (
    <div className="flex gap-2 items-center">
      <span className="text-xs text-slate-400 uppercase tracking-wide">Estantería:</span>
      <div className="flex gap-2">
        {shelves.map((shelf) => (
          <button
            key={shelf}
            onClick={() => onSelectShelf(shelf)}
            className={`px-3 py-1 rounded text-sm font-bold transition-all ${
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


