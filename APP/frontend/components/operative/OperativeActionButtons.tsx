/**
 * OperativeActionButtons — Botonera de acciones del motor operativo.
 *
 * Se coloca en el header de cada rol. Muestra solo las acciones permitidas por
 * la config y delega en `engine.startAction`. Garantiza que todos los roles
 * disparan EXACTAMENTE el mismo flujo.
 */

import React from 'react';
import { Package, PackageMinus, ArrowLeftRight, Shuffle, Warehouse, Bell } from 'lucide-react';
import type { RoleOperativeConfig } from '../../lib/operative/operativeConfig';
import type { UseOperativeShelfReturn } from '../../hooks/useOperativeShelf';

interface OperativeActionButtonsProps {
  engine: UseOperativeShelfReturn;
  config: RoleOperativeConfig;
  /**
   * 'compact' para headers de escritorio, 'large' para landings,
   * 'bar' para la barra de acciones táctil inferior (móvil/tablet, ≥48px).
   */
  size?: 'compact' | 'large' | 'bar';
}

const BTN = {
  ubicar: { label: 'UBICAR', Icon: Package, cls: 'bg-emerald-600' },
  retirar: { label: 'RETIRAR', Icon: PackageMinus, cls: 'bg-red-600' },
  mover: { label: 'MOVER', Icon: ArrowLeftRight, cls: 'bg-blue-600' },
  reubicar: { label: 'REUBICAR', Icon: Shuffle, cls: 'bg-indigo-600' },
  almacen: { label: 'ALMACÉN', Icon: Warehouse, cls: 'bg-purple-600' },
  avisar: { label: 'AVISAR', Icon: Bell, cls: 'bg-amber-600' },
} as const;

const OperativeActionButtons: React.FC<OperativeActionButtonsProps> = ({ engine, config, size = 'compact' }) => {
  if (engine.action !== 'idle') return null;

  const base =
    size === 'compact'
      ? 'px-2 py-1 rounded-lg text-white text-[11px] font-bold active:scale-95 transition-all touch-manipulation whitespace-nowrap inline-flex items-center justify-center gap-1.5'
      : size === 'bar'
        // Barra táctil inferior: columnas equitativas, altura ≥48px.
        ? 'min-h-12 px-3 rounded-xl text-white text-[13px] font-black active:scale-95 transition-all touch-manipulation whitespace-nowrap shadow-md flex items-center justify-center gap-1.5'
        : 'px-4 py-3 rounded-2xl text-white text-base font-black active:scale-95 transition-all touch-manipulation whitespace-nowrap shadow-lg inline-flex items-center justify-center gap-2';

  // Tamaño de icono Lucide acorde al tamaño del botón.
  const iconCls = size === 'compact' ? 'w-3.5 h-3.5' : size === 'bar' ? 'w-4 h-4' : 'w-5 h-5';

  const container =
    size === 'bar'
      ? 'grid grid-cols-[repeat(auto-fit,minmax(5rem,1fr))] gap-2 w-full'
      : 'flex items-center gap-1 flex-wrap justify-center';

  const a = config.actions;

  return (
    <div className={container}>
      {a.ubicar && (
        <button onClick={() => engine.startAction('ubicar')} title="Ubicar (atajo: U)" className={`${base} ${BTN.ubicar.cls}`}>
          <BTN.ubicar.Icon className={iconCls} aria-hidden /> {BTN.ubicar.label}
        </button>
      )}
      {a.retirar && (
        <button onClick={() => engine.startAction('retirar')} title="Retirar (atajo: R)" className={`${base} ${BTN.retirar.cls}`}>
          <BTN.retirar.Icon className={iconCls} aria-hidden /> {BTN.retirar.label}
        </button>
      )}
      {a.mover && (
        <button onClick={() => engine.startAction('mover')} title="Mover (atajo: M)" className={`${base} ${BTN.mover.cls}`}>
          <BTN.mover.Icon className={iconCls} aria-hidden /> {BTN.mover.label}
        </button>
      )}
      {a.reubicar && (
        <button onClick={() => engine.startAction('reubicar')} className={`${base} ${BTN.reubicar.cls}`}>
          <BTN.reubicar.Icon className={iconCls} aria-hidden /> {BTN.reubicar.label}
        </button>
      )}
      {a.almacen !== 'none' && (
        <button onClick={() => engine.startAction('almacen')} className={`${base} ${BTN.almacen.cls}`}>
          <BTN.almacen.Icon className={iconCls} aria-hidden /> {BTN.almacen.label}
        </button>
      )}
      {a.avisar !== 'none' && (
        <button onClick={() => engine.startAction('avisar')} className={`${base} ${BTN.avisar.cls}`}>
          <BTN.avisar.Icon className={iconCls} aria-hidden /> {BTN.avisar.label}
        </button>
      )}
    </div>
  );
};

export default OperativeActionButtons;
