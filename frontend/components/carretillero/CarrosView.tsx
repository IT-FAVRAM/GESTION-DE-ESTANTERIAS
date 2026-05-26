/**
 * CarrosView — Pantalla de carros para el carretillero.
 *
 * Muestra los 4 carros como estanterías reales (ubicar/retirar/mover)
 * con el mismo funcionamiento e interfaz que el resto de estanterías.
 * El selector de carro está en la parte superior; debajo se renderiza
 * el ShelfNavigator bloqueado al carro seleccionado.
 */

import React, { useState } from 'react';
import ShelfNavigator from './ShelfNavigator';
import { CART_DEFINITIONS } from '../../lib/firestoreSchema';

const CarrosView: React.FC = () => {
  const [selectedCart, setSelectedCart] = useState<string>(CART_DEFINITIONS[0]?.code ?? '');

  const cartDef = CART_DEFINITIONS.find((c) => c.code === selectedCart);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-sky-50">
      {/* Selector de carro */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
          🛒 Selecciona un carro
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CART_DEFINITIONS.map((cart) => (
            <button
              key={cart.code}
              onClick={() => setSelectedCart(cart.code)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap
                ${selectedCart === cart.code
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300'
                }`}
            >
              <span className="mr-1.5">🛒</span>
              {cart.name}
            </button>
          ))}
        </div>
        {cartDef && (
          <p className="text-xs text-slate-400 mt-1.5">
            {cartDef.locationCount} baldas · {cartDef.section}
          </p>
        )}
      </div>

      {/* ShelfNavigator bloqueado al carro seleccionado
          key={selectedCart} fuerza remount al cambiar de carro → estado limpio */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {selectedCart ? (
          <ShelfNavigator key={selectedCart} shelfCode={selectedCart} />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            Selecciona un carro
          </div>
        )}
      </div>
    </div>
  );
};

export default CarrosView;
