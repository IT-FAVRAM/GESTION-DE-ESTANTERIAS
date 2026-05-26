import React from 'react';
import { CART_DEFINITIONS, SHELF_DEFINITIONS } from '../../lib/firestoreSchema';

interface ShelfNavigatorTabsProps {
  selectedShelf: string;
  onSelectShelf: (shelfCode: string) => void;
}

const ShelfNavigatorTabs: React.FC<ShelfNavigatorTabsProps> = ({ selectedShelf, onSelectShelf }) => (
  <div className="flex-shrink-0 overflow-x-auto bg-sky-50 border-b border-slate-200">
    <div className="flex gap-1 p-2 min-w-max">
      {SHELF_DEFINITIONS.map((shelf) => (
        <button key={shelf.code} onClick={() => onSelectShelf(shelf.code)} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${selectedShelf === shelf.code ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-white'}`}>
          {shelf.name}
        </button>
      ))}
    </div>
  </div>
);

export default ShelfNavigatorTabs;


