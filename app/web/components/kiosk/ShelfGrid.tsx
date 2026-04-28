/**
 * ShelfGrid — Visualización interactiva de estantería con tarjetas expandibles
 * Gestor de Estanterías WMS v3.0
 *
 * Diseño basado en las fotos de referencia:
 * - Bloques/zonas colapsables con cabecera (nombre de zona + badge URGENTE/VT)
 * - Cada ubicación es una tarjeta expandible
 * - Botones globales CONTRAER TODO / EXPANDIR TODO
 * - Grid de columnas adaptado al physicalBlock de cada zona
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { ShelfLocationState } from '../../hooks/useShelf';
import {
  type Shelf,
  isTechReviewLocation,
  isUrgentLocation,
  isReprocesosLocation,
} from '../../lib/firestoreSchema';
import ShelfGridCell from './ShelfGridCell';

interface ShelfGridProps {
  locations: ShelfLocationState[];
  shelfDef?: Shelf;
  onCellPress?: (location: ShelfLocationState) => void;
  selectedPositions?: string[];
  highlightedPositions?: string[];
  compact?: boolean;
  showReprocessCosts?: boolean;
}

const createEmptyLocation = (position: string, _shelfCode?: string): ShelfLocationState => ({
  position,
  isEmpty: true,
  items: [],
  locationId: `${_shelfCode || ''}_${position}`,
});

// ─── Block Header ────────────────────────────────────────────────

interface BlockHeaderProps {
  title: string;
  subtitle?: string;
  isUrgent: boolean;
  isTechReview: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  occupiedCount: number;
  totalCount: number;
}

const BlockHeader: React.FC<BlockHeaderProps> = ({
  title, subtitle, isUrgent, isTechReview, collapsed, onToggle,
  onExpandAll, onCollapseAll, occupiedCount, totalCount,
}) => {
  let headerBg = 'bg-slate-800/60 border-slate-700/40';
  let titleCls = 'text-slate-200';
  let badgeEl: React.ReactNode = null;
  let icon = '📦';

  if (isUrgent) {
    headerBg = 'bg-red-500/10 border-red-400/20';
    titleCls = 'text-red-300';
    icon = '🚨';
    badgeEl = (
      <span className="px-2 py-0.5 text-[10px] font-black bg-red-500/20 text-red-300 border border-red-400/20 rounded-lg uppercase tracking-widest">
        URGENTE
      </span>
    );
  } else if (isTechReview) {
    headerBg = 'bg-amber-500/10 border-amber-400/20';
    titleCls = 'text-amber-300';
    icon = '🔬';
    badgeEl = (
      <span className="px-2 py-0.5 text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/20 rounded-lg uppercase">
        VER. TÉCNICA
      </span>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 cursor-pointer select-none ${headerBg}`} onClick={onToggle}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 shrink-0 transition-transform duration-200 text-slate-500 ${collapsed ? '-rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <span className="text-lg">{icon}</span>
        <div className="min-w-0">
          <span className={`text-sm font-black ${titleCls}`}>{title}</span>
          {subtitle && <span className="text-xs text-slate-500 ml-2">{subtitle}</span>}
        </div>
        {badgeEl}
        <span className="text-xs text-slate-500 hidden sm:block">
          {occupiedCount}/{totalCount} ocup.
        </span>
      </div>
      {!collapsed && (
        <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onCollapseAll}
            className="px-2 py-1 text-[10px] font-bold bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors uppercase tracking-wide"
          >
            Contraer
          </button>
          <button
            onClick={onExpandAll}
            className="px-2 py-1 text-[10px] font-bold bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors uppercase tracking-wide"
          >
            Expandir
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Block with expandable cells ────────────────────────────────

interface BlockProps {
  block: {
    id: string;
    title: string;
    subtitle?: string;
    zoneName?: string;
    rows: Array<Array<number | null>>;
    fullWidth?: boolean;
  };
  shelfDef: Shelf;
  locationMap: Map<string, ShelfLocationState>;
  selectedPositions: string[];
  highlightedPositions: string[];
  onCellPress?: (location: ShelfLocationState) => void;
  colsForBlock: (rows: Array<Array<number | null>>) => string;
  globalExpanded: boolean | null; // null = no override
  showReprocessCosts: boolean;
}

const Block: React.FC<BlockProps> = ({
  block, shelfDef, locationMap, selectedPositions, highlightedPositions,
  onCellPress, colsForBlock, globalExpanded, showReprocessCosts,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedCells, setExpandedCells] = useState(false);

  // Handle global override
  const prevGlobalExpanded = React.useRef<boolean | null>(null);
  React.useEffect(() => {
    if (globalExpanded !== null && globalExpanded !== prevGlobalExpanded.current) {
      prevGlobalExpanded.current = globalExpanded;
      setCollapsed(!globalExpanded);
      setExpandedCells(globalExpanded);
    }
  }, [globalExpanded]);

  const zone = shelfDef.layout.zones.find((z) => z.name === block.zoneName);
  const isUrgent = zone?.isUrgent ?? false;
  const isTechReview = zone?.isTechReview ?? false;

  // Count occupied in this block
  const allPosInBlock = block.rows.flat().filter((p): p is number => p !== null);
  const occupiedCount = allPosInBlock.filter((p) => {
    const loc = locationMap.get(p.toString().padStart(3, '0'));
    return loc && !loc.isEmpty;
  }).length;

  const gridCols = colsForBlock(block.rows);

  return (
    <div className="flex flex-col gap-2">
      <BlockHeader
        title={block.title}
        subtitle={block.subtitle}
        isUrgent={isUrgent}
        isTechReview={isTechReview}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        onExpandAll={() => setExpandedCells(true)}
        onCollapseAll={() => setExpandedCells(false)}
        occupiedCount={occupiedCount}
        totalCount={allPosInBlock.length}
      />

      {!collapsed && (
        <div className="flex flex-col gap-2">
          {block.rows.map((row, rowIdx) => (
            <div
              key={`${block.id}-r${rowIdx}`}
              className={`grid gap-2 ${gridCols}`}
            >
              {row.map((posNum, colIdx) => {
                if (posNum === null) {
                  return <div key={`${block.id}-r${rowIdx}-c${colIdx}-empty`} className="opacity-0" />;
                }
                const pos = posNum.toString().padStart(3, '0');
                const loc = locationMap.get(pos);
                const shelfCode = shelfDef.code;
                const posInt = posNum;

                return (
                  <ShelfGridCell
                    key={pos}
                    position={pos}
                    location={loc}
                    shelfCode={shelfCode}
                    isUrgent={isUrgentLocation(shelfCode, posInt)}
                    isTechReview={isTechReviewLocation(shelfCode, posInt)}
                    isSelected={selectedPositions.includes(pos)}
                    isHighlighted={highlightedPositions.includes(pos)}
                    compact={false}
                    forceExpanded={expandedCells}
                    showReprocessCosts={showReprocessCosts}
                    onPress={onCellPress}
                    createEmptyLocation={createEmptyLocation}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main ShelfGrid ──────────────────────────────────────────────

const ShelfGrid: React.FC<ShelfGridProps> = ({
  locations,
  shelfDef,
  onCellPress,
  selectedPositions = [],
  highlightedPositions = [],
  compact = false,
  showReprocessCosts = false,
}) => {
  const [globalExpanded, setGlobalExpanded] = useState<boolean | null>(null);

  const locationMap = useMemo(() => {
    const map = new Map<string, ShelfLocationState>();
    locations.forEach((loc) => map.set(loc.position, loc));
    return map;
  }, [locations]);

  const totalSlots = shelfDef?.locationCount ?? locations.length;
  const occupiedSlots = locations.filter((l) => !l.isEmpty).length;
  const totalArticles = locations.reduce((s, l) => s + (l.items?.length ?? 0), 0);
  const pct = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

  // Determine number of columns based on max row width
  const colsForBlock = useCallback((rows: Array<Array<number | null>>): string => {
    const maxCols = Math.max(...rows.map((r) => r.length), 1);
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

  // Compact mode — small squares (admin browser)
  if (compact) {
    const physicalBlocks = shelfDef?.layout.physicalBlocks ?? [];
    if (physicalBlocks.length > 0) {
      return (
        <div className="space-y-4">
          {physicalBlocks.map((block) => (
            <div key={block.id}>
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">{block.title}</p>
              <div className="flex flex-col gap-1.5">
                {block.rows.map((row, ri) => (
                  <div key={ri} className={`grid gap-1.5 ${colsForBlock(block.rows)}`}>
                    {row.map((posNum, ci) => {
                      if (posNum === null) return <div key={ci} className="w-10 h-10 opacity-0" />;
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
    // Fallback flat compact
    return (
      <div className="flex flex-wrap gap-1.5">
        {locations.map((loc) => (
          <ShelfGridCell
            key={loc.position}
            position={loc.position}
            location={loc}
            shelfCode={shelfDef?.code}
            isUrgent={isUrgentLocation(shelfDef?.code || '', parseInt(loc.position, 10))}
            isTechReview={isTechReviewLocation(shelfDef?.code || '', parseInt(loc.position, 10))}
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

  const physicalBlocks = shelfDef?.layout.physicalBlocks ?? [];

  return (
    <div className="w-full">
      {/* Stats bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden min-w-[80px]">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-slate-500">{occupiedSlots}/{totalSlots} ocupadas · {totalArticles} artículos</span>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setGlobalExpanded(false)}
            className="px-2 py-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors uppercase"
          >
            Contraer todo
          </button>
          <button
            onClick={() => setGlobalExpanded(true)}
            className="px-2 py-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors uppercase"
          >
            Expandir todo
          </button>
        </div>
      </div>

      {/* Blocks */}
      {physicalBlocks.length > 0 ? (
        <div className="space-y-4">
          {physicalBlocks.map((block) => (
            <Block
              key={block.id}
              block={block}
              shelfDef={shelfDef!}
              locationMap={locationMap}
              selectedPositions={selectedPositions}
              highlightedPositions={highlightedPositions}
              onCellPress={onCellPress}
              colsForBlock={colsForBlock}
              globalExpanded={globalExpanded}
              showReprocessCosts={showReprocessCosts}
            />
          ))}
        </div>
      ) : (
        /* Fallback: zones without physicalBlocks */
        <div className="space-y-4">
          {shelfDef?.layout.zones.map((zone) => {
            const positions: string[] = [];
            for (let i = zone.range[0]; i <= zone.range[1]; i++) {
              positions.push(i.toString().padStart(3, '0'));
            }
            const isUrgentZone = zone.isUrgent ?? false;
            const isTechReviewZone = zone.isTechReview ?? false;
            const occupiedInZone = positions.filter((p) => {
              const l = locationMap.get(p);
              return l && !l.isEmpty;
            }).length;

            return (
              <div key={zone.name} className="flex flex-col gap-2">
                <BlockHeader
                  title={zone.name}
                  subtitle={`${zone.range[0].toString().padStart(3,'0')}–${zone.range[1].toString().padStart(3,'0')}`}
                  isUrgent={isUrgentZone}
                  isTechReview={isTechReviewZone}
                  collapsed={false}
                  onToggle={() => {}}
                  onExpandAll={() => {}}
                  onCollapseAll={() => {}}
                  occupiedCount={occupiedInZone}
                  totalCount={positions.length}
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                        isSelected={selectedPositions.includes(pos)}
                        isHighlighted={highlightedPositions.includes(pos)}
                        forceExpanded={globalExpanded === true}
                        showReprocessCosts={showReprocessCosts}
                        onPress={onCellPress}
                        createEmptyLocation={createEmptyLocation}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShelfGrid;
