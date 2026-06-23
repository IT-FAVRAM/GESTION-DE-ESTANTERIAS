import React from 'react';
import type { ChaperoPositionDoc } from '../../lib/schema/chapero';
import { CHAPERO_COLS, CHAPERO_LEVELS, getMaterialStyle } from '../../lib/schema/chapero';

interface ChaperoGridProps {
  positions: ChaperoPositionDoc[];
  highlightedIds?: Set<string>;
  originId?: string | null;
  onCellClick: (pos: ChaperoPositionDoc) => void;
  mode: 'idle' | 'ubicar' | 'retirar' | 'mover';
}

// Las 16 columnas se reparten el ancho disponible (sin scroll horizontal): cada
// columna ocupa 1/16 del contenedor. Así el chapero entero «cabe» en pantalla.
const COLS_TEMPLATE = `repeat(${CHAPERO_COLS}, minmax(0, 1fr))`;

const ChaperoGrid: React.FC<ChaperoGridProps> = ({ positions, highlightedIds, originId, onCellClick, mode }) => {
  const byId = new Map(positions.map((p) => [p.positionId, p]));

  const getPos = (side: 'L' | 'R', col: number, level: number): ChaperoPositionDoc => {
    const id = `${side}${String(col).padStart(2, '0')}-${level}`;
    return byId.get(id) ?? { positionId: id, side, column: col, level, items: [], isEmpty: true };
  };

  const renderCell = (pos: ChaperoPositionDoc) => {
    const { positionId: id } = pos;
    const isHighlighted = highlightedIds?.has(id);
    const isOrigin = originId === id;
    const isEmpty = pos.isEmpty || pos.items.length === 0;
    const item = pos.items[0];
    const multiCount = pos.items.length;

    const style = !isEmpty && item ? getMaterialStyle(item.material) : null;

    let cellClass =
      'w-full h-14 sm:h-16 rounded-lg border-2 leading-tight flex flex-col items-center justify-center cursor-pointer transition-all select-none px-0.5 overflow-hidden ';

    if (isOrigin) {
      cellClass += 'bg-blue-500 border-blue-600 shadow-lg ring-2 ring-blue-300 ';
    } else if (isHighlighted) {
      cellClass += 'bg-amber-200 border-amber-500 shadow-md ring-2 ring-amber-400 ';
    } else if (isEmpty) {
      if (mode === 'ubicar' || (mode === 'mover' && originId)) {
        cellClass += 'bg-white border-dashed border-slate-300 hover:bg-emerald-50 hover:border-emerald-400 ';
      } else {
        cellClass += 'bg-white border-slate-200 ';
      }
    } else {
      // Color por material; resalta interactividad en modos de acción
      cellClass += `${style!.cell} shadow-sm `;
      if (mode === 'retirar') cellClass += 'hover:ring-2 hover:ring-red-300 ';
      else if (mode === 'mover' && !originId) cellClass += 'hover:ring-2 hover:ring-blue-300 ';
    }

    return (
      <div key={id} className={cellClass} onClick={() => onCellClick(pos)}>
        {isOrigin ? (
          <span className="text-white font-black text-[11px] sm:text-xs">ORIGEN</span>
        ) : isEmpty ? (
          <span className="text-slate-300 font-bold text-[10px] sm:text-[11px]">{id}</span>
        ) : (
          <>
            <span className={`font-bold ${style!.text} text-[10px] sm:text-[11px] truncate w-full text-center leading-none`}>
              {item?.material}
            </span>
            <span className={`font-black ${style!.text} text-base sm:text-lg leading-none mt-0.5`}>
              {item?.espesor}<span className="text-[9px] font-bold align-top">mm</span>
            </span>
            {item?.spec && (
              <span className={`${style!.text} opacity-70 text-[9px] truncate w-full text-center leading-none mt-0.5`}>{item.spec}</span>
            )}
            {multiCount > 1 && (
              <span className={`text-[9px] ${style!.dot} text-white rounded px-1 font-bold leading-tight mt-0.5`}>+{multiCount - 1}</span>
            )}
          </>
        )}
      </div>
    );
  };

  const renderSide = (side: 'L' | 'R') => (
    <div className="grid gap-1 sm:gap-1.5 px-2 py-2 w-full" style={{ gridTemplateColumns: COLS_TEMPLATE }}>
      {Array.from({ length: CHAPERO_COLS }, (_, i) => i + 1).map((col) => (
        <div key={col} className="flex flex-col gap-1 items-stretch min-w-0">
          <span className="text-[10px] sm:text-[11px] font-black text-slate-400 leading-none text-center tabular-nums">
            {side}{String(col).padStart(2, '0')}
          </span>
          {Array.from({ length: CHAPERO_LEVELS }, (_, i) => i + 1).map((level) =>
            renderCell(getPos(side, col, level)),
          )}
        </div>
      ))}
    </div>
  );

  const sideLabel = (label: string) => (
    <div className="px-3 pt-2 pb-0.5 flex items-center gap-2">
      <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );

  return (
    <div className="flex w-full items-stretch">
      {/* Contenido del chapero (lados + pasillo) */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Lado L — arriba */}
        <div className="bg-slate-50 border-b border-slate-200">
          {sideLabel('Lado L')}
          {renderSide('L')}
        </div>

        {/* Pasillo */}
        <div className="flex items-center justify-center bg-slate-300 py-1.5 gap-3">
          <div className="h-px flex-1 bg-slate-400/40" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">Pasillo</span>
          <div className="h-px flex-1 bg-slate-400/40" />
        </div>

        {/* Lado R — abajo */}
        <div className="bg-slate-50">
          {sideLabel('Lado R')}
          {renderSide('R')}
        </div>
      </div>

      {/* Banda de orientación — el extremo derecho del chapero da a la calle. */}
      <div className="flex-shrink-0 w-8 sm:w-10 bg-gradient-to-b from-slate-700 to-slate-900 border-l-2 border-amber-400 flex items-center justify-center shadow-[-4px_0_12px_rgba(0,0,0,0.18)]">
        <span
          className="text-amber-300 font-black uppercase tracking-[0.3em] text-[11px] sm:text-xs whitespace-nowrap"
          style={{ writingMode: 'vertical-rl' }}
        >
          Puerta calle
        </span>
      </div>
    </div>
  );
};

export default ChaperoGrid;
