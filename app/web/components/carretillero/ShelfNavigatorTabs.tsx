import React from 'react';
import { CART_DEFINITIONS, SHELF_DEFINITIONS } from '../../lib/firestoreSchema';

interface ShelfNavigatorTabsProps {
  selectedShelf: string;
  onSelectShelf: (shelfCode: string) => void;
}

const ShelfNavigatorTabs: React.FC<ShelfNavigatorTabsProps> = ({ selectedShelf, onSelectShelf }) => (
  <div className="flex-shrink-0 overflow-x-auto bg-slate-900/50 border-b border-slate-800">
    <div className="flex gap-1 p-2 min-w-max">
      {SHELF_DEFINITIONS.map((shelf) => (
        <button key={shelf.code} onClick={() => onSelectShelf(shelf.code)} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${selectedShelf === shelf.code ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
          {shelf.name}
        </button>
      ))}
    </div>
  </div>
);

export default ShelfNavigatorTabs;
