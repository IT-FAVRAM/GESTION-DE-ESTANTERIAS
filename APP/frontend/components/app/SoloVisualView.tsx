import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useShelf } from '../../hooks/useShelf';
import { useDeviceConfig } from '../../hooks/useDeviceConfig';
import { SHELF_DEFINITIONS, CART_DEFINITIONS, SECTION_DISPLAY_NAMES, SHELF_TO_SECTION } from '../../lib/firestoreSchema';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskSearchBar from '../kiosk/KioskSearchBar';

const SoloVisualView: React.FC = () => {
  const { displayName, logout, deviceId } = useAuth();
  const { allowedShelves } = useDeviceConfig(deviceId);
  const [selectedShelf, setSelectedShelf] = useState<string>(SHELF_DEFINITIONS[0]?.code ?? 'PRE');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [highlightedPositions, setHighlightedPositions] = useState<string[]>([]);
  const [showMobileShelfSelector, setShowMobileShelfSelector] = useState(false);

  const { shelfDef, locations, loading, totalArticles, totalOccupied, totalEmpty } = useShelf(selectedShelf);
  const section = SHELF_TO_SECTION[selectedShelf] || 'OTROS';

  // Filtrar estanterías según allowedShelves (si está definido)
  const availableShelves = useMemo(() => {
    if (allowedShelves.length === 0) return SHELF_DEFINITIONS;
    return SHELF_DEFINITIONS.filter(shelf => allowedShelves.includes(shelf.code));
  }, [allowedShelves]);

  // Filtrar carros según allowedShelves
  const availableCarts = useMemo(() => {
    if (allowedShelves.length === 0) return CART_DEFINITIONS;
    return CART_DEFINITIONS.filter(cart => allowedShelves.includes(cart.code));
  }, [allowedShelves]);

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
          <div className="p-4 space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-500 uppercase">Estanterías</h2>
              {availableShelves.map(shelf => (
                <button
                  key={shelf.code}
                  onClick={() => { setSelectedShelf(shelf.code); setSidebarOpen(false); }}
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

            {availableCarts.length > 0 && (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <h2 className="text-sm font-bold text-slate-500 uppercase">🚚 Carros</h2>
                {availableCarts.map(cart => (
                  <button
                    key={cart.code}
                    onClick={() => { setSelectedShelf(cart.code); setSidebarOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                      selectedShelf === cart.code
                        ? 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {cart.code} — {cart.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Shelf Info + Search */}
          <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="sm:hidden">
                <select
                  value={selectedShelf}
                  onChange={(e) => setSelectedShelf(e.target.value)}
                  className="px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                >
                  {availableShelves.map(shelf => (
                    <option key={shelf.code} value={shelf.code}>
                      {shelf.code} — {shelf.name}
                    </option>
                  ))}
                  {availableCarts.length > 0 && (
                    <optgroup label="Carros">
                      {availableCarts.map(cart => (
                        <option key={cart.code} value={cart.code}>
                          {cart.code} — {cart.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden sm:block px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
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
