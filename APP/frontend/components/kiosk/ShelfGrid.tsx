/**
 * ShelfGrid - Visualizacion interactiva de estanteria con tarjetas expandidas.
 * Colapso individual por sección mediante chevron animado.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { ShelfLocationState } from '../../hooks/useShelf';
import {
  type Shelf,
  type ShelfPhysicalBlock,
  isTechReviewLocation,
  isUrgentLocation,
  isAluminioLocation,
} from '../../lib/firestoreSchema';
import ShelfGridCell, { type CellDragData } from './ShelfGridCell';
import ShelfGridLegend from './ShelfGridLegend';
import ShelfGridStats from './ShelfGridStats';
import ShelfRackView from './ShelfRackView';

interface ShelfGridProps {
  locations: ShelfLocationState[];
  shelfDef?: Shelf;
  onCellPress?: (location: ShelfLocationState) => void;
  selectedPositions?: string[];
  highlightedPositions?: string[];
  /** "articleCode|orderFab" del artículo buscado, para resaltarlo más oscuro entre varios de la misma celda. */
  highlightedItemKey?: string | null;
  dragOverPosition?: string | null;
  compact?: boolean;
  showReprocessCosts?: boolean;
  fullscreenMode?: boolean;
  onCellDragStart?: (data: CellDragData) => void;
  onCellDragEnter?: (position: string) => void;
  onCellDragLeave?: () => void;
  onCellDrop?: (targetPosition: string) => void;
  /** Kiosk mode: always show one block at a time with navigation (ignores screen size) */
  forceSingleBlock?: boolean;
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

const SectionHeader = React.memo(({
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
}: SectionHeaderProps) => {
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
    wrapCls = 'bg-amber-50 border-amber-300 shadow-sm hover:bg-amber-100/60';
    titleCls = 'text-amber-800';
    accentBar = 'bg-amber-500';
    pctBarCls = 'from-amber-500 to-amber-400';
    chevronCls = 'text-amber-400 group-hover:text-amber-600';
    subtitleCls = 'text-amber-600/80';
    statsCls = 'text-amber-700';
    badgeEl = (
      <span className="px-2 py-0.5 text-[9px] font-black bg-amber-600 text-white border border-amber-700 rounded-md uppercase tracking-widest">
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
});

// ─── Collapsible content wrapper ──────────────────────────────────────────────

const CollapsibleContent = React.memo(({
  isCollapsed,
  children,
}: { isCollapsed: boolean; children: React.ReactNode }) => (
  <div
    className="overflow-hidden transition-all duration-300 ease-in-out min-w-0 w-full"
    style={{ display: 'grid', gridTemplateRows: isCollapsed ? '0fr' : '1fr' }}
  >
    <div className="min-h-0 min-w-0">{children}</div>
  </div>
));

// ─── Mobile block navigation ──────────────────────────────────────────────────

interface MobileBlockNavProps {
  blocks: Array<{ id: string; title: string }>;
  activeIdx: number;
  onSelect: (idx: number) => void;
  alwaysShow?: boolean;
}

const MobileBlockNav = React.memo(({ blocks, activeIdx, onSelect, alwaysShow = false }: MobileBlockNavProps) => {
  const count = blocks.length;
  const wrapCls = alwaysShow
    ? 'flex items-center gap-2 mb-2 px-1 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80'
    : 'flex md:hidden items-center gap-2 mb-2 px-1 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80';
  return (
    <div className={wrapCls}>
      <button
        type="button"
        aria-label="Bloque anterior"
        onClick={() => onSelect(Math.max(0, activeIdx - 1))}
        disabled={activeIdx === 0}
        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-25 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-600 transition-colors shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex items-center gap-2 flex-1 min-w-0 px-1">
        <span className="text-xs font-black font-mono text-slate-700 truncate leading-none">{blocks[activeIdx]?.title}</span>
        <span className="text-[10px] font-mono text-slate-400 shrink-0 tabular-nums">{activeIdx + 1}/{count}</span>
      </div>

      <div className="flex items-center shrink-0">
        {blocks.map((b, i) => (
          <button
            key={b.id}
            type="button"
            aria-label={b.title}
            aria-current={i === activeIdx ? 'true' : undefined}
            onClick={() => onSelect(i)}
            className="group p-2 flex items-center justify-center shrink-0"
          >
            {/* El punto visual queda pequeño; el botón aporta un área táctil mayor. */}
            <span
              className={`block rounded-full transition-all duration-200 ${
                i === activeIdx
                  ? 'w-5 h-1.5 bg-sky-500'
                  : 'w-1.5 h-1.5 bg-slate-300 group-hover:bg-slate-400'
              }`}
            />
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-label="Bloque siguiente"
        onClick={() => onSelect(Math.min(count - 1, activeIdx + 1))}
        disabled={activeIdx === count - 1}
        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-25 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-600 transition-colors shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
});

// ─── Block (physical layout) ──────────────────────────────────────────────────

interface BlockProps {
  block: ShelfPhysicalBlock;
  shelfDef: Shelf;
  locationMap: Map<string, ShelfLocationState>;
  selectedPositions: string[];
  highlightedPositions: string[];
  highlightedItemKey?: string | null;
  dragOverPosition?: string | null;
  onCellPress?: (location: ShelfLocationState) => void;
  isCollapsed: boolean;
  onToggle: () => void;
  showReprocessCosts: boolean;
  showVerticalStrip?: boolean;
  compactRack?: boolean;
  onCellDragStart?: (data: CellDragData) => void;
  onCellDragEnter?: (position: string) => void;
  onCellDragLeave?: () => void;
  onCellDrop?: (targetPosition: string) => void;
}

const Block = React.memo(({
  block,
  shelfDef,
  locationMap,
  selectedPositions,
  highlightedPositions,
  highlightedItemKey,
  dragOverPosition,
  onCellPress,
  isCollapsed,
  onToggle,
  showReprocessCosts,
  showVerticalStrip = true,
  compactRack = false,
  onCellDragStart,
  onCellDragEnter,
  onCellDragLeave,
  onCellDrop,
}: BlockProps) => {
  const zone = shelfDef.layout.zones.find((z) => z.name === block.zoneName);
  const isUrgent = zone?.isUrgent ?? false;
  const isTechReview = zone?.isTechReview ?? false;
  const isAluminio = zone?.name?.includes('ALUMINIO') ?? false;

  // La franja de suelo (block.floorPosition) es una ubicación más del bloque:
  // debe contar en ocupación y nº de artículos de la cabecera.
  const allPos = [
    ...block.rows.flat().filter((p): p is (number | string) => p !== null),
    ...(block.floorPosition ? [block.floorPosition] : []),
  ];
  const toPos = (p: number | string) => typeof p === 'string' ? p : p.toString().padStart(3, '0');
  const occupiedCount = allPos.filter((p) => {
    const loc = locationMap.get(toPos(p));
    return loc && !loc.isEmpty;
  }).length;
  const totalArticles: number = allPos.reduce<number>((sum, p) => {
    const loc = locationMap.get(toPos(p));
    return sum + (loc?.items.length ?? 0);
  }, 0);
  const pct = allPos.length > 0 ? Math.round((occupiedCount / allPos.length) * 100) : 0;

  const stripCls = isUrgent
    ? 'bg-red-50 border-red-300 hover:bg-red-100/60'
    : isTechReview
    ? 'bg-amber-50 border-amber-300 hover:bg-amber-100/60'
    : 'bg-white border-slate-200 hover:bg-sky-50/60';
  const stripTitleCls = isUrgent ? 'text-red-800' : isTechReview ? 'text-amber-800' : 'text-slate-700';
  const stripStatsCls = isUrgent ? 'text-red-600' : isTechReview ? 'text-amber-600' : 'text-slate-500';
  const stripChevronCls = isUrgent
    ? 'text-red-400 group-hover:text-red-600'
    : isTechReview
    ? 'text-amber-400 group-hover:text-amber-600'
    : 'text-slate-400 group-hover:text-slate-600';
  const stripAccentCls = isUrgent ? 'bg-red-500' : isTechReview ? 'bg-amber-500' : 'bg-sky-500';

  return (
    <div className="flex flex-col gap-2 min-w-0 w-full h-full">
      {/* Normal header: on desktop, hidden when showing vertical strip instead */}
      <div className={showVerticalStrip && isCollapsed ? 'md:hidden' : undefined}>
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
      </div>

      {/* Vertical strip: desktop only, when collapsed and vertical strip mode active */}
      {showVerticalStrip && isCollapsed && (
        <button
          type="button"
          onClick={onToggle}
          title={`Expandir: ${block.title}`}
          className={`hidden md:flex flex-col items-center justify-between flex-1 w-full rounded-xl border
            py-3 px-1 relative overflow-hidden
            transition-colors duration-200 cursor-pointer group
            active:scale-[0.97] animate-fade-in
            ${stripCls}`}
        >
          {/* Occupancy fill rising from bottom — subtle background indicator */}
          <div
            className={`absolute inset-x-0 bottom-0 ${stripAccentCls} opacity-[0.08] rounded-b-xl transition-all duration-700`}
            style={{ height: `${pct}%` }}
          />

          {/* Left-edge accent line */}
          <div className={`absolute left-0 top-2 bottom-2 w-[2px] ${stripAccentCls} opacity-50 rounded-full`} />

          {/* Expand chevron at top (← = "click to expand") */}
          <svg
            className={`w-4 h-4 -rotate-90 shrink-0 transition-transform duration-200 ${stripChevronCls}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>

          {/* Title reading top → bottom */}
          <span
            className={`text-[11px] font-mono font-black tracking-widest uppercase flex-1 py-2 leading-none ${stripTitleCls}`}
            style={{ writingMode: 'vertical-lr' }}
          >
            {block.title}
          </span>

          {/* Count + accent dot at bottom */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className={`text-[9px] font-mono tabular-nums leading-none ${stripStatsCls}`}>
              {occupiedCount}/{allPos.length}
            </span>
            <div className={`w-1.5 h-1.5 rounded-full ${stripAccentCls} opacity-50`} />
          </div>
        </button>
      )}

      <CollapsibleContent isCollapsed={isCollapsed}>
        <div className="pt-1 pb-2 min-w-0">
          {/* Scroll horizontal solo en este contenedor; la estantería mantiene su ancho mínimo */}
          <div className="w-full max-w-full overflow-x-auto overscroll-x-contain [scrollbar-width:thin] [scrollbar-color:rgba(30,41,59,0.8)_transparent]">
            <ShelfRackView
              block={block}
              shelfCode={shelfDef.code}
              locationMap={locationMap}
              selectedPositions={selectedPositions}
              highlightedPositions={highlightedPositions}
              highlightedItemKey={highlightedItemKey}
              dragOverPosition={dragOverPosition}
              onCellPress={onCellPress}
              showReprocessCosts={showReprocessCosts}
              compact={compactRack}
              createEmptyLocation={createEmptyLocation}
              onCellDragStart={onCellDragStart}
              onCellDragEnter={onCellDragEnter}
              onCellDragLeave={onCellDragLeave}
              onCellDrop={onCellDrop}
            />
          </div>
        </div>
      </CollapsibleContent>
    </div>
  );
});

// ─── ShelfGrid ────────────────────────────────────────────────────────────────

const ShelfGrid: React.FC<ShelfGridProps> = ({
  locations,
  shelfDef,
  onCellPress,
  selectedPositions = [],
  highlightedPositions = [],
  highlightedItemKey = null,
  dragOverPosition = null,
  compact = false,
  showReprocessCosts = false,
  fullscreenMode = false,
  forceSingleBlock = false,
  onCellDragStart,
  onCellDragEnter,
  onCellDragLeave,
  onCellDrop,
}) => {
  // Estado de colapso persistido por estantería: el operario que siempre
  // colapsa una zona no tiene que rehacerlo en cada recarga/cambio de sección.
  const collapseStorageKey = shelfDef?.code ? `wms.collapsed.${shelfDef.code}` : null;
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [activeMobileBlockIdx, setActiveMobileBlockIdx] = useState(0);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Reset navigation index when the shelf changes + restaurar colapso guardado
  useEffect(() => {
    setActiveMobileBlockIdx(0);
    if (!collapseStorageKey) {
      setCollapsedSections(new Set());
      return;
    }
    try {
      const raw = window.localStorage.getItem(collapseStorageKey);
      setCollapsedSections(raw ? new Set(JSON.parse(raw) as string[]) : new Set());
    } catch {
      setCollapsedSections(new Set());
    }
  }, [collapseStorageKey]);

  // BA7: Auto-scroll al primer highlight cuando cambian las posiciones destacadas.
  // Retry con requestAnimationFrame + timeout para cubrir el caso en que las celdas
  // nuevas aún no están en el DOM al primer paint (navegación cross-shelf desde el buscador).
  useEffect(() => {
    if (highlightedPositions.length === 0 || !gridContainerRef.current) return;
    const firstHighlight = highlightedPositions[0];
    const scrollTo = () => {
      const cell = gridContainerRef.current?.querySelector(`[data-position="${firstHighlight}"]`);
      if (cell) {
        cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        return true;
      }
      return false;
    };
    // Primer intento inmediato
    scrollTo();
    // Reintentos sucesivos: cubren tanto la carga asíncrona de celdas como la
    // transición CSS (300ms) de expandir un bloque/zona colapsado, durante la
    // cual la celda ya está en el DOM pero con altura 0 (posición incorrecta).
    let cancelled = false;
    const raf = requestAnimationFrame(() => { if (!cancelled) scrollTo(); });
    const timers = [120, 250, 380].map((ms) => setTimeout(() => { if (!cancelled) scrollTo(); }, ms));
    return () => { cancelled = true; cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, [highlightedPositions, locations, collapsedSections, activeMobileBlockIdx]);

  // Si el highlight cae en una sección colapsada o, en modo kiosko, en un
  // bloque físico distinto del activo, la celda existe en el DOM pero con
  // altura 0 / oculta: hay que expandirla / saltar al bloque correcto para
  // que la navegación por búsqueda lleve a una vista realmente visible.
  useEffect(() => {
    if (highlightedPositions.length === 0) return;
    const firstHighlight = highlightedPositions[0];
    const blocks = shelfDef?.layout.physicalBlocks ?? [];
    const posKey = (p: number | string | null) =>
      p === null ? null : (typeof p === 'string' ? p : p.toString().padStart(3, '0'));

    if (blocks.length > 0) {
      const containingBlock = blocks.find((b) =>
        b.floorPosition === firstHighlight ||
        b.rows.some((row) => row.some((p) => posKey(p) === firstHighlight)),
      );
      if (!containingBlock) return;

      const regular = blocks.filter((b) => !b.fullWidth);
      const regularIdx = regular.findIndex((b) => b.id === containingBlock.id);
      if (regularIdx >= 0) setActiveMobileBlockIdx(regularIdx);

      setCollapsedSections((prev) => {
        if (!prev.has(containingBlock.id)) return prev;
        const next = new Set(prev);
        next.delete(containingBlock.id);
        if (collapseStorageKey) {
          try { window.localStorage.setItem(collapseStorageKey, JSON.stringify([...next])); } catch { /* cuota / modo privado */ }
        }
        return next;
      });
    } else {
      const zones = shelfDef?.layout.zones ?? [];
      const posInt = parseInt(firstHighlight, 10);
      const zone = zones.find((z) => !Number.isNaN(posInt) && posInt >= z.range[0] && posInt <= z.range[1]);
      if (!zone) return;
      const zoneId = `zone-${zone.name}`;
      setCollapsedSections((prev) => {
        if (!prev.has(zoneId)) return prev;
        const next = new Set(prev);
        next.delete(zoneId);
        if (collapseStorageKey) {
          try { window.localStorage.setItem(collapseStorageKey, JSON.stringify([...next])); } catch { /* cuota / modo privado */ }
        }
        return next;
      });
    }
  }, [highlightedPositions, shelfDef, collapseStorageKey]);

  const toggleSection = useCallback((id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (collapseStorageKey) {
        try { window.localStorage.setItem(collapseStorageKey, JSON.stringify([...next])); } catch { /* cuota / modo privado */ }
      }
      return next;
    });
  }, [collapseStorageKey]);

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
  const regularBlocks = physicalBlocks.filter((b) => !b.fullWidth);

  // CAL y REP usan rack compacto para ahorrar espacio horizontal
  const compactRack = shelfDef?.code === 'CAL' || shelfDef?.code === 'REP';

  const colsForBlock = useCallback((rows: Array<Array<number | string | null>>): string => {
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
    // Tailwind no genera clases dinámicas: >7 columnas cae a 7 (no romper el grid)
    return colMap[maxCols] || 'grid-cols-7';
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
                      const pos = typeof posNum === 'string' ? posNum : posNum.toString().padStart(3, '0');
                      const isStr = typeof posNum === 'string';
                      const loc = locationMap.get(pos);
                      return (
                        <ShelfGridCell
                          key={pos}
                          position={pos}
                          location={loc}
                          shelfCode={shelfDef?.code}
                          isUrgent={isStr ? /URG/i.test(pos) : isUrgentLocation(shelfDef?.code || '', posNum as number)}
                          isTechReview={!isStr && isTechReviewLocation(shelfDef?.code || '', posNum as number)}
                          isAluminio={!isStr && isAluminioLocation(shelfDef?.code || '', posNum as number)}
                          isSelected={selectedPositions.includes(pos)}
                          isHighlighted={highlightedPositions.includes(pos)}
                          highlightedItemKey={highlightedItemKey}
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
            highlightedItemKey={highlightedItemKey}
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
      <div ref={gridContainerRef} className="w-full min-w-0">
        {!fullscreenMode && (
         <>
           <div className="hidden sm:block">
             <ShelfGridStats
               emptySlots={Math.max(totalSlots - occupiedSlots, 0)}
               occupiedSlots={occupiedSlots}
               totalSlots={totalSlots}
               occupancy={pct}
               compact={compact}
             />
           </div>

           <div className="hidden sm:block mb-5 rounded-2xl border border-slate-700/80 bg-slate-900/90 px-4 py-3 shadow-[0_14px_40px_rgba(15,23,42,0.25)]">
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
         <div className="w-full min-w-0">
           {regularBlocks.length > 1 && (
             <MobileBlockNav
               blocks={regularBlocks}
               activeIdx={activeMobileBlockIdx}
               onSelect={setActiveMobileBlockIdx}
               alwaysShow={forceSingleBlock}
             />
           )}
           <div className={`flex ${forceSingleBlock ? 'flex-col' : 'flex-wrap'} pb-4 ${fullscreenMode ? 'gap-2' : 'gap-3'} w-full min-w-0`}>
             {physicalBlocks.map((block) => {
               const isCollapsed = collapsedSections.has(block.id);
               const regularIdx = regularBlocks.findIndex((b) => b.id === block.id);
               const isRegular = regularIdx >= 0;
               const isMobileInactive = isRegular && regularIdx !== activeMobileBlockIdx;
               const hiddenClass = isMobileInactive
                 ? (forceSingleBlock ? 'hidden' : 'hidden md:block')
                 : '';
               const widthClass = block.fullWidth
                 ? 'w-full min-w-0'
                 : forceSingleBlock
                 ? 'w-full min-w-0'
                 : isCollapsed
                 ? 'flex-1 min-w-0 md:flex-none md:w-12 md:self-stretch md:transition-all md:duration-300'
                 : 'flex-1 min-w-0 md:transition-all md:duration-300';
               return (
                 <div
                   key={block.id}
                   className={[hiddenClass, widthClass].filter(Boolean).join(' ')}
                 >
                    <Block
                      block={block}
                      shelfDef={shelfDef!}
                      locationMap={locationMap}
                      selectedPositions={selectedPositions}
                      highlightedPositions={highlightedPositions}
                      highlightedItemKey={highlightedItemKey}
                      dragOverPosition={dragOverPosition}
                      onCellPress={onCellPress}
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleSection(block.id)}
                      showReprocessCosts={showReprocessCosts}
                      showVerticalStrip={!forceSingleBlock}
                      compactRack={compactRack}
                      onCellDragStart={onCellDragStart}
                      onCellDragEnter={onCellDragEnter}
                      onCellDragLeave={onCellDragLeave}
                      onCellDrop={onCellDrop}
                    />
                 </div>
               );
             })}
           </div>
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
                           highlightedItemKey={highlightedItemKey}
                           isDragOver={dragOverPosition === pos}
                           showReprocessCosts={showReprocessCosts}
                           onPress={onCellPress}
                           createEmptyLocation={createEmptyLocation}
                           onCellDragStart={onCellDragStart}
                           onCellDragEnter={onCellDragEnter}
                           onCellDragLeave={onCellDragLeave}
                           onCellDrop={onCellDrop}
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


