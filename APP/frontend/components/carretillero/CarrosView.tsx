/**
 * CarrosView — Pantalla de carros para el carretillero.
 *
 * Muestra los 4 carros como estanterías reales (ubicar/retirar/mover/almacen)
 * con el mismo funcionamiento e interfaz que el resto de estanterías.
 *
 * Ahora usa el motor operativo único (useOperativeShelf + OperativeShelfArea)
 * en lugar del legacy ShelfNavigator (803 líneas que duplicaban el flujo
 * completo de useOperativeShelf).
 *
 * El selector de carro está en la parte superior; debajo se renderiza
 * el área operativa bloqueada al carro seleccionado.
 */

import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { CART_DEFINITIONS } from '../../lib/firestoreSchema';
import { buildOperativeConfig } from '../../lib/operative/operativeConfig';
import { useOperativeShelf } from '../../hooks/useOperativeShelf';
import OperativeShelfArea from '../operative/OperativeShelfArea';
import OperativeActionButtons from '../operative/OperativeActionButtons';

interface CarrosViewProps {
  onBack?: () => void;
}

const CarrosView: React.FC<CarrosViewProps> = ({ onBack }) => {
  const { role, displayName, operarioId, firebaseUser } = useAuth();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';

  const [selectedCart, setSelectedCart] = useState<string>(CART_DEFINITIONS[0]?.code ?? '');
  const cartDef = CART_DEFINITIONS.find((c) => c.code === selectedCart);

  const config = useMemo(
    () => buildOperativeConfig(role ?? 'CARRETILLERO', { currentShelfCode: selectedCart }),
    [role, selectedCart],
  );

  const engine = useOperativeShelf({
    config,
    shelfCode: selectedCart,
    operarioId: effectiveOperarioId,
    displayName,
  });

  const selectCart = (code: string) => {
    if (engine.action !== 'idle') {
      engine.cancelAction();
    }
    setSelectedCart(code);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-sky-50">
      {/* Header cuando viene de Admin */}
      {onBack && (
        <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛒</span>
              <div>
                <h1 className="text-lg font-black text-slate-900 tracking-tight">GESTIÓN DE CARROS</h1>
                <p className="text-xs text-slate-500">Operaciones en carros</p>
              </div>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-bold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all"
            >
              ← Volver
            </button>
          </div>
        </header>
      )}
      {/* Selector de carro + acciones */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
          🛒 Selecciona un carro
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CART_DEFINITIONS.map((cart) => (
            <button
              key={cart.code}
              onClick={() => selectCart(cart.code)}
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
        {/* Botones de acción (operativos) cuando está idle */}
        {engine.action === 'idle' && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 flex-wrap">
            <OperativeActionButtons engine={engine} config={config} size="compact" />
          </div>
        )}
      </div>

      {/* Área operativa bloqueada al carro seleccionado */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {selectedCart ? (
          <OperativeShelfArea engine={engine} config={config} fullscreenGrid />
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
