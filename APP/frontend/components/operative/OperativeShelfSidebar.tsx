/**
 * OperativeShelfSidebar — Navegación lateral de estanterías para escritorio.
 *
 * Solo se monta en `desktop` y cuando el rol puede navegar a >1 estantería
 * (ámbito total o varias accesibles). Convierte la vista en un layout de 2
 * paneles (navegación a la izquierda + grid a la derecha), reduciendo clics
 * para JEFE/ADMIN/carretillero. No se renderiza en kioskos/tablets.
 */

import React from 'react';
import { getShelfDisplayName } from '../../lib/shelfDisplayNames';

export interface SidebarShelf {
  code: string;
  name: string;
}

interface OperativeShelfSidebarProps {
  shelves: SidebarShelf[];
  currentCode: string;
  onSelect: (code: string) => void;
}

const OperativeShelfSidebar: React.FC<OperativeShelfSidebarProps> = ({ shelves, currentCode, onSelect }) => {
  return (
    <nav
      aria-label="Estanterías"
      className="flex-shrink-0 w-56 h-full overflow-y-auto border-r border-slate-200 bg-white px-2 py-3 [scrollbar-width:thin]"
    >
      <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">Estanterías</p>
      <ul className="space-y-1">
        {shelves.map((s) => {
          const active = s.code === currentCode;
          return (
            <li key={s.code}>
              <button
                onClick={() => { if (!active) onSelect(s.code); }}
                aria-current={active ? 'true' : undefined}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-colors truncate ${
                  active
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title={s.name}
              >
                {getShelfDisplayName(s.code)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default OperativeShelfSidebar;
