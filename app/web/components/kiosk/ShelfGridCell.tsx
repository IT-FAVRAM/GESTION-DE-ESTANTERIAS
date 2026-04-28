/**
 * ShelfGridCell — Tarjeta expandible para cada ubicación
 * Gestor de Estanterías WMS v3.0
 *
 * Diseño basado en el layout de las fotos de referencia:
 * - Tarjeta colapsada: muestra código + badge de estado
 * - Tarjeta expandida: muestra cada artículo con OF, operario y fecha
 * - Urgentes: fondo rosado/rojo, badge URG
 * - Verificación técnica: fondo ámbar
 */

import React, { useState } from 'react';
import type { ShelfLocationState } from '../../hooks/useShelf';
import { isReprocesosLocation } from '../../lib/firestoreSchema';

interface ShelfGridCellProps {
  position: string;
  location?: ShelfLocationState;
  shelfCode?: string;
  isUrgent?: boolean;
  isTechReview?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  compact?: boolean;
  forceExpanded?: boolean;
  showReprocessCosts?: boolean;
  onPress?: (location: ShelfLocationState) => void;
  createEmptyLocation: (position: string, shelfCode?: string) => ShelfLocationState;
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
  isSelected = false,
  isHighlighted = false,
  compact = false,
  forceExpanded = false,
  showReprocessCosts = false,
  onPress,
  createEmptyLocation,
}) => {
  const [expanded, setExpanded] = useState(false);
  const posNum = parseInt(position, 10);
  const displayNum = posNum.toString().padStart(3, '0');
  const itemCount = location?.items.length ?? 0;
  const isEmpty = itemCount === 0;
  const isReproces = isReprocesosLocation(shelfCode, posNum);
  const isOpen = forceExpanded || expanded;

  const handleClick = () => {
    if (onPress) {
      onPress(location || createEmptyLocation(position, shelfCode));
    } else {
      if (!isEmpty) setExpanded((e) => !e);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((e2) => !e2);
  };

  // ── Card styles ────────────────────────────────────────────────
  let cardBase = 'bg-slate-900 border-slate-700/60';
  let headerText = 'text-slate-300';
  let badgeEl: React.ReactNode = null;

  if (isSelected) {
    cardBase = 'bg-cyan-500/10 border-cyan-400/50 ring-2 ring-cyan-400/70';
    headerText = 'text-cyan-200';
  } else if (isHighlighted) {
    cardBase = 'bg-yellow-500/10 border-yellow-400/40 ring-2 ring-yellow-300/60';
    headerText = 'text-yellow-200';
  } else if (isUrgent) {
    cardBase = isEmpty
      ? 'bg-red-500/[0.07] border-red-400/30'
      : 'bg-red-500/[0.13] border-red-400/40';
    headerText = 'text-red-300';
    badgeEl = (
      <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500/20 text-red-300 border border-red-400/20 rounded-md uppercase tracking-widest">
        URG
      </span>
    );
  } else if (isTechReview) {
    cardBase = isEmpty
      ? 'bg-amber-500/[0.07] border-amber-400/30'
      : 'bg-amber-500/[0.15] border-amber-400/40';
    headerText = 'text-amber-300';
    badgeEl = (
      <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/20 rounded-md uppercase tracking-widest">
        VT
      </span>
    );
  } else if (!isEmpty) {
    cardBase = 'bg-slate-800 border-slate-600/60';
    headerText = 'text-white';
  }

  if (isReproces && !isEmpty && showReprocessCosts) {
    badgeEl = (
      <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/20 rounded-md">
        €
      </span>
    );
  }

  const statusBadge = isEmpty ? (
    <span className="text-[10px] text-slate-500 font-semibold">Vacío</span>
  ) : (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
      ${isUrgent ? 'bg-red-500/20 text-red-300' : isTechReview ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-200'}`}>
      {itemCount} art.
    </span>
  );

  if (compact) {
    // Compact mode — small square cell (used in admin shelf browser)
    return (
      <button
        type="button"
        onClick={handleClick}
        title={`${shelfCode} ${displayNum}${isEmpty ? ' · Vacía' : ` · ${itemCount} artículo(s)`}`}
        className={`w-10 h-10 rounded-xl border-2 flex flex-col items-center justify-center relative
          transition-all active:scale-95 hover:-translate-y-0.5
          ${cardBase}`}
      >
        <span className={`text-[9px] font-black ${headerText}`}>{displayNum}</span>
        {!isEmpty && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-0.5" />}
      </button>
    );
  }

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden w-full
        ${cardBase}
        ${isHighlighted ? 'animate-pulse' : ''}
        ${onPress ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'}
      `}
      onClick={onPress ? handleClick : undefined}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-sm font-black shrink-0 ${headerText}`}>
            {shelfCode} {displayNum}
          </span>
          {badgeEl}
        </div>
        <div className="flex items-center gap-2">
          {statusBadge}
          {!isEmpty && (
            <button
              type="button"
              onClick={onPress ? handleToggle : () => setExpanded((e) => !e)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
              aria-label={isOpen ? 'Contraer' : 'Expandir'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content — collapsed or empty */}
      {!isOpen && (
        <div
          className={`px-3 pb-2.5 border-t border-dashed
            ${isUrgent ? 'border-red-400/20' : isTechReview ? 'border-amber-400/20' : 'border-slate-700/50'}`}
          onClick={onPress ? undefined : () => { if (!isEmpty) setExpanded(true); }}
        >
          {isEmpty ? (
            <p className="text-xs text-slate-600 text-center py-2">Sin Artículos</p>
          ) : (
            <p className="text-xs text-slate-500 pt-2">
              {location!.items[0].articleCode}
              {itemCount > 1 && <span className="text-slate-600"> +{itemCount - 1} más</span>}
            </p>
          )}
        </div>
      )}

      {/* Content — expanded */}
      {isOpen && !isEmpty && (
        <div
          className={`border-t px-3 pt-2 pb-2.5 space-y-2
            ${isUrgent ? 'border-red-400/20' : isTechReview ? 'border-amber-400/20' : 'border-slate-700/50'}`}
        >
          {location!.items.map((item, idx) => (
            <div
              key={`${item.articleCode}-${item.orderFab}-${idx}`}
              className={`rounded-xl px-3 py-2 text-left
                ${isUrgent ? 'bg-red-500/10' : isTechReview ? 'bg-amber-500/10' : 'bg-slate-900/80'}`}
            >
              <p className="text-xs font-bold text-white truncate">{item.articleCode}</p>
              <p className="text-[11px] text-cyan-400 font-semibold">{item.orderFab}</p>
              {showReprocessCosts && item.quantity != null && item.unitCost != null && item.unitCost > 0 && (
                <p className="text-[10px] text-amber-300 mt-0.5">
                  {item.quantity} ud · {(item.unitCost).toFixed(2)} €/ud
                </p>
              )}
              <p className="text-[10px] text-slate-500 mt-0.5">
                {item.locatedByName} · {formatDate(item.locatedAt)}
              </p>
            </div>
          ))}
          {onPress && (
            <button
              type="button"
              onClick={handleClick}
              className="w-full mt-1 py-1.5 text-xs font-bold text-slate-400 hover:text-white rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
              Pulsar para operar
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ShelfGridCell;
