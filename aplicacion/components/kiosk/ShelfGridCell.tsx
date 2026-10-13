/**
 * ShelfGridCell — Tarjeta de ubicación con diseño industrial-futurista.
 * Muestra artículos prominentemente con jerarquía visual clara.
 */

import React from 'react';
import { Camera } from 'lucide-react';
import type { ShelfLocationState } from '../../hooks/useShelf';
import { isReprocesosLocation } from '../../lib/firestoreSchema';
import { formatEuros } from '../../lib/api/reprocesosApi';
import { formatDecimal } from '../../lib/numberFormat';

export interface CellDragData {
  articleCode: string;
  orderFab: string;
  position: string;
}

interface ShelfGridCellProps {
  position: string;
  location?: ShelfLocationState;
  shelfCode?: string;
  isUrgent?: boolean;
  isTechReview?: boolean;
  isAluminio?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  /** "articleCode|orderFab" del artículo buscado, para resaltarlo más oscuro entre varios de la misma celda. */
  highlightedItemKey?: string | null;
  isDragOver?: boolean;
  compact?: boolean;
  showReprocessCosts?: boolean;
  onPress?: (location: ShelfLocationState) => void;
  createEmptyLocation: (position: string, shelfCode?: string) => ShelfLocationState;
  // Drag & drop (admin only)
  onCellDragStart?: (data: CellDragData) => void;
  onCellDragEnter?: (position: string) => void;
  onCellDragLeave?: () => void;
  onCellDrop?: (targetPosition: string) => void;
}

const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return '';
  }
};

const ShelfGridCell: React.FC<ShelfGridCellProps> = ({
  position,
  location,
  shelfCode = '',
  isUrgent = false,
  isTechReview = false,
  isAluminio = false,
  isSelected = false,
  isHighlighted = false,
  highlightedItemKey = null,
  isDragOver = false,
  compact = false,
  showReprocessCosts = false,
  onPress,
  createEmptyLocation,
  onCellDragStart,
  onCellDragEnter,
  onCellDragLeave,
  onCellDrop,
}) => {
  const posNum = parseInt(position, 10);
  const displayNum = Number.isNaN(posNum) ? position : posNum.toString().padStart(3, '0');
  const itemCount = location?.items.length ?? 0;
  const isEmpty = itemCount === 0;
  // SUBCONTRATACIÓN: celda ocupada por al menos un artículo subcontratado → amarillo.
  const hasSubcontratacion = !isEmpty && (location?.items?.some((it) => it.subcontratacion) ?? false);
  const isReproces = isReprocesosLocation(shelfCode, posNum);
  const isDraggable = !isEmpty && !!onCellDragStart;

  const handleClick = () => {
    if (onPress) onPress(location || createEmptyLocation(position, shelfCode));
  };

  const dragProps = isDraggable ? {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      if (!location?.items[0]) return;
      const item = location.items[0];
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ articleCode: item.articleCode, orderFab: item.orderFab, position }));
      onCellDragStart?.({ articleCode: item.articleCode, orderFab: item.orderFab, position });
    },
  } : {};

  const dropProps = onCellDrop ? {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onCellDragEnter?.(position); },
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); onCellDragEnter?.(position); },
    onDragLeave: () => onCellDragLeave?.(),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); onCellDragLeave?.(); onCellDrop(position); },
  } : {};

  // ── Compact mode ────────────────────────────────────────────────────────────
  if (compact) {
    let cardBase = 'bg-slate-900/95 border-slate-500/70 shadow-[0_8px_24px_rgba(15,23,42,0.3)]';
    let headerText = 'text-slate-100';
    if (isSelected) {
      cardBase = 'bg-cyan-500/20 border-cyan-300/80 ring-2 ring-cyan-300/80 shadow-[0_10px_26px_rgba(34,211,238,0.22)]';
      headerText = 'text-cyan-50';
    } else if (isHighlighted) {
      // Resultado de búsqueda: celda resaltada en ROSA para localizarla de un vistazo.
      cardBase = 'bg-pink-400/30 border-pink-300/90 ring-2 ring-pink-300/90 shadow-[0_10px_26px_rgba(244,114,182,0.3)]';
      headerText = 'text-pink-50';
    } else if (isUrgent) {
      cardBase = isEmpty ? 'bg-red-950/75 border-red-400/55' : 'bg-red-950/90 border-red-300/65';
      headerText = 'text-red-100';
    } else if (isTechReview) {
      cardBase = isEmpty ? 'bg-amber-950/70 border-amber-400/50' : 'bg-amber-950/85 border-amber-300/60';
      headerText = 'text-amber-100';
    } else if (isAluminio) {
      cardBase = isEmpty ? 'bg-amber-950/70 border-amber-400/50' : 'bg-amber-950/90 border-amber-300/65';
      headerText = 'text-amber-100';
    } else if (isReproces) {
      cardBase = isEmpty ? 'bg-purple-950/60 border-purple-400/40' : 'bg-purple-950/85 border-purple-300/55';
      headerText = 'text-purple-100';
    } else if (hasSubcontratacion) {
      // Mismo color que el botón "Subcontratación" del flujo de ubicar (naranja).
      cardBase = 'bg-orange-400/30 border-orange-300/85 ring-2 ring-orange-300/75 shadow-[0_10px_26px_rgba(251,146,60,0.24)]';
      headerText = 'text-orange-50';
    } else if (!isEmpty) {
      cardBase = 'bg-slate-800/95 border-cyan-400/35 shadow-[0_0_16px_rgba(34,211,238,0.08)]';
      headerText = 'text-white';
    }
    const dragOverClass = isDragOver ? 'ring-2 ring-emerald-300/90 bg-emerald-500/20' : '';
    // Compact: single-item cells are draggable; multi-item cells show a ≡ indicator
    const compactDraggable = isDraggable && itemCount === 1;
    return (
      <button
        type="button"
        data-position={position}
        onClick={handleClick}
        title={`${shelfCode} ${displayNum}${isEmpty ? ' · Vacía' : ` · ${itemCount} artículo(s)${itemCount > 1 ? ' · Arrastra en vista completa' : ''}`}`}
        className={`w-11 h-11 rounded-xl border-2 flex flex-col items-center justify-center relative
          transition-all active:scale-95 hover:-translate-y-0.5 ${compactDraggable ? '[touch-action:pan-y]' : '[touch-action:pan-x_pan-y]'}
          ${compactDraggable ? 'cursor-grab active:cursor-grabbing' : ''}
          ${dragOverClass} ${cardBase}`}
        {...(compactDraggable ? dragProps : {})}
        {...dropProps}
      >
        <span className={`text-[10px] font-black font-mono ${headerText}`}>{displayNum}</span>
        {!isEmpty && itemCount === 1 && <span className="w-2 h-2 rounded-full bg-cyan-300 mt-0.5 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />}
        {!isEmpty && itemCount > 1 && <span className={`text-[10px] font-black mt-0.5 ${headerText}`}>{itemCount}</span>}
        {location?.nota && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400 pointer-events-none" />}
        {!!location?.photos?.length && <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.9)] pointer-events-none" />}
      </button>
    );
  }

  // ── Full mode — celda vacía ──────────────────────────────────────────────────
  if (isEmpty) {
    let emptyBorder = 'border-slate-600/80 border-dashed';
    let emptyBg = 'bg-slate-900/75';
    let emptyCode = 'text-slate-200';
    let emptyHint = 'text-slate-400';

    if (isSelected) {
      emptyBorder = 'border-cyan-300/80 ring-2 ring-cyan-300/80';
      emptyBg = 'bg-cyan-500/15';
      emptyCode = 'text-cyan-50';
      emptyHint = 'text-cyan-200/80';
    } else if (isHighlighted) {
      // Resultado de búsqueda: celda (vacía) resaltada en ROSA.
      emptyBorder = 'border-pink-300/90 ring-2 ring-pink-300/90';
      emptyBg = 'bg-pink-400/20';
      emptyCode = 'text-pink-50';
      emptyHint = 'text-pink-200/85';
    } else if (isUrgent) {
      emptyBorder = 'border-red-400/55 border-dashed';
      emptyBg = 'bg-red-950/45';
      emptyCode = 'text-red-100';
      emptyHint = 'text-red-200/80';
    } else if (isTechReview) {
      emptyBorder = 'border-amber-400/55 border-dashed';
      emptyBg = 'bg-amber-950/40';
      emptyCode = 'text-amber-100';
      emptyHint = 'text-amber-200/80';
    } else if (isAluminio) {
      emptyBorder = 'border-amber-400/55 border-dashed';
      emptyBg = 'bg-amber-950/40';
      emptyCode = 'text-amber-100';
      emptyHint = 'text-amber-200/80';
    } else if (isReproces) {
      emptyBorder = 'border-purple-400/45 border-dashed';
      emptyBg = 'bg-purple-950/35';
      emptyCode = 'text-purple-100';
      emptyHint = 'text-purple-200/80';
    }

    return (
      <div
        data-position={position}
        onClick={onPress ? handleClick : undefined}
        className={`rounded-2xl border transition-all duration-200 overflow-hidden w-full relative [touch-action:pan-x_pan-y]
          hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 ${onPress ? 'cursor-pointer' : 'cursor-default'}
          ${isDragOver ? 'ring-2 ring-emerald-300/90 bg-emerald-500/10' : ''}
          ${emptyBorder} ${emptyBg}`}
        {...dropProps}
      >
        <div className="px-3 py-3 flex items-center justify-between gap-2">
          <span className={`text-[11px] font-black font-mono tracking-wider ${emptyCode}`}>
            {shelfCode} {displayNum}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-[0.18em] shrink-0 ${emptyHint}`}>
            Libre
          </span>
        </div>
        {location?.nota && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 pointer-events-none" />}
        {!!location?.photos?.length && (
          <span className="absolute top-1 left-1 text-[10px] leading-none bg-violet-500 text-white rounded-full px-1 py-0.5 flex items-center gap-0.5 shadow-sm pointer-events-none">
            <Camera className="w-2.5 h-2.5" strokeWidth={2.5} aria-hidden />{location.photos.length > 1 ? <span className="tabular-nums">{location.photos.length}</span> : null}
          </span>
        )}
      </div>
    );
  }

  // ── Full mode — celda ocupada ────────────────────────────────────────────────
  let cardBase = 'bg-slate-900/96 border-slate-500/80 shadow-[0_12px_32px_rgba(15,23,42,0.34)] shadow-[0_0_16px_rgba(34,211,238,0.08)]';
  let headerText = 'text-white';
  let ofCls = 'text-cyan-200';
  let itemBg = 'bg-slate-950/80 border border-slate-700/70';
  let borderTop = 'border-slate-600/60';
  let countBadgeCls = 'bg-slate-100 text-slate-950';
  let badgeEl: React.ReactNode = null;

  if (isSelected) {
    cardBase = 'bg-cyan-500/22 border-cyan-200/85 ring-2 ring-cyan-200/85 shadow-[0_14px_40px_rgba(34,211,238,0.24)]';
    headerText = 'text-cyan-50';
    ofCls = 'text-cyan-100';
    itemBg = 'bg-cyan-950/55 border border-cyan-300/25';
    borderTop = 'border-cyan-200/35';
    countBadgeCls = 'bg-cyan-50 text-cyan-950';
  } else if (isHighlighted) {
    // Resultado de búsqueda: celda ocupada resaltada en ROSA (+ animate-pulse abajo).
    cardBase = 'bg-pink-400/22 border-pink-300/90 ring-2 ring-pink-300/90 shadow-[0_14px_40px_rgba(244,114,182,0.26)]';
    headerText = 'text-pink-50';
    ofCls = 'text-pink-100';
    itemBg = 'bg-pink-950/55 border border-pink-300/25';
    borderTop = 'border-pink-200/35';
    countBadgeCls = 'bg-pink-50 text-pink-950';
  } else if (isUrgent) {
    cardBase = 'bg-red-950/88 border-red-300/70 shadow-[0_14px_40px_rgba(127,29,29,0.3)]';
    headerText = 'text-red-100';
    ofCls = 'text-red-100';
    itemBg = 'bg-red-950/72 border border-red-300/22';
    borderTop = 'border-red-300/35';
    countBadgeCls = 'bg-red-50 text-red-950';
    badgeEl = (
      <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-black bg-red-100 text-red-950 border border-red-200 rounded-md uppercase tracking-widest shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        URG
      </span>
    );
  } else if (isTechReview) {
    cardBase = 'bg-amber-950/88 border-amber-300/70 shadow-[0_14px_40px_rgba(120,53,15,0.28)]';
    headerText = 'text-amber-100';
    ofCls = 'text-amber-100';
    itemBg = 'bg-amber-950/72 border border-amber-300/22';
    borderTop = 'border-amber-300/35';
    countBadgeCls = 'bg-amber-50 text-amber-950';
    badgeEl = (
      <span className="px-1.5 py-0.5 text-[10px] font-black bg-amber-50 text-amber-950 border border-amber-200 rounded-md uppercase tracking-widest shrink-0">
        VT
      </span>
    );
  } else if (isAluminio) {
    cardBase = 'bg-amber-950/88 border-amber-300/70 shadow-[0_14px_40px_rgba(217,119,6,0.22)]';
    headerText = 'text-amber-100';
    ofCls = 'text-amber-100';
    itemBg = 'bg-amber-950/72 border border-amber-300/22';
    borderTop = 'border-amber-300/35';
    countBadgeCls = 'bg-amber-50 text-amber-950';
    badgeEl = (
      <span className="px-1.5 py-0.5 text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-200 rounded-md uppercase tracking-widest shrink-0">
        ALU
      </span>
    );
  } else if (isReproces) {
    cardBase = 'bg-purple-950/85 border-purple-300/60 shadow-[0_14px_40px_rgba(139,92,246,0.20)]';
    headerText = 'text-purple-100';
    ofCls = 'text-purple-100';
    itemBg = 'bg-purple-950/72 border border-purple-300/22';
    borderTop = 'border-purple-300/35';
    countBadgeCls = 'bg-purple-50 text-purple-950';
    badgeEl = (
      <span className="px-1.5 py-0.5 text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-400/30 rounded-md uppercase tracking-widest shrink-0">
        REPROC
      </span>
    );
  } else if (hasSubcontratacion) {
    // Mismo color que el botón "Subcontratación" del flujo de ubicar (naranja).
    cardBase = 'bg-orange-500/25 border-orange-300/75 ring-1 ring-orange-300/50 shadow-[0_14px_40px_rgba(251,146,60,0.24)]';
    headerText = 'text-orange-50';
    ofCls = 'text-orange-100';
    itemBg = 'bg-orange-950/55 border border-orange-300/25';
    borderTop = 'border-orange-300/35';
    countBadgeCls = 'bg-orange-100 text-orange-950';
    badgeEl = (
      <span className="px-1.5 py-0.5 text-[10px] font-black bg-orange-500/25 text-orange-200 border border-orange-400/30 rounded-md uppercase tracking-widest shrink-0">
        SUBCON
      </span>
    );
  }

  if (isReproces && showReprocessCosts && !badgeEl) {
    badgeEl = (
      <span className="px-1.5 py-0.5 text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/20 rounded-md shrink-0">
        €
      </span>
    );
  }

  // For multi-item cells, drag is per-item (not the whole card)
  const multiItem = itemCount > 1;

  return (
    <div
      data-position={position}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden w-full relative ${isDraggable && !multiItem ? '[touch-action:pan-y]' : '[touch-action:pan-x_pan-y]'}
        hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25
        ${isHighlighted ? 'animate-pulse' : ''}
        ${isDraggable && !multiItem ? 'cursor-grab active:cursor-grabbing' : (onPress ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default')}
        ${isDragOver ? 'ring-2 ring-emerald-300/90 scale-[1.02]' : ''}
        ${cardBase}`}
      onClick={onPress ? handleClick : undefined}
      {...(!multiItem ? dragProps : {})}
      {...dropProps}
    >
      {location?.nota && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 z-10 pointer-events-none" />}
      {!!location?.photos?.length && (
        <span className="absolute top-1 left-1 z-10 text-[10px] leading-none bg-violet-500 text-white rounded-full px-1 py-0.5 flex items-center gap-0.5 shadow-sm pointer-events-none">
          <Camera className="w-2.5 h-2.5" strokeWidth={2.5} aria-hidden />{location.photos.length > 1 ? <span className="tabular-nums">{location.photos.length}</span> : null}
        </span>
      )}
      {/* REPROCESOS: Importe total en esquina superior derecha (si showReprocessCosts) */}
      {isReproces && showReprocessCosts && location && (() => {
        const totalImporte = location.items.reduce((sum, item) => {
          const qty = item.quantity ?? 0;
          const cost = item.unitCost ?? 0;
          return sum + (qty * cost);
        }, 0);
        const totalQuantity = location.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
        return totalImporte > 0 || totalQuantity > 0 ? (
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
            {totalImporte > 0 && (
              <div className="px-2 py-1 rounded-lg bg-amber-500 text-amber-950 text-[11px] font-black shadow-lg border border-amber-300/50">
                {formatEuros(totalImporte)}
              </div>
            )}
            {totalQuantity > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-purple-600/40 text-purple-200 text-[11px] font-bold border border-purple-400/50">
                {totalQuantity} ud
              </span>
            )}
          </div>
        ) : null;
      })()}
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className={`text-xs font-black font-mono tracking-wider shrink-0 ${headerText}`}>
            {shelfCode} {displayNum}
          </span>
          {badgeEl}
        </div>
        <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-full tabular-nums shrink-0 ${countBadgeCls}`}>
          {itemCount} art.
        </span>
      </div>

      {/* Items list */}
      <div className={`border-t px-2 pt-1.5 pb-2 space-y-1.5 ${borderTop}`}>
        {location!.items.map((item, idx) => {
          const isSearchedItem = !!highlightedItemKey && `${item.articleCode}|${item.orderFab}` === highlightedItemKey;
          return (
          <div
            key={`${item.articleCode}-${item.orderFab}-${idx}`}
            className={`rounded-xl px-2.5 py-2 relative ${isSearchedItem ? 'bg-pink-600/55 border border-pink-300 ring-2 ring-pink-300/80' : itemBg}
              ${multiItem && onCellDragStart ? 'cursor-grab active:cursor-grabbing' : ''}`}
            draggable={multiItem && !!onCellDragStart}
            onDragStart={multiItem && onCellDragStart ? (e) => {
              e.stopPropagation();
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', JSON.stringify({ articleCode: item.articleCode, orderFab: item.orderFab, position }));
              onCellDragStart({ articleCode: item.articleCode, orderFab: item.orderFab, position });
            } : undefined}
          >
            {multiItem && onCellDragStart && (
              <span className="absolute right-2 top-2 text-slate-500/70 text-[10px] select-none pointer-events-none">⠿</span>
            )}
            <p className={`text-[15px] font-black font-mono text-white leading-tight [overflow-wrap:anywhere] tabular-nums ${multiItem && onCellDragStart ? 'pr-4' : ''}`}>
              {item.articleCode}
            </p>
            <p className={`text-xs font-bold font-mono leading-tight [overflow-wrap:anywhere] tabular-nums ${ofCls}`}>
              {item.orderFab}
            </p>
            {showReprocessCosts && item.quantity != null && item.unitCost != null && item.unitCost > 0 && (
              <p className="text-[11px] text-amber-300 font-mono mt-0.5 leading-tight tabular-nums">
                {item.quantity} ud · {formatDecimal(item.unitCost, 2)} €/ud
              </p>
            )}
            <p className="text-[11px] text-slate-300/85 mt-0.5 leading-tight break-words">
              {item.locatedByName} · {formatDate(item.locatedAt)}
            </p>
          </div>
          );
        })}
        {onPress && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            className="w-full mt-0.5 py-1.5 text-[11px] font-bold font-mono text-slate-200 rounded-xl bg-slate-700/85 hover:bg-slate-600 transition-colors uppercase tracking-widest"
          >
            Operar →
          </button>
        )}
      </div>
    </div>
  );
};

export default ShelfGridCell;


