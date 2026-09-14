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
import { computeShelfKpis } from '../../lib/shelfKpis';

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
  /**
   * Kiosko tablet horizontal: la estantería activa se estira al alto disponible
   * (sin cabecera de sección ni filas totalmente vacías en los extremos) y los
   * bloques se eligen con pestañas en vez de ◀ ▶.
   */
  fitHeight?: boolean;
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
      <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-black bg-red-600 text-white border border-red-700 rounded-md uppercase tracking-widest">
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
      <span className="px-2 py-0.5 text-[10px] font-black bg-amber-600 text-white border border-amber-700 rounded-md uppercase tracking-widest">
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
      <span className="px-2 py-0.5 text-[10px] font-black bg-amber-600 text-white border border-amber-700 rounded-md uppercase tracking-widest">
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
          <span className={`text-base font-black tracking-tight font-mono ${titleCls}`}>{title}</span>
          {subtitle && (
            <span className={`text-xs font-mono ${subtitleCls}`}>{subtitle}</span>
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
          <span className={`text-xs font-semibold font-mono tabular-nums ${statsCls}`}>
            {occupiedCount}/{totalCount} huecos · {totalArticles} art.
          </span>
        </div>
      </div>

      <svg
        className={`w-5 h-5 shrink-0 transition-transform duration-300 ${chevronCls} ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
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
        className="h-10 w-10 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-25 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-600 transition-colors shrink-0"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex items-center gap-2 flex-1 min-w-0 px-1">
        <span className="text-sm font-black font-mono text-slate-800 truncate leading-none">{blocks[activeIdx]?.title}</span>
        <span className="text-xs font-bold font-mono text-slate-500 shrink-0 tabular-nums">{activeIdx + 1}/{count}</span>
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
        className="h-10 w-10 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-25 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-600 transition-colors shrink-0"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
});

// ─── Block tabs (kiosko tablet horizontal) ────────────────────────────────────

interface BlockTabsProps {
  blocks: Array<{ id: string; title: string; articles: number }>;
  activeIdx: number;
  onSelect: (idx: number) => void;
}

/**
 * Pestañas de bloque a lo ancho, encima de la estantería: sustituyen al
 * navegador ◀ ▶ + cabecera de sección. Cada pestaña lleva el nº de artículos
 * del bloque para saber dónde hay material sin entrar.
 */
const BlockTabs = React.memo(({ blocks, activeIdx, onSelect }: BlockTabsProps) => (
  <div className="flex gap-1.5 shrink-0" role="tablist">
    {blocks.map((b, i) => (
      <button
        key={b.id}
        type="button"
        role="tab"
        aria-selected={i === activeIdx}
        onClick={() => onSelect(i)}
        className={`flex-1 min-w-0 min-h-10 px-3 rounded-xl text-sm font-black leading-tight flex items-center justify-center gap-2 transition-colors touch-manipulation ${
          i === activeIdx
            ? 'bg-sky-600 text-white shadow-md'
            : 'bg-white text-slate-600 border border-slate-300 active:bg-sky-50'
        }`}
      >
        <span className="truncate">{b.title}</span>
        {b.articles > 0 && (
          <span className={`shrink-0 min-w-6 h-6 px-1.5 rounded-full text-xs font-black flex items-center justify-center tabular-nums ${
            i === activeIdx ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {b.articles}
          </span>
        )}
      </button>
    ))}
  </div>
));

/** Quita las filas totalmente vacías (null) de arriba y de abajo del bloque. */
const trimEmptyEdgeRows = (block: ShelfPhysicalBlock): ShelfPhysicalBlock => {
  const hasSlot = (row: Array<number | string | null>) => row.some((p) => p !== null);
  let start = 0;
  let end = block.rows.length;
  while (start < end && !hasSlot(block.rows[start])) start++;
  while (end > start && !hasSlot(block.rows[end - 1])) end--;
  return start === 0 && end === block.rows.length ? block : { ...block, rows: block.rows.slice(start, end) };
};

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
  compactRack?: boolean;
  onCellDragStart?: (data: CellDragData) => void;
  onCellDragEnter?: (position: string) => void;
  onCellDragLeave?: () => void;
  onCellDrop?: (targetPosition: string) => void;
  /**
   * Kiosko tablet horizontal: sin cabecera de sección y huecos compactos.
   * 'fill' = el rack se estira al alto disponible; 'natural' = alto justo.
   */
  fit?: 'fill' | 'natural';
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
  compactRack = false,
  onCellDragStart,
  onCellDragEnter,
  onCellDragLeave,
  onCellDrop,
  fit,
}: BlockProps) => {
  // Kiosko tablet horizontal: la cabecera de sección (título + ocupación +
  // plegar) sobra — el bloque se elige en las pestañas y los huecos URG ya
  // llevan su etiqueta — y cada píxel de alto es para los huecos.
  if (fit) {
    return (
      <div className={`flex flex-col min-w-0 w-full overflow-x-auto overscroll-x-contain [scrollbar-width:thin] ${fit === 'fill' ? 'flex-[1_0_auto]' : ''}`}>
        <ShelfRackView
          block={trimEmptyEdgeRows(block)}
          shelfCode={shelfDef.code}
          locationMap={locationMap}
          selectedPositions={selectedPositions}
          highlightedPositions={highlightedPositions}
          highlightedItemKey={highlightedItemKey}
          dragOverPosition={dragOverPosition}
          onCellPress={onCellPress}
          showReprocessCosts={showReprocessCosts}
          compact={compactRack}
          dense
          fill={fit === 'fill'}
          createEmptyLocation={createEmptyLocation}
          onCellDragStart={onCellDragStart}
          onCellDragEnter={onCellDragEnter}
          onCellDragLeave={onCellDragLeave}
          onCellDrop={onCellDrop}
        />
      </div>
    );
  }

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
  // Colapso ÚNICO en toda la app (todos los roles, kiosko, móvil y PC): VERTICAL.
  // La cabecera se queda y el contenido se pliega hacia arriba. No existe
  // variante horizontal (antes en PC el bloque se encogía a una tira de 48px).
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
  fitHeight = false,
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

  const { totalSlots, occupiedSlots, emptySlots, totalArticles, pct } = useMemo(
    () => computeShelfKpis(locations, shelfDef),
    [locations, shelfDef],
  );
  const physicalBlocks = shelfDef?.layout.physicalBlocks ?? [];
  const regularBlocks = useMemo(
    () => (shelfDef?.layout.physicalBlocks ?? []).filter((b) => !b.fullWidth),
    [shelfDef],
  );

  // Nº de artículos por bloque, para el badge de las pestañas de bloque.
  const tabBlocks = useMemo(() => {
    if (!fitHeight) return [];
    const toPos = (p: number | string) => typeof p === 'string' ? p : p.toString().padStart(3, '0');
    return regularBlocks.map((b) => {
      const all = [...b.rows.flat(), b.floorPosition ?? null].filter((p): p is number | string => p !== null);
      const articles = all.reduce<number>((sum, p) => sum + (locationMap.get(toPos(p))?.items.length ?? 0), 0);
      return { id: b.id, title: b.title, articles };
    });
  }, [fitHeight, regularBlocks, locationMap]);

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
      <div ref={gridContainerRef} className={`w-full min-w-0 ${fitHeight ? 'flex flex-col flex-[1_0_auto]' : ''}`}>
        {!fullscreenMode && (
         <>
           <div className="hidden sm:block">
             <ShelfGridStats
               emptySlots={emptySlots}
               occupiedSlots={occupiedSlots}
               totalSlots={totalSlots}
               occupancy={pct}
               compact={compact}
             />
           </div>

           <div className="hidden sm:block mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
             <div className="flex items-center gap-3">
               <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[80px]">
                 <div
                   className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 rounded-full transition-all duration-700"
                   style={{ width: `${pct}%` }}
                 />
               </div>
               <span className="text-xs font-bold text-slate-600 tabular-nums shrink-0">
                 {occupiedSlots}/{totalSlots} ocupadas · {totalArticles} artículos · {pct}%
               </span>
             </div>
             <ShelfGridLegend compact={compact} />
           </div>
         </>
       )}

       {physicalBlocks.length > 0 ? (
         <div className={`w-full min-w-0 ${fitHeight ? 'flex flex-col flex-[1_0_auto]' : ''}`}>
           {regularBlocks.length > 1 && (
             fitHeight
               ? <div className="mb-1.5"><BlockTabs blocks={tabBlocks} activeIdx={activeMobileBlockIdx} onSelect={setActiveMobileBlockIdx} /></div>
               : (
                 <MobileBlockNav
                   blocks={regularBlocks}
                   activeIdx={activeMobileBlockIdx}
                   onSelect={setActiveMobileBlockIdx}
                   alwaysShow={forceSingleBlock}
                 />
               )
           )}
           <div className={`flex ${forceSingleBlock ? 'flex-col' : 'flex-wrap'} ${fitHeight ? 'flex-[1_0_auto]' : 'pb-4'} ${fullscreenMode ? 'gap-2' : 'gap-3'} w-full min-w-0`}>
             {physicalBlocks.map((block) => {
               const isCollapsed = collapsedSections.has(block.id);
               const regularIdx = regularBlocks.findIndex((b) => b.id === block.id);
               const isRegular = regularIdx >= 0;
               const isMobileInactive = isRegular && regularIdx !== activeMobileBlockIdx;
               const hiddenClass = isMobileInactive
                 ? (forceSingleBlock ? 'hidden' : 'hidden md:block')
                 : '';
               // Mismo ancho recogido o desplegado: el colapso es solo vertical.
               const widthClass = block.fullWidth || forceSingleBlock
                 ? 'w-full min-w-0'
                 : 'flex-1 min-w-0';
               // Solo el bloque normal activo se estira; los de ancho completo
               // (filas URG de PRE) van compactos con su alto justo.
               const fitThis: 'fill' | 'natural' | undefined = !fitHeight ? undefined : isRegular ? 'fill' : 'natural';
               const fitClass = fitThis === 'fill' && !isMobileInactive ? 'flex flex-col flex-[1_0_auto]' : '';
               return (
                 <div
                   key={block.id}
                   className={[hiddenClass, widthClass, fitClass].filter(Boolean).join(' ')}
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
                      compactRack={compactRack}
                      onCellDragStart={onCellDragStart}
                      onCellDragEnter={onCellDragEnter}
                      onCellDragLeave={onCellDragLeave}
                      onCellDrop={onCellDrop}
                      fit={fitThis}
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


