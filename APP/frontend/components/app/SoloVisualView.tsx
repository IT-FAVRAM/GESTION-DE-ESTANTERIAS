import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useShelf } from '../../hooks/useShelf';
import { SHELF_DEFINITIONS, SECTION_DISPLAY_NAMES, SHELF_TO_SECTION } from '../../lib/firestoreSchema';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskSearchBar from '../kiosk/KioskSearchBar';

const SoloVisualView: React.FC = () => {
  const { displayName, logout } = useAuth();
  const [selectedShelf, setSelectedShelf] = useState<string>(SHELF_DEFINITIONS[0]?.code ?? 'PRE');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [highlightedPositions, setHighlightedPositions] = useState<string[]>([]);

  const { shelfDef, locations, loading, totalArticles, totalOccupied, totalEmpty } = useShelf(selectedShelf);
  const section = SHELF_TO_SECTION[selectedShelf] || 'OTROS';

  const filteredLocations = useMemo(() => {
    if (highlightedPositions.length === 0) return locations;
    return locations.filter(loc => highlightedPositions.includes(loc.position));
  }, [locations, highlightedPositions]);

  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 shadow-sm flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">{displayName}</p>
        <button
          onClick={logout}
          className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
        >
          Salir
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — Estanterías */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-0'
          } flex-shrink-0 bg-white border-r border-slate-200 overflow-y-auto transition-all duration-200 hidden sm:flex flex-col`}
        >
          <div className="p-4 space-y-2">
            <h2 className="text-sm font-bold text-slate-500 uppercase">Estanterías</h2>
            {SHELF_DEFINITIONS.map(shelf => (
              <button
                key={shelf.code}
                onClick={() => setSelectedShelf(shelf.code)}
                className={`w-full text-left px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  selectedShelf === shelf.code
                    ? 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {shelf.code} — {shelf.name}
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Shelf Info + Search */}
          <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="sm:hidden px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                ☰
              </button>
              <div>
                <h2 className="text-xl font-black text-slate-900">{shelfDef?.name || 'Cargando...'}</h2>
                <p className="text-xs text-slate-500">{SECTION_DISPLAY_NAMES[section]}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p><strong>{totalOccupied}</strong>/{totalArticles}</p>
                <p><strong>{totalEmpty}</strong> vacías</p>
              </div>
            </div>

            {/* Search */}
            <KioskSearchBar
              locations={locations}
              onHighlight={setHighlightedPositions}
              currentShelfCode={selectedShelf}
              placeholder="🔍 Buscar en toda la nave..."
              global={true}
              canNavigateToShelf={true}
              onShelfNavigate={setSelectedShelf}
            />
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto bg-sky-50 p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-400 font-medium">Cargando estantería...</p>
                </div>
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <span className="text-5xl block mb-3">🔍</span>
                  <p className="text-slate-500 font-medium">
                    {highlightedPositions.length > 0 ? 'No hay resultados' : 'Estantería vacía'}
                  </p>
                </div>
              </div>
            ) : (
              <ShelfGrid
                locations={filteredLocations}
                shelfDef={shelfDef}
                onCellPress={() => {}}
                selectedPositions={[]}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SoloVisualView;
