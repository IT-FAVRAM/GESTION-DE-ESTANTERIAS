import { describe, it, expect } from 'vitest';
import { computeShelfKpis, isUrgentPosition } from './shelfKpis';
import { getShelfDefinition } from './schema/shelves';
import type { ShelfLocationState } from './schema/locations';

const item = (articleCode: string) => ({
  articleCode,
  orderFab: 'OF1',
  locatedBy: 'u',
  locatedByName: 'U',
  locatedAt: '2026-09-11T08:00:00.000Z',
});

const loc = (position: string, codes: string[] = [], isEmpty = codes.length === 0): ShelfLocationState => ({
  position,
  items: codes.map(item),
  isEmpty,
  locationId: `X-${position}`,
});

describe('isUrgentPosition', () => {
  it('zonas urgentes numéricas del layout', () => {
    expect(isUrgentPosition('PLE', '003')).toBe(true);
    expect(isUrgentPosition('PLE', '007')).toBe(false);
    expect(isUrgentPosition('REP', '004')).toBe(true);
    expect(isUrgentPosition('SOL', '001')).toBe(true);
    expect(isUrgentPosition('CAL', '029')).toBe(true);
    expect(isUrgentPosition('CAL', '031')).toBe(false);
  });

  it('slots de texto: URG por nombre, suelo nunca', () => {
    expect(isUrgentPosition('PRE', 'URG MEC-PRE 004')).toBe(true);
    expect(isUrgentPosition('PIN', 'SUELO')).toBe(false);
    expect(isUrgentPosition('CAM', 'SUELO AMADA')).toBe(false);
  });
});

describe('computeShelfKpis', () => {
  it('cuenta los artículos en celdas urgentes aunque no haya alertas (bug KPI Urgencias=0)', () => {
    const ple = getShelfDefinition('PLE')!;
    const kpis = computeShelfKpis([loc('003', ['A']), loc('006', ['B', 'C']), loc('008', ['D'])], ple);
    expect(kpis.urgentArticles).toBe(3);
    expect(kpis.urgentZoneArticles).toBe(3);
    expect(kpis.urgentSlotsOccupied).toBe(2);
    expect(kpis.urgentSlotsTotal).toBe(6);
    expect(kpis.totalArticles).toBe(4);
  });

  it('PRE: la ubicación compartida URG MEC-PRE cuenta como urgente', () => {
    const pre = getShelfDefinition('PRE')!;
    const kpis = computeShelfKpis([loc('URG MEC-PRE 004', ['A']), loc('001', ['B'])], pre);
    expect(kpis.urgentArticles).toBe(1);
    expect(kpis.urgentSlotsTotal).toBe(4);
  });

  it('suma artículos con alerta activa fuera de zona urgente sin contarlos dos veces', () => {
    const ple = getShelfDefinition('PLE')!;
    const kpis = computeShelfKpis(
      [loc('003', ['A']), loc('020', ['A', 'Z'])],
      ple,
      new Set(['A']),
    );
    // 003:A (zona+alerta) + 020:A (alerta) = 2; Z no es urgente.
    expect(kpis.urgentArticles).toBe(2);
    expect(kpis.urgentZoneArticles).toBe(1);
    expect(kpis.urgentAlertArticles).toBe(2);
  });

  it('el universo de huecos es el layout: huérfanos fuera, celdas sin doc cuentan como vacías', () => {
    const cp1 = getShelfDefinition('CP1')!;
    // Datos reales: CP1 tiene docs "001","002","003" y huérfanos "1".."4".
    const kpis = computeShelfKpis(
      [loc('001'), loc('002', ['A', 'B']), loc('003'), loc('1', ['FANTASMA']), loc('2')],
      cp1,
    );
    expect(kpis.totalSlots).toBe(4);
    expect(kpis.occupiedSlots).toBe(1);
    expect(kpis.emptySlots).toBe(3);
    expect(kpis.totalArticles).toBe(2);
    expect(kpis.pct).toBe(25);
  });

  it('capacidad = celdas dibujadas (PRE 46, PLE 67), no locationCount', () => {
    expect(computeShelfKpis([], getShelfDefinition('PRE')!).totalSlots).toBe(46);
    expect(computeShelfKpis([], getShelfDefinition('PLE')!).totalSlots).toBe(67);
  });

  it('la franja de suelo cuenta como hueco (CAM = 4 baldas + SUELO AMADA)', () => {
    const cam = getShelfDefinition('CAM')!;
    const kpis = computeShelfKpis([loc('SUELO AMADA', ['A'])], cam);
    expect(kpis.totalSlots).toBe(5);
    expect(kpis.occupiedSlots).toBe(1);
  });

  it('ocupación por items, no por el flag isEmpty', () => {
    const aro = getShelfDefinition('ARO')!;
    const kpis = computeShelfKpis([loc('001', [], false), loc('002', ['A'], true)], aro);
    expect(kpis.occupiedSlots).toBe(1);
  });
});
