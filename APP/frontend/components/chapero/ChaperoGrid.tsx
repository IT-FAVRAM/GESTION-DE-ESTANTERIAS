import React from 'react';
import { Plus } from 'lucide-react';
import type { ChaperoPositionDoc } from '../../lib/schema/chapero';
import { CHAPERO_COLS, CHAPERO_LEVELS, getMaterialStyle } from '../../lib/schema/chapero';

interface ChaperoGridProps {
  positions: ChaperoPositionDoc[];
  highlightedIds?: Set<string>;
  originId?: string | null;
  onCellClick: (pos: ChaperoPositionDoc) => void;
  mode: 'idle' | 'ubicar' | 'retirar' | 'mover';
}

// Columna de etiquetas de nivel (N1…N5) + las 16 columnas repartiendo el ancho.
// En pantallas estrechas el contenedor impone un ancho mínimo y se desplaza en
// horizontal: 16 columnas en un móvil no se leen.
const GRID_TEMPLATE_COLUMNS = `1.75rem repeat(${CHAPERO_COLS}, minmax(0, 1fr))`;
const GRID_TEMPLATE_ROWS = `auto repeat(${CHAPERO_LEVELS}, minmax(2.75rem, 1fr))`;

// Misma estructura azul que las estanterías (ShelfRackView, paleta blue).
const RACK_FRAME = 'linear-gradient(180deg, #1A5096 0%, #0E2D5A 100%)';

const COLUMNS = Array.from({ length: CHAPERO_COLS }, (_, i) => i + 1);
const LEVELS = Array.from({ length: CHAPERO_LEVELS }, (_, i) => i + 1);

const ChaperoGrid: React.FC<ChaperoGridProps> = ({ positions, highlightedIds, originId, onCellClick, mode }) => {
  const byId = new Map(positions.map((p) => [p.positionId, p]));

  const getPos = (side: 'L' | 'R', col: number, level: number): ChaperoPositionDoc => {
    const id = `${side}${String(col).padStart(2, '0')}-${level}`;
    return byId.get(id) ?? { positionId: id, side, column: col, level, items: [], isEmpty: true };
  };

  const searching = !!highlightedIds;
  // Qué celdas admiten el toque en el modo actual (el resto se atenúa).
  // UBICAR y el destino de MOVER aceptan cualquier celda: el backend apila chapas.
  const emptyIsTarget = mode === 'ubicar' || (mode === 'mover' && !!originId);
  const onlyOccupied = mode === 'retirar' || (mode === 'mover' && !originId);

  const renderCell = (pos: ChaperoPositionDoc) => {
    const { positionId: id } = pos;
    const isEmpty = pos.isEmpty || pos.items.length === 0;
    const isOrigin = originId === id;
    const isHighlighted = !!highlightedIds?.has(id);
    const item = pos.items[0];
    const count = pos.items.length;
    const style = !isEmpty && item ? getMaterialStyle(item.material) : null;

    const dimmed = !isOrigin && ((onlyOccupied && isEmpty) || (searching && !isHighlighted));

    let cls =
      'relative w-full h-full min-w-0 rounded-md border flex flex-col items-center justify-center leading-none select-none overflow-hidden transition-[opacity,box-shadow,transform] duration-150 ';

    if (isOrigin) {
      cls += 'bg-blue-600 border-blue-300 ring-2 ring-white shadow-lg ';
    } else if (isEmpty) {
      cls += emptyIsTarget
        ? 'bg-white border-dashed border-emerald-400 text-emerald-500 hover:bg-emerald-50 cursor-pointer active:scale-95 '
        : 'bg-slate-100/90 border-slate-300/60 ';
    } else {
      cls += `${style!.cell} shadow-sm cursor-pointer active:scale-95 `;
      if (isHighlighted) cls += 'ring-[3px] ring-amber-400 ';
      else if (mode === 'retirar') cls += 'hover:ring-2 hover:ring-red-400 ';
      else if (mode === 'mover' && !originId) cls += 'hover:ring-2 hover:ring-blue-400 ';
    }
    if (dimmed) cls += 'opacity-30 ';
    if (mode === 'idle' && !isOrigin) cls += 'cursor-default ';

    const title = isEmpty
      ? `${id} · libre`
      : pos.items.map((it) => `${it.material}${it.spec ? ` ${it.spec}` : ''} ${it.espesor} mm`).join('\n') + `\n${id}`;

    return (
      <button
        key={id}
        type="button"
        title={title}
        aria-label={title}
        className={cls}
        onClick={() => onCellClick(pos)}
      >
        {isOrigin ? (
          <span className="text-white font-black text-[10px] sm:text-[11px] tracking-wide">ORIGEN</span>
        ) : isEmpty ? (
          emptyIsTarget ? <Plus className="w-4 h-4 opacity-70" aria-hidden /> : null
        ) : (
          <>
            {/* Franja de color del material: se distingue de un vistazo aunque el texto no quepa */}
            <span className={`absolute inset-x-0 top-0 h-1 ${style!.dot}`} aria-hidden />
            <span className={`font-black ${style!.text} text-sm sm:text-base lg:text-lg tabular-nums leading-none mt-0.5`}>
              {item?.espesor}
              <span className="text-[9px] sm:text-[10px] font-bold ml-px">mm</span>
            </span>
            <span className="flex items-center gap-0.5 max-w-full px-0.5 mt-0.5">
              <span className={`font-bold ${style!.text} opacity-80 text-[9px] sm:text-[10px] uppercase truncate`}>
                {item?.material}
                {item?.spec ? ` ${item.spec}` : ''}
              </span>
              {count > 1 && (
                <span className={`shrink-0 ${style!.dot} text-white rounded px-1 text-[9px] font-black leading-[1.35]`}>
                  ×{count}
                </span>
              )}
            </span>
          </>
        )}
      </button>
    );
  };

  const renderSide = (side: 'L' | 'R', label: string) => {
    const sidePositions = positions.filter((p) => p.side === side);
    const occupied = sidePositions.filter((p) => !p.isEmpty && p.items.length > 0).length;
    return (
      <section className="flex-1 flex flex-col px-2 sm:px-3 pt-1.5 pb-2">
        <div className="flex items-baseline gap-2 pb-1">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">{label}</span>
          <span className="text-[11px] font-bold text-slate-400 tabular-nums">
            {occupied}/{sidePositions.length || CHAPERO_COLS * CHAPERO_LEVELS} ocupadas
          </span>
        </div>

        <div
          className="flex-1 grid gap-x-[3px] gap-y-[5px] rounded-lg p-[5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_8px_rgba(14,45,90,0.25)]"
          style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS, gridTemplateRows: GRID_TEMPLATE_ROWS, background: RACK_FRAME }}
        >
          <span aria-hidden />
          {COLUMNS.map((col) => (
            <span
              key={col}
              className="text-[10px] sm:text-[11px] font-black text-blue-100 text-center tabular-nums leading-none py-0.5"
            >
              {side}{String(col).padStart(2, '0')}
            </span>
          ))}

          {LEVELS.map((level) => (
            <React.Fragment key={level}>
              <span className="sticky left-0 z-10 grid place-items-center rounded bg-[#123f78] sm:bg-transparent text-[10px] sm:text-[11px] font-black text-blue-100 tabular-nums">
                N{level}
              </span>
              {COLUMNS.map((col) => renderCell(getPos(side, col, level)))}
            </React.Fragment>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="flex min-h-full w-full items-stretch">
      {/* Contenido del chapero (lados + pasillo). En móvil, ancho mínimo + scroll horizontal. */}
      <div className="flex-1 min-w-0 overflow-x-auto [scrollbar-width:thin]">
        <div className="flex flex-col min-h-full min-w-[880px] sm:min-w-0">
          {renderSide('L', 'Lado L')}

          {/* Pasillo — con la línea amarilla del suelo */}
          <div className="relative flex-shrink-0 flex items-center justify-center h-6 bg-slate-300/80 border-y border-slate-400/40">
            <div
              className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 opacity-70"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg, #f59e0b 0 14px, transparent 14px 24px)' }}
              aria-hidden
            />
            <span className="relative px-3 bg-slate-300 rounded text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
              Pasillo
            </span>
          </div>

          {renderSide('R', 'Lado R')}
        </div>
      </div>

      {/* Banda de orientación — el extremo derecho del chapero da a la calle. */}
      <div className="flex-shrink-0 w-7 sm:w-9 bg-gradient-to-b from-slate-700 to-slate-900 border-l-2 border-amber-400 flex items-center justify-center shadow-[-4px_0_12px_rgba(0,0,0,0.18)]">
        <span
          className="text-amber-300 font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs whitespace-nowrap"
          style={{ writingMode: 'vertical-rl' }}
        >
          Puerta calle
        </span>
      </div>
    </div>
  );
};

export default ChaperoGrid;
