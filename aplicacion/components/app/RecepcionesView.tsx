/**
 * RecepcionesView — Vista del rol RECEPCIONES.
 *
 * Igual que SoloVisualView (solo lectura: ver estanterías, buscar, inspeccionar
 * celdas), pero con UNA función propia: avisar al carretillero de que hay material
 * recepcionado para recoger. No hay que indicar nada — solo se elige a qué
 * carretillero se avisa (igual que el resto de avisos de la app). El carretillero
 * recibe simplemente "ir a Recepciones a por material".
 */

import React, { useMemo, useState } from 'react';
import { Camera, Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useShelf, type ShelfLocationState } from '../../hooks/useShelf';
import { useDeviceConfig } from '../../hooks/useDeviceConfig';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import { SHELF_DEFINITIONS, CART_DEFINITIONS, SECTION_DISPLAY_NAMES, SHELF_TO_SECTION } from '../../lib/firestoreSchema';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskSearchBar from '../kiosk/KioskSearchBar';
import LocationPhotoGallery from '../common/LocationPhotoGallery';
import PhotoCarousel from '../common/PhotoCarousel';
import CarretilleroPicker from '../carretillero/CarretilleroPicker';
import type { CarretilleroOption } from '../../lib/api/pickupQueueApi';

const RecepcionesView: React.FC = () => {
  const { displayName, logout, deviceId, firebaseUser } = useAuth();
  const { allowedShelves } = useDeviceConfig(deviceId);
  const { createRecepcionRequest } = usePickupQueue();
  const [selectedShelf, setSelectedShelf] = useState<string>(SHELF_DEFINITIONS[0]?.code ?? 'PRE');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [highlightedPositions, setHighlightedPositions] = useState<string[]>([]);
  const [highlightedItemKey, setHighlightedItemKey] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<ShelfLocationState | null>(null);
  const [showPhotoCarousel, setShowPhotoCarousel] = useState(false);

  // ── Avisar carretillero ──
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const { shelfDef, locations, loading, totalArticles, totalOccupied, totalEmpty } = useShelf(selectedShelf);
  const section = SHELF_TO_SECTION[selectedShelf] || 'OTROS';
  const isSoldaduraShelf = section === 'SOLDADURA';

  const shelfPhotoEntries = useMemo(
    () => locations.flatMap((loc) => (loc.photos ?? []).map((photo) => ({ photo, position: loc.position }))),
    [locations],
  );

  const availableShelves = useMemo(() => {
    if (allowedShelves.length === 0) return SHELF_DEFINITIONS;
    return SHELF_DEFINITIONS.filter(shelf => allowedShelves.includes(shelf.code));
  }, [allowedShelves]);

  const availableCarts = useMemo(() => {
    if (allowedShelves.length === 0) return CART_DEFINITIONS;
    return CART_DEFINITIONS.filter(cart => allowedShelves.includes(cart.code));
  }, [allowedShelves]);

  const handleSelectCarretillero = async (carretillero: CarretilleroOption) => {
    if (sending) return;
    setSending(true);
    const ok = await createRecepcionRequest({
      operarioId: firebaseUser?.uid || 'recepciones',
      operarioName: displayName || 'Recepciones',
      targetCarretilleroId: carretillero.uid,
      targetCarretilleroName: carretillero.name,
    });
    setSending(false);
    setPickerOpen(false);
    setToast(ok
      ? { ok: true, text: `Avisado ${carretillero.name}. Irá a Recepciones a por el material.` }
      : { ok: false, text: 'No se pudo avisar. Inténtalo de nuevo.' });
    window.setTimeout(() => setToast(null), 5000);
  };

  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight truncate">Recepciones</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setPickerOpen(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-black rounded-lg transition-colors text-sm flex items-center gap-2 shadow active:scale-95"
          >
            Avisar carretillero
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors text-sm"
          >
            Salir
          </button>
        </div>
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
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {shelf.code} — {shelf.name}
                </button>
              ))}
            </div>

            {availableCarts.length > 0 && (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <h2 className="text-sm font-bold text-slate-500 uppercase">Carros</h2>
                {availableCarts.map(cart => (
                  <button
                    key={cart.code}
                    onClick={() => { setSelectedShelf(cart.code); setSidebarOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                      selectedShelf === cart.code
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
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
          <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 sm:py-3 space-y-2.5">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden sm:block px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors flex-shrink-0"
                aria-label="Mostrar/ocultar estanterías"
              >
                <Menu className="w-5 h-5" aria-hidden />
              </button>

              <div className="flex-1 sm:hidden">
                <select
                  value={selectedShelf}
                  onChange={(e) => setSelectedShelf(e.target.value)}
                  className="w-full px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 appearance-none"
                >
                  <optgroup label="Estanterías">
                    {availableShelves.map(shelf => (
                      <option key={shelf.code} value={shelf.code}>
                        {shelf.code} — {shelf.name}
                      </option>
                    ))}
                  </optgroup>
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

              <div className="hidden sm:block min-w-0">
                <h2 className="text-xl font-black text-slate-900 truncate">{shelfDef?.name || 'Cargando...'}</h2>
                <p className="text-xs text-slate-500">{SECTION_DISPLAY_NAMES[section]}</p>
              </div>

              <div className="ml-auto text-right text-[11px] sm:text-xs text-slate-500 flex-shrink-0 leading-tight">
                <p><strong className="text-slate-900 text-sm sm:text-base">{totalOccupied}</strong>/{totalOccupied + totalEmpty} ocup.</p>
                <p><strong className="text-slate-700">{totalEmpty}</strong> vacías · <strong className="text-slate-700">{totalArticles}</strong> art.</p>
              </div>
            </div>

            <div className="sm:hidden">
              <h2 className="text-lg font-black text-slate-900 truncate leading-tight">{shelfDef?.name || 'Cargando...'}</h2>
              <p className="text-[11px] text-slate-500">{SECTION_DISPLAY_NAMES[section]}</p>
            </div>

            <KioskSearchBar
              locations={locations}
              onHighlight={(positions, itemKey) => {
                setHighlightedPositions(positions);
                setHighlightedItemKey(itemKey ?? null);
              }}
              currentShelfCode={selectedShelf}
              placeholder="Buscar en toda la nave..."
              global={true}
              canNavigateToShelf={true}
              onShelfNavigate={(code, positions, itemKey) => {
                setSelectedShelf(code);
                setHighlightedPositions(positions ?? []);
                setHighlightedItemKey(itemKey ?? null);
              }}
            />
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto bg-sky-50 p-2 sm:p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-400 font-medium">Cargando estantería...</p>
                </div>
              </div>
            ) : locations.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-slate-500 font-medium">Estantería vacía</p>
                </div>
              </div>
            ) : (
              <ShelfGrid
                locations={locations}
                shelfDef={shelfDef}
                onCellPress={setSelectedCell}
                selectedPositions={[]}
                highlightedPositions={highlightedPositions}
                highlightedItemKey={highlightedItemKey}
              />
            )}
          </div>
        </main>
      </div>

      {/* Inspección de celda (solo lectura) */}
      {selectedCell && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedCell(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ubicación</p>
                <h3 className="text-lg font-black text-slate-900 font-mono truncate">
                  {selectedShelf} {parseInt(selectedCell.position, 10) || selectedCell.position}
                </h3>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] font-bold font-mono px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  {selectedCell.items.length} art.
                </span>
                <button
                  onClick={() => setSelectedCell(null)}
                  className="text-rose-500 hover:text-rose-700 text-2xl leading-none"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-3 max-h-[60vh] overflow-y-auto space-y-2">
              {selectedCell.items.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">Ubicación vacía</p>
              ) : (
                selectedCell.items.map((item, idx) => (
                  <div key={`${item.articleCode}-${item.orderFab}-${idx}`} className={`rounded-xl px-3 py-2.5 border ${item.subcontratacion ? 'bg-orange-50 border-orange-300' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[15px] font-black font-mono text-slate-900 leading-tight break-all">{item.articleCode}</p>
                      {item.subcontratacion && (
                        <span className="flex-shrink-0 text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-500 text-white">Subcon.</span>
                      )}
                    </div>
                    {item.orderFab && <p className="text-[12px] font-bold font-mono text-emerald-700 leading-tight break-all">{item.orderFab}</p>}
                    <p className="text-[11px] text-slate-500 mt-1 break-words">
                      {item.locatedByName}{item.locatedAt ? ` · ${new Date(item.locatedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                    </p>
                  </div>
                ))
              )}
              {isSoldaduraShelf && (
                <LocationPhotoGallery
                  shelfCode={selectedShelf}
                  position={selectedCell.position}
                  photos={selectedCell.photos ?? []}
                  canManage={false}
                  uploadedBy=""
                  uploadedByName=""
                  onPhotosUpdated={() => {}}
                />
              )}
              {selectedCell.nota && (
                <div className="pt-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Nota</p>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600">
                    {selectedCell.nota}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Carrusel de fotos (solo SOLDADURA) */}
      {isSoldaduraShelf && shelfPhotoEntries.length > 0 && (
        <button
          onClick={() => setShowPhotoCarousel(true)}
          className="fixed bottom-6 right-4 z-40 bg-violet-600 hover:bg-violet-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-xl active:scale-95 transition-all"
          aria-label="Ver carrusel de fotos"
        >
          <Camera className="w-6 h-6" aria-hidden />
          <span className="absolute -top-1 -right-1 bg-white text-violet-600 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow">
            {shelfPhotoEntries.length}
          </span>
        </button>
      )}

      {showPhotoCarousel && shelfPhotoEntries.length > 0 && (
        <PhotoCarousel
          entries={shelfPhotoEntries}
          canManage={false}
          onClose={() => setShowPhotoCarousel(false)}
        />
      )}

      {/* Selector de carretillero para el aviso */}
      <CarretilleroPicker
        open={pickerOpen}
        onSelect={handleSelectCarretillero}
        onClose={() => setPickerOpen(false)}
      />

      {/* Spinner mientras se envía el aviso */}
      {sending && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Toast de confirmación */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl shadow-2xl text-white font-bold text-sm max-w-[90vw] text-center ${toast.ok ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toast.ok ? '✓ ' : ''}{toast.text}
        </div>
      )}
    </div>
  );
};

export default RecepcionesView;
