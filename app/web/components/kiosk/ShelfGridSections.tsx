import React from 'react';

type Tone = 'default' | 'urgent' | 'review' | 'special';

type PhysicalBlock = {
  id: string;
  title: string;
  subtitle?: string;
  rows: Array<Array<number | null>>;
  tone: Tone;
};

type Zone = {
  name: string;
  positions: string[];
  tone: Tone;
  rangeLabel?: string;
};

interface ShelfGridSectionsProps {
  physicalBlocks: PhysicalBlock[];
  zones: Zone[];
  compact: boolean;
  cellSize: string;
  getBlockClasses: (tone: Tone, compact: boolean) => string;
  getBadgeClasses: (tone: Tone) => string;
  getBlockAccent: (tone: Tone) => string;
  renderCell: (position: string, extraClasses?: string) => React.ReactNode;
}

const ShelfGridSections: React.FC<ShelfGridSectionsProps> = ({ physicalBlocks, zones, compact, cellSize, getBlockClasses, getBadgeClasses, getBlockAccent, renderCell }) => {
  if (physicalBlocks.length > 0) {
    return (
      <div className="flex min-w-fit flex-col gap-5">
        {physicalBlocks.map((block) => (
          <section key={block.id} className={`w-fit max-w-full rounded-[1.75rem] border p-4 md:p-5 ${getBlockClasses(block.tone, compact)}`}>
            <div className="mb-4 flex flex-wrap items-center gap-2 md:gap-3">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${getBadgeClasses(block.tone)}`}>{block.tone === 'urgent' && <span>!</span>}{block.tone === 'review' && <span>Q</span>}{block.title}</span>
              {block.subtitle && <span className={`text-xs font-bold ${getBlockAccent(block.tone)}`}>{block.subtitle}</span>}
            </div>
            <div className="flex w-fit max-w-full flex-col gap-2.5">
              {block.rows.map((row, rowIndex) => (
                <div key={`${block.id}-${rowIndex}`} className="flex w-fit max-w-full flex-wrap gap-2 md:gap-2.5">
                  {row.map((position, cellIndex) => (position === null ? <div key={`${block.id}-${rowIndex}-${cellIndex}`} className={`${cellSize} opacity-0`} /> : renderCell(position.toString().padStart(3, '0'))))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-w-fit p-1 md:p-2">
      {zones.map((zone) => (
        <section key={zone.name} className={`w-fit max-w-full rounded-[1.75rem] border p-3 md:p-4 ${getBlockClasses(zone.tone, compact)}`}>
          {zones.length > 1 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 md:gap-3">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${getBadgeClasses(zone.tone)}`}>{zone.name}</span>
              <span className={`text-xs font-bold ${getBlockAccent(zone.tone)}`}>{zone.rangeLabel}</span>
            </div>
          )}
          <div className="flex w-fit max-w-full flex-wrap gap-2 md:gap-2.5">{zone.positions.map((position) => renderCell(position))}</div>
        </section>
      ))}
    </div>
  );
};

export default ShelfGridSections;
