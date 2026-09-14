import { describe, it, expect } from 'vitest';
import { computeParciales } from './parcialesCompute';

describe('computeParciales', () => {
  it('una pieza ubicada a la vez en 2 huecos es UN parcial (no 1/2 y 2/2)', () => {
    const r = computeParciales([
      { presenceId: 'a', locatedAt: '2026-09-05T08:54:58.531Z' },
      { presenceId: 'b', locatedAt: '2026-09-05T08:54:58.531Z' },
    ]);
    expect(r.get('a')).toEqual({ index: 1, total: 1 });
    expect(r.get('b')).toEqual({ index: 1, total: 1 });
  });

  it('parciales de llegadas distintas se numeran por orden de llegada', () => {
    const r = computeParciales([
      { presenceId: 'late', locatedAt: '2026-09-10T10:00:00.000Z' },
      { presenceId: 'big1', locatedAt: '2026-09-01T10:00:00.000Z' },
      { presenceId: 'big2', locatedAt: '2026-09-01T10:00:00.000Z' },
    ]);
    expect(r.get('big1')).toEqual({ index: 1, total: 2 });
    expect(r.get('big2')).toEqual({ index: 1, total: 2 });
    expect(r.get('late')).toEqual({ index: 2, total: 2 });
  });

  it('sin fecha cada presencia cuenta aparte', () => {
    const r = computeParciales([
      { presenceId: 'x', locatedAt: '' },
      { presenceId: 'y', locatedAt: '' },
    ]);
    expect(r.get('x')?.total).toBe(2);
  });
});
