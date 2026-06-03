/**
 * OperativeActionButtons — Botonera de acciones del motor operativo.
 *
 * Se coloca en el header de cada rol. Muestra solo las acciones permitidas por
 * la config y delega en `engine.startAction`. Garantiza que todos los roles
 * disparan EXACTAMENTE el mismo flujo.
 */

import React from 'react';
import type { RoleOperativeConfig } from '../../lib/operative/operativeConfig';
import type { UseOperativeShelfReturn } from '../../hooks/useOperativeShelf';

interface OperativeActionButtonsProps {
  engine: UseOperativeShelfReturn;
  config: RoleOperativeConfig;
  /** 'compact' para headers móviles, 'large' para landings de escritorio. */
  size?: 'compact' | 'large';
}

const BTN = {
  ubicar: { label: '📦 UBICAR', cls: 'bg-emerald-600' },
  retirar: { label: '📤 RETIRAR', cls: 'bg-red-600' },
  mover: { label: '🔄 MOVER', cls: 'bg-blue-600' },
  reubicar: { label: '🔀 REUBICAR', cls: 'bg-indigo-600' },
  almacen: { label: '🏭 ALMACÉN', cls: 'bg-purple-600' },
  avisar: { label: '🔔 AVISAR', cls: 'bg-amber-600' },
} as const;

const OperativeActionButtons: React.FC<OperativeActionButtonsProps> = ({ engine, config, size = 'compact' }) => {
  if (engine.action !== 'idle') return null;

  const base = size === 'compact'
    ? 'px-2 py-1 rounded-lg text-white text-[11px] font-bold active:scale-95 transition-all touch-manipulation whitespace-nowrap'
    : 'px-4 py-3 rounded-2xl text-white text-base font-black active:scale-95 transition-all touch-manipulation whitespace-nowrap shadow-lg';

  const a = config.actions;

  return (
    <div className="flex items-center gap-1 flex-wrap justify-center">
      {a.ubicar && (
        <button onClick={() => engine.startAction('ubicar')} className={`${base} ${BTN.ubicar.cls}`}>{BTN.ubicar.label}</button>
      )}
      {a.retirar && (
        <button onClick={() => engine.startAction('retirar')} className={`${base} ${BTN.retirar.cls}`}>{BTN.retirar.label}</button>
      )}
      {a.mover && (
        <button onClick={() => engine.startAction('mover')} className={`${base} ${BTN.mover.cls}`}>{BTN.mover.label}</button>
      )}
      {a.reubicar && (
        <button onClick={() => engine.startAction('reubicar')} className={`${base} ${BTN.reubicar.cls}`}>{BTN.reubicar.label}</button>
      )}
      {a.almacen !== 'none' && (
        <button onClick={() => engine.startAction('almacen')} className={`${base} ${BTN.almacen.cls}`}>{BTN.almacen.label}</button>
      )}
      {a.avisar !== 'none' && (
        <button onClick={() => engine.startAction('avisar')} className={`${base} ${BTN.avisar.cls}`}>{BTN.avisar.label}</button>
      )}
    </div>
  );
};

export default OperativeActionButtons;
