/**
 * ShelfRackView — Visualización industrial de estantería de paletería.
 * Renderiza postes, largueros, baldas y huecos usando CSS puro.
 * Sin dependencias adicionales. Solo cambia la visual, no la lógica.
 */

import React from 'react';
import type { ShelfLocationState } from '../../hooks/useShelf';
import type { ShelfPhysicalBlock } from '../../lib/firestoreSchema';
import type { CellDragData } from './ShelfGridCell';
import {
  isUrgentLocation,
  isTechReviewLocation,
  isAluminioLocation,
  isReprocesosLocation,
} from '../../lib/firestoreSchema';

// ─── Paletas de color de estructura (basadas en fotos reales) ─────────────────
// Azul industrial: CALIDAD, PLEGADORA, MEC, PRE, SXP, ZIN, ROB_PLE, REP...
// Naranja industrial: PINTURA, ROB_SOLDADURA, ROB_PLE (est2), COM (grande)
// Burdeos: REPROCESOS (la estantería roja oscura de Calidad)

const PALETTES = {
  blue: {
    post: 'linear-gradient(90deg, #0D2E57 0%, #2B72C5 38%, #1E5FA8 62%, #0D2E57 100%)',
    beam: 'linear-gradient(180deg, #1A5096 0%, #0E2D5A 100%)',
    base: 'linear-gradient(180deg, #0E2D5A 0%, #07192F 100%)',
    shelfSurface: 'linear-gradient(180deg, #4B5563 0%, #374151 100%)',
    postReflect: 'rgba(43, 114, 197, 0.25)',
  },
  orange: {
    post: 'linear-gradient(90deg, #6B2D0E 0%, #D4622A 38%, #C05621 62%, #6B2D0E 100%)',
    beam: 'linear-gradient(180deg, #B54F1E 0%, #7A3515 100%)',
    base: 'linear-gradient(180deg, #7A3515 0%, #4A1F0A 100%)',
    shelfSurface: 'linear-gradient(180deg, #4B5563 0%, #374151 100%)',
    postReflect: 'rgba(212, 98, 42, 0.25)',
  },
  sky: {
    post: 'linear-gradient(90deg, #082f49 0%, #0ea5e9 38%, #0284c7 62%, #082f49 100%)',
    beam: 'linear-gradient(180deg, #0369a1 0%, #082f49 100%)',
    base: 'linear-gradient(180deg, #082f49 0%, #03111f 100%)',
    shelfSurface: 'linear-gradient(180deg, #4B5563 0%, #374151 100%)',
    postReflect: 'rgba(14, 165, 233, 0.25)',
  },
  purple: {
    post: 'linear-gradient(90deg, #2e1065 0%, #7c3aed 38%, #6d28d9 62%, #2e1065 100%)',
    beam: 'linear-gradient(180deg, #5b21b6 0%, #3b0764 100%)',
    base: 'linear-gradient(180deg, #3b0764 0%, #1a032e 100%)',
    shelfSurface: 'linear-gradient(180deg, #4B5563 0%, #374151 100%)',
    postReflect: 'rgba(139, 92, 246, 0.25)',
  },
} as const;

type PaletteKey = keyof typeof PALETTES;

function getPaletteKey(shelfCode: string, zoneName?: string): PaletteKey {
  // Reprocesos de Calidad → estantería morada
  if (shelfCode === 'CAL' && zoneName?.toUpperCase().includes('REPROC')) return 'purple';
  // Aluminio → estantería cielo/azul
  if (shelfCode === 'ALU' || zoneName?.toUpperCase().includes('ALUMINIO')) return 'sky';
  // Naranja: mecanizado (postes rojo-naranja en foto), pintura, robots, autoplegadora
  if (['MEC', 'PIN', 'RPL', 'RSO'].includes(shelfCode)) return 'orange';
  return 'blue';
}

function getSlotMinH(_rowCount: number): number {
  return 90;
}

// ─── RackSlot — hueco individual ──────────────────────────────────────────────

interface RackSlotProps {
  position: string;
  posNum: number;
  location?: ShelfLocationState;
  shelfCode: string;
  isUrgent: boolean;
  isTechReview: boolean;
  isAluminio: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isDragOver?: boolean;
  showReprocessCosts: boolean;
  onPress?: (loc: ShelfLocationState) => void;
  createEmpty: (pos: string, code?: string) => ShelfLocationState;
  minHeight: number;
  shelfSurface: string;
  onCellDragStart?: (data: CellDragData) => void;
  onCellDragEnter?: (position: string) => void;
  onCellDragLeave?: () => void;
  onCellDrop?: (targetPosition: string) => void;
}

const RackSlot: React.FC<RackSlotProps> = ({
  position, posNum, location, shelfCode,
  isUrgent, isTechReview, isAluminio, isSelected, isHighlighted, isDragOver,
  showReprocessCosts, onPress, createEmpty, minHeight, shelfSurface,
  onCellDragStart, onCellDragEnter, onCellDragLeave, onCellDrop,
}) => {
  const items = location?.items ?? [];
  const isEmpty = items.length === 0;
  const isReproces = isReprocesosLocation(shelfCode, posNum);
  const isDraggable = !isEmpty && !!onCellDragStart;

  const handleClick = () => {
    if (onPress) onPress(location ?? createEmpty(position, shelfCode));
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

  // ── Clases visuales según estado — tema claro (blanco hueso) ─────────────────
  let wrapBg = '#FAFAF7';
  let wrapBorder = 'rgba(148,163,184,0.5)';
  let wrapShadow = 'inset 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)';
  let itemBg = 'rgba(219,234,254,0.75)';
  let artColor = '#1e293b';
  let ofColor = '#475569';
  let posColor = 'rgba(100,116,139,0.85)';
  let emptyColor = 'rgba(148,163,184,0.7)';
  let badgeEl: React.ReactNode = null;

  if (isSelected) {
    wrapBg = 'rgba(224,242,254,0.9)';
    wrapBorder = 'rgba(14,165,233,0.7)';
    wrapShadow = '0 0 0 2px rgba(14,165,233,0.4), inset 0 1px 3px rgba(0,0,0,0.04)';
    itemBg = 'rgba(186,230,253,0.8)';
    artColor = '#0c4a6e';
    ofColor = '#075985';
    posColor = 'rgba(14,165,233,0.9)';
    emptyColor = 'rgba(14,165,233,0.5)';
  } else if (isHighlighted) {
    wrapBg = 'rgba(255,251,235,0.95)';
    wrapBorder = 'rgba(234,179,8,0.7)';
    wrapShadow = '0 0 0 2px rgba(234,179,8,0.35), inset 0 1px 3px rgba(0,0,0,0.04)';
    itemBg = 'rgba(254,243,199,0.9)';
    artColor = '#713f12';
    ofColor = '#92400e';
    posColor = 'rgba(234,179,8,0.9)';
    emptyColor = 'rgba(234,179,8,0.5)';
  } else if (isUrgent) {
    wrapBg = isEmpty ? 'rgba(255,241,242,0.9)' : 'rgba(254,226,226,0.95)';
    wrapBorder = isEmpty ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.65)';
    wrapShadow = isEmpty
      ? 'inset 0 1px 3px rgba(0,0,0,0.04)'
      : '0 0 0 1.5px rgba(239,68,68,0.4), inset 0 1px 3px rgba(0,0,0,0.04)';
    itemBg = 'rgba(254,202,202,0.8)';
    artColor = '#7f1d1d';
    ofColor = '#991b1b';
    posColor = 'rgba(239,68,68,0.8)';
    emptyColor = 'rgba(239,68,68,0.4)';
    badgeEl = (
      <span
        style={{
          display: 'flex', alignItems: 'center', gap: 2, padding: '1px 4px',
          fontSize: 7, fontWeight: 900, background: '#dc2626',
          color: '#fff', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.05em',
          lineHeight: 1.4, flexShrink: 0,
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fca5a5', animation: 'pulse 1.5s infinite' }} />
        URG
      </span>
    );
  } else if (isTechReview || isAluminio) {
    wrapBg = isEmpty ? 'rgba(255,251,235,0.85)' : 'rgba(254,243,199,0.9)';
    wrapBorder = isEmpty ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.6)';
    wrapShadow = '0 0 0 1px rgba(245,158,11,0.2), inset 0 1px 3px rgba(0,0,0,0.04)';
    itemBg = 'rgba(253,230,138,0.7)';
    artColor = '#713f12';
    ofColor = '#92400e';
    posColor = 'rgba(245,158,11,0.8)';
    emptyColor = 'rgba(245,158,11,0.45)';
    if (isTechReview) {
      badgeEl = (
        <span
          style={{
            padding: '1px 4px', fontSize: 7, fontWeight: 900, background: '#d97706',
            color: '#fff', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.05em',
            lineHeight: 1.4, flexShrink: 0,
          }}
        >
          VT
        </span>
      );
    }
  }

  return (
    <div
      role={onPress || isDraggable ? 'button' : undefined}
      tabIndex={onPress ? 0 : undefined}
      onClick={onPress ? handleClick : undefined}
      onKeyDown={onPress ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); } : undefined}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight,
        background: isDragOver ? 'rgba(52,211,153,0.15)' : wrapBg,
        border: isDragOver ? '2px solid rgba(52,211,153,0.8)' : `1px solid ${wrapBorder}`,
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: isDragOver ? '0 0 0 2px rgba(52,211,153,0.4)' : wrapShadow,
        cursor: isDraggable ? 'grab' : (onPress ? 'pointer' : 'default'),
        transition: 'filter 0.12s, transform 0.1s, background 0.1s, border 0.1s',
      }}
      onMouseEnter={e => { if (onPress || isDraggable) (e.currentTarget as HTMLDivElement).style.filter = 'brightness(1.15)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.filter = 'brightness(1)'; }}
      {...dragProps}
      {...dropProps}
    >
      {/* Posición + badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 5px 0', gap: 3, flexShrink: 0 }}>
        <span style={{ fontSize: 8, fontWeight: 900, fontFamily: 'monospace', color: posColor, lineHeight: 1 }}>
          {position}
        </span>
        {badgeEl}
        {isReproces && showReprocessCosts && !badgeEl && (
          <span style={{ fontSize: 8, color: '#fbbf24', fontWeight: 700, lineHeight: 1 }}>€</span>
        )}
      </div>

      {/* Cuerpo del hueco */}
      {isEmpty ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, opacity: 0.4 }}>
            <div style={{ width: 22, height: 2, background: emptyColor, borderRadius: 1 }} />
            <div style={{ width: 14, height: 2, background: emptyColor, borderRadius: 1 }} />
          </div>
          <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: emptyColor }}>
            vacío
          </span>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '3px 4px 2px', gap: 2, minHeight: 0 }}>
          {items.map((item, i) => (
            <div
              key={`${item.articleCode}-${item.orderFab}-${i}`}
              style={{
                background: itemBg,
                borderRadius: 3,
                padding: '3px 5px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                borderLeft: `3px solid ${artColor}`,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <p style={{ fontSize: 10, fontWeight: 900, fontFamily: 'monospace', color: artColor, lineHeight: 1.15, wordBreak: 'break-all', margin: 0 }}>
                {item.articleCode}
              </p>
              <p style={{ fontSize: 8, fontWeight: 600, fontFamily: 'monospace', color: ofColor, lineHeight: 1.15, wordBreak: 'break-all', margin: '1px 0 0' }}>
                {item.orderFab}
              </p>
              {showReprocessCosts && item.unitCost != null && item.unitCost > 0 && (
                <p style={{ fontSize: 7.5, color: '#fcd34d', fontFamily: 'monospace', margin: '1px 0 0', lineHeight: 1 }}>
                  {item.unitCost.toFixed(2)} €/ud
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Indicador de carga */}
      <div style={{ height: 3, margin: '0 4px 3px', background: 'rgba(0,0,0,0.1)', borderRadius: 2, flexShrink: 0, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: isEmpty ? '0%' : `${Math.min((items.length / 3) * 100, 100)}%`,
            background: isSelected ? 'rgba(34,211,238,0.9)'
              : isHighlighted ? 'rgba(251,191,36,0.9)'
              : isUrgent ? 'rgba(239,68,68,0.85)'
              : (isTechReview || isAluminio) ? 'rgba(245,158,11,0.85)'
              : items.length <= 1 ? 'rgba(16,185,129,0.9)'
              : items.length === 2 ? 'rgba(245,158,11,0.85)'
              : 'rgba(239,68,68,0.85)',
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Balda / superficie de la estantería */}
      <div style={{ height: 5, background: shelfSurface, flexShrink: 0, borderRadius: '0 0 3px 3px' }} />
    </div>
  );
};

// ─── ShelfRackView — estantería completa ─────────────────────────────────────

export interface ShelfRackViewProps {
  block: ShelfPhysicalBlock;
  shelfCode: string;
  locationMap: Map<string, ShelfLocationState>;
  selectedPositions: string[];
  highlightedPositions: string[];
  dragOverPosition?: string | null;
  onCellPress?: (location: ShelfLocationState) => void;
  showReprocessCosts: boolean;
  createEmptyLocation: (position: string, shelfCode?: string) => ShelfLocationState;
  onCellDragStart?: (data: CellDragData) => void;
  onCellDragEnter?: (position: string) => void;
  onCellDragLeave?: () => void;
  onCellDrop?: (targetPosition: string) => void;
}

const ShelfRackView: React.FC<ShelfRackViewProps> = ({
  block,
  shelfCode,
  locationMap,
  selectedPositions,
  highlightedPositions,
  dragOverPosition,
  onCellPress,
  showReprocessCosts,
  createEmptyLocation,
  onCellDragStart,
  onCellDragEnter,
  onCellDragLeave,
  onCellDrop,
}) => {
  const pk = getPaletteKey(shelfCode, block.zoneName);
  const palette = PALETTES[pk];
  const rowCount = block.rows.length;
  const slotMinH = getSlotMinH(rowCount);

  // Dimensiones estructurales del rack
  const POST_W = 14;   // ancho de los postes verticales (px)
  const BEAM_H = 10;   // alto de los largueros horizontales (px)
  const TOP_H = 16;    // marco superior del rack (px)
  const BASE_H = 20;   // placa base inferior (px)
  const FOOT_H = 8;    // patas del rack (px)

  // Calcular ancho mínimo: slots × 70px + gaps + postes + padding interno
  const maxCols = Math.max(...block.rows.map((r) => r.length), 1);
  const SLOT_MIN_W = 70;
  const calculatedMinWidth = POST_W * 2 + 12 + maxCols * SLOT_MIN_W + (maxCols - 1) * 4;

  return (
    <div
      style={{
        width: `max(100%, ${calculatedMinWidth}px)`,
        display: 'flex',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
        background: '#F5F2EC',
      }}
    >
      {/* ── Poste izquierdo ───────────────────────────────────────────────── */}
      <div
        style={{
          width: POST_W,
          flexShrink: 0,
          background: palette.post,
          // Reflejo vertical para dar efecto metálico
          boxShadow: `inset -2px 0 4px rgba(0,0,0,0.4), inset 2px 0 3px ${palette.postReflect}`,
        }}
      />

      {/* ── Cuerpo del rack ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#EDE9E0' }}>

        {/* Marco superior */}
        <div
          style={{
            height: TOP_H,
            flexShrink: 0,
            background: palette.beam,
            boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
          }}
        />

        {/* Niveles (filas de huecos) */}
        {block.rows.map((row, rowIdx) => (
          <React.Fragment key={rowIdx}>
            {/* Larguero entre niveles (excepto el primero que ya tiene el marco superior) */}
            {rowIdx > 0 && (
              <div
                style={{
                  height: BEAM_H,
                  flexShrink: 0,
                  background: palette.beam,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                }}
              />
            )}

            {/* Fila de huecos */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: '6px 6px',
                minHeight: slotMinH,
                alignItems: 'stretch',
              }}
            >
              {row.map((posNum, colIdx) => {
                // null = hueco vacío visual (separación entre grupos de slots)
                if (posNum === null) {
                  return (
                    <div
                      key={`gap-${rowIdx}-${colIdx}`}
                      style={{ flex: 1, visibility: 'hidden' }}
                    />
                  );
                }

                const pos = posNum.toString().padStart(3, '0');
                return (
                  <RackSlot
                    key={pos}
                    position={pos}
                    posNum={posNum}
                    location={locationMap.get(pos)}
                    shelfCode={shelfCode}
                    isUrgent={isUrgentLocation(shelfCode, posNum)}
                    isTechReview={isTechReviewLocation(shelfCode, posNum)}
                    isAluminio={isAluminioLocation(shelfCode, posNum)}
                    isSelected={selectedPositions.includes(pos)}
                    isHighlighted={highlightedPositions.includes(pos)}
                    isDragOver={dragOverPosition === pos}
                    showReprocessCosts={showReprocessCosts}
                    onPress={onCellPress}
                    createEmpty={createEmptyLocation}
                    minHeight={slotMinH - 12}
                    shelfSurface={palette.shelfSurface}
                    onCellDragStart={onCellDragStart}
                    onCellDragEnter={onCellDragEnter}
                    onCellDragLeave={onCellDragLeave}
                    onCellDrop={onCellDrop}
                  />
                );
              })}
            </div>
          </React.Fragment>
        ))}

        {/* Placa base */}
        <div
          style={{
            height: BASE_H,
            flexShrink: 0,
            background: palette.base,
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)',
          }}
        />

        {/* Patas del rack */}
        <div style={{ height: FOOT_H, flexShrink: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', background: '#030508' }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                width: 16,
                height: FOOT_H,
                background: palette.beam,
                borderRadius: '0 0 3px 3px',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Poste derecho ─────────────────────────────────────────────────── */}
      <div
        style={{
          width: POST_W,
          flexShrink: 0,
          background: palette.post,
          boxShadow: `inset 2px 0 4px rgba(0,0,0,0.4), inset -2px 0 3px ${palette.postReflect}`,
        }}
      />
    </div>
  );
};

export default ShelfRackView;


