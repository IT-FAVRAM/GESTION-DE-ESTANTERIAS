/**
 * ShelfGrid - Visualizacion interactiva de estanteria con tarjetas expandidas.
 * Colapso individual por sección mediante chevron animado.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { ShelfLocationState } from '../../hooks/useShelf';
import {
  type Shelf,
  isTechReviewLocation,
  isUrgentLocation,
  isAluminioLocation,
} from '../../lib/firestoreSchema';
import ShelfGridCell from './ShelfGridCell';
import ShelfGridLegend from './ShelfGridLegend';
import ShelfGridStats from './ShelfGridStats';
import ShelfRackView from './ShelfRackView';

interface ShelfGridProps {
  locations: ShelfLocationState[];
  shelfDef?: Shelf;
  onCellPress?: (location: ShelfLocationState) => void;
  selectedPositions?: string[];
  highlightedPositions?: string[];
  compact?: boolean;
  showReprocessCosts?: boolean;
  fullscreenMode?: boolean;
}

const createEmptyLocation = (position: string, shelfCode?: string): ShelfLocationState => ({
  position,
  isEmpty: true,
  items: [],
  locationId: `${shelfCode || ''}_${position}`,
});

// ─── Section Header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  isUrgent: boolean;
  isTechReview: boolean;
  isAluminio?: boolean;
  occupiedCount: number;
  totalCount: number;
  totalArticles: number;
  isCollapsed: boolean;
  onToggle: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  isUrgent,
  isTechReview,
  isAluminio,
  occupiedCount,
  totalCount,
  totalArticles,
  isCollapsed,
  onToggle,
}) => {
  const pct = totalCount > 0 ? Math.round((occupiedCount / totalCount) * 100) : 0;

  let wrapCls = 'bg-white border-slate-200 shadow-sm hover:bg-sky-50/60';
  let titleCls = 'text-slate-800';
  let accentBar = 'bg-sky-500';
  let pctBarCls = 'from-sky-500 to-emerald-500';
  let chevronCls = 'text-slate-400 group-hover:text-slate-600';
  let subtitleCls = 'text-slate-500';
  let statsCls = 'text-slate-600';
  let badgeEl: React.ReactNode = null;

  if (isUrgent) {
    wrapCls = 'bg-red-50 border-red-300 shadow-sm hover:bg-red-100/60';
    titleCls = 'text-red-800';
    accentBar = 'bg-red-500';
    pctBarCls = 'from-red-500 to-red-400';
    chevronCls = 'text-red-400 group-hover:text-red-600';
    subtitleCls = 'text-red-600/80';
    statsCls = 'text-red-700';
    badgeEl = (
      <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-black bg-red-600 text-white border border-red-700 rounded-md uppercase tracking-widest">
        <span className="w-1.5 h-1.5 rounded-full bg-red-200 animate-pulse" />
        URG
      </span>
    );
  } else if (isTechReview) {
    wrapCls = 'bg-amber-50 border-amber-300 shadow-sm hover:bg-amber-100/60';
    titleCls = 'text-amber-800';
    accentBar = 'bg-amber-500';
    pctBarCls = 'from-amber-500 to-amber-400';
    chevronCls = 'text-amber-400 group-hover:text-amber-600';
    subtitleCls = 'text-amber-600/80';
    statsCls = 'text-amber-700';
    badgeEl = (
      <span className="px-2 py-0.5 text-[9px] font-black bg-amber-600 text-white border border-amber-700 rounded-md uppercase tracking-widest">
        VER. TÉC.
      </span>
    );
  } else if (isAluminio) {
    wrapCls = 'bg-sky-50 border-sky-300 shadow-sm hover:bg-sky-100/60';
    titleCls = 'text-sky-800';
    accentBar = 'bg-sky-500';
    pctBarCls = 'from-sky-500 to-cyan-400';
    chevronCls = 'text-sky-400 group-hover:text-sky-600';
    subtitleCls = 'text-sky-600/80';
    statsCls = 'text-sky-700';
    badgeEl = (
      <span className="px-2 py-0.5 text-[9px] font-black bg-sky-600 text-white border border-sky-700 rounded-md uppercase tracking-widest">
        ALU
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full rounded-xl border px-4 py-3 flex items-center gap-3 transition-all duration-200 cursor-pointer group ${wrapCls}`}
    >
      <div className={`w-0.5 h-6 rounded-full ${accentBar} opacity-70 shrink-0`} />

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-black tracking-tight font-mono ${titleCls}`}>{title}</span>
          {subtitle && (
            <span className={`text-[11px] font-mono ${subtitleCls}`}>{subtitle}</span>
          )}
          {badgeEl}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 max-w-[120px] h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${pctBarCls} rounded-full transition-all duration-700`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-[10px] font-mono tabular-nums ${statsCls}`}>
            {occupiedCount}/{totalCount} · {totalArticles} art.
          </span>
        </div>
      </div>

      <svg
        className={`w-4 h-4 shrink-0 transition-transform duration-300 ${chevronCls} ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
};

// ─── Collapsible content wrapper ──────────────────────────────────────────────

const CollapsibleContent: React.FC<{ isCollapsed: boolean; children: React.ReactNode }> = ({
  isCollapsed,
  children,
}) => (
  <div
    className="overflow-hidden transition-all duration-300 ease-in-out min-w-0 w-full"
    style={{ display: 'grid', gridTemplateRows: isCollapsed ? '0fr' : '1fr' }}
  >
    <div className="min-h-0 min-w-0">{children}</div>
  </div>
);

// ─── Block (physical layout) ──────────────────────────────────────────────────

interface BlockProps {
  block: {
    id: string;
    title: string;
    subtitle?: string;
    zoneName?: string;
    fullWidth?: boolean;
    rows: Array<Array<number | null>>;
  };
  shelfDef: Shelf;
  locationMap: Map<string, ShelfLocationState>;
  selectedPositions: string[];
  highlightedPositions: string[];
  onCellPress?: (location: ShelfLocationState) => void;
  isCollapsed: boolean;
  onToggle: () => void;
  showReprocessCosts: boolean;
}

const Block: React.FC<BlockProps> = ({
  block,
  shelfDef,
  locationMap,
  selectedPositions,
  highlightedPositions,
  onCellPress,
  isCollapsed,
  onToggle,
  showReprocessCosts,
}) => {
  const zone = shelfDef.layout.zones.find((z) => z.name === block.zoneName);
  const isUrgent = zone?.isUrgent ?? false;
  const isTechReview = zone?.isTechReview ?? false;
  const isAluminio = zone?.name === 'ALUMINIO';

  const allPos = block.rows.flat().filter((p): p is number => p !== null);
  const occupiedCount = allPos.filter((p) => {
    const loc = locationMap.get(p.toString().padStart(3, '0'));
    return loc && !loc.isEmpty;
  }).length;
  const totalArticles = allPos.reduce((sum, p) => {
    const loc = locationMap.get(p.toString().padStart(3, '0'));
    return sum + (loc?.items.length ?? 0);
  }, 0);

  return (
    <div className="flex flex-col gap-2 min-w-0 w-full">
      <SectionHeader
        title={block.title}
        subtitle={block.subtitle}
        isUrgent={isUrgent}
        isTechReview={isTechReview}
        isAluminio={isAluminio}
        occupiedCount={occupiedCount}
        totalCount={allPos.length}
        totalArticles={totalArticles}
        isCollapsed={isCollapsed}
        onToggle={onToggle}
      />
      <CollapsibleContent isCollapsed={isCollapsed}>
        <div className="pt-1 pb-2 min-w-0">
          {/* Scroll horizontal solo en este contenedor; la estantería mantiene su ancho mínimo */}
          <div className="w-full max-w-full overflow-x-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(30,41,59,0.8)_transparent]">
            <ShelfRackView
              block={block as import('../../lib/firestoreSchema').ShelfPhysicalBlock}
              shelfCode={shelfDef.code}
              locationMap={locationMap}
              selectedPositions={selectedPositions}
              highlightedPositions={highlightedPositions}
              onCellPress={onCellPress}
              showReprocessCosts={showReprocessCosts}
              createEmptyLocation={createEmptyLocation}
            />
          </div>
        </div>
      </CollapsibleContent>
    </div>
  );
};

// ─── ShelfGrid ────────────────────────────────────────────────────────────────

const ShelfGrid: React.FC<ShelfGridProps> = ({
  locations,
  shelfDef,
  onCellPress,
  selectedPositions = [],
  highlightedPositions = [],
  compact = false,
  showReprocessCosts = false,
  fullscreenMode = false,
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const locationMap = useMemo(() => {
    const map = new Map<string, ShelfLocationState>();
    locations.forEach((loc) => map.set(loc.position, loc));
    return map;
  }, [locations]);

  const totalSlots = shelfDef?.locationCount ?? locations.length;
  const occupiedSlots = locations.filter((loc) => !loc.isEmpty).length;
  const totalArticles = locations.reduce((sum, loc) => sum + (loc.items?.length ?? 0), 0);
  const pct = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;
  const physicalBlocks = shelfDef?.layout.physicalBlocks ?? [];

  // Adaptar columnas al número de bloques no-fullWidth de la sección
  // → secciones pequeñas (1 bloque) ocupan todo el ancho y se centran
  const regularBlockCount = physicalBlocks.filter((b) => !b.fullWidth).length;
  const blockGridCols =
    regularBlockCount <= 1
      ? 'grid-cols-1'
      : regularBlockCount === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';

  const colsForBlock = useCallback((rows: Array<Array<number | null>>): string => {
    const maxCols = Math.max(...rows.map((row) => row.length), 1);
    const colMap: Record<number, string> = {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      5: 'grid-cols-5',
      6: 'grid-cols-6',
      7: 'grid-cols-7',
    };
    return colMap[maxCols] || `grid-cols-${maxCols}`;
  }, []);

  // ── Compact mode ────────────────────────────────────────────────────────────
  if (compact) {
    if (physicalBlocks.length > 0) {
      return (
        <div className="space-y-4">
          {physicalBlocks.map((block) => (
            <div key={block.id}>
              <p className="text-xs font-bold font-mono text-slate-500 mb-2 uppercase tracking-wide">{block.title}</p>
              <div className="flex flex-col gap-1.5">
                {block.rows.map((row, rowIndex) => (
                  <div key={rowIndex} className={`grid gap-1.5 ${colsForBlock(block.rows)}`}>
                    {row.map((posNum, colIndex) => {
                      if (posNum === null) return <div key={colIndex} className="w-10 h-10 opacity-0" />;
                      const pos = posNum.toString().padStart(3, '0');
                      const loc = locationMap.get(pos);
                      return (
                        <ShelfGridCell
                          key={pos}
                          position={pos}
                          location={loc}
                          shelfCode={shelfDef?.code}
                          isUrgent={isUrgentLocation(shelfDef?.code || '', posNum)}
                          isTechReview={isTechReviewLocation(shelfDef?.code || '', posNum)}
                          isAluminio={isAluminioLocation(shelfDef?.code || '', posNum)}
                          isSelected={selectedPositions.includes(pos)}
                          isHighlighted={highlightedPositions.includes(pos)}
                          compact
                          showReprocessCosts={showReprocessCosts}
                          onPress={onCellPress}
                          createEmptyLocation={createEmptyLocation}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="flex overflow-x-auto gap-1.5 pb-4 [scrollbar-width:thin] [scrollbar-color:rgba(30,41,59,0.8)_transparent]">
        {locations.map((loc) => (
          <ShelfGridCell
            key={loc.position}
            position={loc.position}
            location={loc}
            shelfCode={shelfDef?.code}
            isUrgent={isUrgentLocation(shelfDef?.code || '', parseInt(loc.position, 10))}
            isTechReview={isTechReviewLocation(shelfDef?.code || '', parseInt(loc.position, 10))}
            isAluminio={isAluminioLocation(shelfDef?.code || '', parseInt(loc.position, 10))}
            isSelected={selectedPositions.includes(loc.position)}
            isHighlighted={highlightedPositions.includes(loc.position)}
            compact
            showReprocessCosts={showReprocessCosts}
            onPress={onCellPress}
            createEmptyLocation={createEmptyLocation}
          />
        ))}
      </div>
    );
  }

   // ── Full mode ───────────────────────────────────────────────────────────────
   return (
     <div className="w-full min-w-0">
       {!fullscreenMode && (
         <>
           <ShelfGridStats
             emptySlots={Math.max(totalSlots - occupiedSlots, 0)}
             occupiedSlots={occupiedSlots}
             totalSlots={totalSlots}
             occupancy={pct}
             compact={compact}
           />

           <div className="mb-5 rounded-2xl border border-slate-700/80 bg-slate-900/90 px-4 py-3 shadow-[0_14px_40px_rgba(15,23,42,0.25)]">
             <div className="flex items-center gap-3">
               <div className="flex-1 h-2 bg-slate-950/80 rounded-full overflow-hidden min-w-[80px]">
                 <div
                   className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 rounded-full transition-all duration-700"
                   style={{ width: `${pct}%` }}
                 />
               </div>
               <span className="text-[11px] font-mono text-slate-100 tabular-nums shrink-0">
                 {occupiedSlots}/{totalSlots} ocupadas · {totalArticles} artículos · {pct}%
               </span>
             </div>
             <ShelfGridLegend compact={compact} />
           </div>
         </>
       )}

       {physicalBlocks.length > 0 ? (
         <div className={`grid ${blockGridCols} pb-4 ${fullscreenMode ? 'gap-2' : 'gap-3'} w-full min-w-0`}>
           {physicalBlocks.map((block) => (
             <div key={block.id} className={`min-w-0 ${block.fullWidth ? 'col-span-full' : ''}`}>
               <Block
                 block={block}
                 shelfDef={shelfDef!}
                 locationMap={locationMap}
                 selectedPositions={selectedPositions}
                 highlightedPositions={highlightedPositions}
                 onCellPress={onCellPress}
                 isCollapsed={collapsedSections.has(block.id)}
                 onToggle={() => toggleSection(block.id)}
                 showReprocessCosts={showReprocessCosts}
               />
             </div>
           ))}
         </div>
       ) : (
         <div className={`space-y-${fullscreenMode ? 2 : 3}`}>
           {shelfDef?.layout.zones.map((zone) => {
             const positions: string[] = [];
             for (let i = zone.range[0]; i <= zone.range[1]; i++) {
               positions.push(i.toString().padStart(3, '0'));
             }
const isUrgentZone = zone.isUrgent ?? false;
              const isTechReviewZone = zone.isTechReview ?? false;
              const isAluminioZone = zone.name === 'ALUMINIO';
              const occupiedInZone = positions.filter((pos) => {
               const loc = locationMap.get(pos);
               return loc && !loc.isEmpty;
             }).length;
             const articlesInZone = positions.reduce((sum, pos) => {
               const loc = locationMap.get(pos);
               return sum + (loc?.items.length ?? 0);
             }, 0);
             const zoneId = `zone-${zone.name}`;

             return (
               <div key={zone.name} className="flex flex-col gap-2">
<SectionHeader
                    title={zone.name}
                    subtitle={`${zone.range[0].toString().padStart(3, '0')}–${zone.range[1].toString().padStart(3, '0')}`}
                    isUrgent={isUrgentZone}
                    isTechReview={isTechReviewZone}
                    isAluminio={isAluminioZone}
                    occupiedCount={occupiedInZone}
                    totalCount={positions.length}
                    totalArticles={articlesInZone}
                    isCollapsed={collapsedSections.has(zoneId)}
                    onToggle={() => toggleSection(zoneId)}
                  />
                 <CollapsibleContent isCollapsed={collapsedSections.has(zoneId)}>
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 pb-1">
                     {positions.map((pos) => {
                       const posInt = parseInt(pos, 10);
                       const loc = locationMap.get(pos);
                       return (
                         <ShelfGridCell
                           key={pos}
                           position={pos}
                           location={loc}
                           shelfCode={shelfDef?.code}
                           isUrgent={isUrgentZone || isUrgentLocation(shelfDef?.code || '', posInt)}
                           isTechReview={isTechReviewZone || isTechReviewLocation(shelfDef?.code || '', posInt)}
                           isAluminio={isAluminioLocation(shelfDef?.code || '', posInt)}
                           isSelected={selectedPositions.includes(pos)}
                           isHighlighted={highlightedPositions.includes(pos)}
                           showReprocessCosts={showReprocessCosts}
                           onPress={onCellPress}
                           createEmptyLocation={createEmptyLocation}
                         />
                       );
                     })}
                   </div>
                 </CollapsibleContent>
               </div>
             );
           })}
         </div>
       )}
     </div>
   );
};

export default ShelfGrid;
