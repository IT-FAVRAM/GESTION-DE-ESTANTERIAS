import React from 'react';
import type { ChaperoPositionDoc } from '../../lib/schema/chapero';
import { CHAPERO_COLS, CHAPERO_LEVELS } from '../../lib/schema/chapero';

interface ChaperoGridProps {
  positions: ChaperoPositionDoc[];
  highlightedIds?: Set<string>;
  originId?: string | null;
  onCellClick: (pos: ChaperoPositionDoc) => void;
  mode: 'idle' | 'ubicar' | 'retirar' | 'mover';
}

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

    let cellClass =
      'w-full h-[44px] rounded-xl border-2 text-[8px] leading-tight flex flex-col items-center justify-center cursor-pointer transition-all select-none overflow-hidden px-0.5 ';

    if (isOrigin) {
      cellClass += 'bg-blue-500 border-blue-600 shadow-lg ring-2 ring-blue-300 scale-105 ';
    } else if (isHighlighted) {
      cellClass += 'bg-amber-200 border-amber-400 shadow-md scale-105 ';
    } else if (isEmpty) {
      if (mode === 'ubicar' || (mode === 'mover' && originId)) {
        cellClass += 'bg-white border-dashed border-slate-300 hover:bg-emerald-50 hover:border-emerald-400 ';
      } else {
        cellClass += 'bg-white border-slate-200 ';
      }
    } else {
      if (mode === 'retirar' || (mode === 'mover' && !originId)) {
        cellClass += 'bg-emerald-50 border-emerald-400 hover:bg-emerald-200 shadow-sm ';
      } else {
        cellClass += 'bg-emerald-50 border-emerald-400 hover:bg-emerald-100 shadow-sm ';
      }
    }

    return (
      <div key={id} className={cellClass} onClick={() => onCellClick(pos)}>
        {isOrigin ? (
          <span className="text-white font-black text-[9px]">ORIGEN</span>
        ) : isEmpty ? (
          <span className="text-slate-300 font-bold text-[8px]">{id}</span>
        ) : (
          <>
            <span className="font-black text-emerald-800 text-[8px] truncate w-full text-center leading-none">
              {item?.material}
            </span>
            {item?.spec && (
              <span className="text-emerald-600 text-[7px] truncate w-full text-center leading-none">{item.spec}</span>
            )}
            <span className="text-emerald-700 text-[8px] font-semibold leading-none">{item?.espesor}mm</span>
            {multiCount > 1 && (
              <span className="text-[7px] bg-emerald-600 text-white rounded px-0.5 leading-tight">+{multiCount - 1}</span>
            )}
          </>
        )}
      </div>
    );
  };

  const renderSide = (side: 'L' | 'R') => (
    <div className="w-full overflow-x-auto [scrollbar-width:thin]">
      <div className="flex gap-1.5 px-2 py-2 min-w-max w-full">
        {Array.from({ length: CHAPERO_COLS }, (_, i) => i + 1).map((col) => (
          <div key={col} className="flex-1 min-w-[48px] flex flex-col gap-1 items-stretch">
            <span className="text-[9px] font-black text-slate-400 leading-none text-center">
              {side}{String(col).padStart(2, '0')}
            </span>
            {Array.from({ length: CHAPERO_LEVELS }, (_, i) => i + 1).map((level) =>
              renderCell(getPos(side, col, level)),
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col w-full">
      {/* Lado L — arriba */}
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="px-3 pt-2 pb-0.5 flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lado L</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        {renderSide('L')}
      </div>

      {/* Pasillo */}
      <div className="flex items-center justify-center bg-slate-300 py-2 gap-3">
        <div className="h-px flex-1 bg-slate-400/40" />
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">— PASILLO —</span>
        <div className="h-px flex-1 bg-slate-400/40" />
      </div>

      {/* Lado R — abajo */}
      <div className="bg-slate-50">
        <div className="px-3 pt-2 pb-0.5 flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lado R</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        {renderSide('R')}
      </div>
    </div>
  );
};

export default ChaperoGrid;
