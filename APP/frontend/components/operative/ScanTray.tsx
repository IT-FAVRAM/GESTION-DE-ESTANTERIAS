/**
 * ScanTray — Bandeja de escaneo (scan-first).
 *
 * En reposo (idle), el carretillero/superadmin escanea varios artículos seguidos
 * con la pistola SIN pulsar nada; se acumulan aquí. Después pulsa la acción:
 *  - UBICAR: SIEMPRE disponible, para TODA la bandeja (los ya ubicados se ubican
 *    como parcial, con el aviso existente).
 *  - RETIRAR: acción ADICIONAL, solo para el subconjunto ya ubicado.
 *
 * El badge por línea (ubicado / sin ubicar) informa pero no obliga. Se resuelve
 * en segundo plano con findArticleGlobal y se actualiza en tiempo real.
 *
 * Ref: PLAN_ESCANEO_ATAJOS.md §3.
 */

import React from 'react';
import type { ScanTrayItem } from '../../hooks/useOperativeShelf';

interface ScanTrayProps {
  items: ScanTrayItem[];
  onUbicar: () => void;
  onRetirar: () => void;
  onClear: () => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

const displayPos = (p: string) => { const n = parseInt(p, 10); return Number.isNaN(n) ? p : String(n); };

const ScanTray: React.FC<ScanTrayProps> = ({ items, onUbicar, onRetirar, onClear, onRemove, disabled = false }) => {
  if (items.length === 0) return null;

  const locatedCount = items.filter((it) => it.located === true).length;

  return (
    <div className="flex-shrink-0 mx-2 sm:mx-4 mt-2 bg-white border-2 border-cyan-400 rounded-2xl shadow-sm overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-cyan-50 border-b border-cyan-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-slate-900">📥 Bandeja</span>
          <span className="bg-cyan-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">{items.length}</span>
        </div>
        <button
          onClick={onClear}
          disabled={disabled}
          className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold active:scale-95 transition-all touch-manipulation disabled:opacity-50"
        >
          Vaciar
        </button>
      </div>

      {/* Lista de artículos */}
      <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
        {items.map((it, i) => (
          <div key={`${it.articleCode}-${it.orderFab}-${i}`} className="flex items-center justify-between gap-2 px-4 py-2">
            <div className="min-w-0">
              <p className="text-sm font-bold font-mono text-slate-900 truncate">{it.articleCode}</p>
              <p className="text-[11px] font-mono text-slate-500 truncate">{it.orderFab}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Badge de estado */}
              {it.located === undefined ? (
                <span className="text-[10px] font-bold text-slate-400 animate-pulse">comprobando…</span>
              ) : it.located ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 max-w-[150px] truncate">
                  ✅ {it.locations && it.locations.length > 0
                    ? `${it.locations[0].shelfName} p.${displayPos(it.locations[0].position)}${it.locations.length > 1 ? ` +${it.locations.length - 1}` : ''}`
                    : 'ubicado'}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                  ⬜ sin ubicar
                </span>
              )}
              <button
                onClick={() => onRemove(i)}
                disabled={disabled}
                className="text-rose-400 hover:text-rose-600 text-lg leading-none disabled:opacity-50"
                aria-label="Quitar de la bandeja"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50">
        <button
          onClick={onUbicar}
          disabled={disabled}
          className="flex-[2] min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold active:scale-95 transition-all touch-manipulation disabled:opacity-50"
        >
          📦 UBICAR los {items.length}
        </button>
        {locatedCount > 0 && (
          <button
            onClick={onRetirar}
            disabled={disabled}
            className="flex-1 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold active:scale-95 transition-all touch-manipulation disabled:opacity-50"
          >
            📤 RETIRAR ({locatedCount})
          </button>
        )}
      </div>
      <p className="px-4 pb-2 text-[10px] text-slate-400 leading-tight">
        Los ya ubicados se ubican como parcial (con aviso). RETIRAR actúa solo sobre los ubicados.
      </p>
    </div>
  );
};

export default ScanTray;
