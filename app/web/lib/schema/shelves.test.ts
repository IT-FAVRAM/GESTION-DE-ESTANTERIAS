import { describe, it, expect } from 'vitest';
import {
  parseLocationId,
  getLocationDocId,
  isUrgentLocation,
  isTechReviewLocation,
  isAluminioLocation,
  isReprocesosLocation,
  getShelfDefinition,
  generatePositions,
  ALL_SHELVES,
  SHELF_DEFINITIONS,
} from './shelves';

// ── parseLocationId ───────────────────────────────────────────────────────────

describe('parseLocationId', () => {
  it('parses a standard locationId', () => {
    const result = parseLocationId('MEC-031');
    expect(result).toEqual({ shelfCode: 'MEC', position: '031' });
  });

  it('parses a CAL locationId', () => {
    const result = parseLocationId('CAL-022');
    expect(result).toEqual({ shelfCode: 'CAL', position: '022' });
  });

  it('returns null for a locationId with no dash', () => {
    expect(parseLocationId('INVALID')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseLocationId('')).toBeNull();
  });

  it('handles multi-segment codes (RSOL-001)', () => {
    const result = parseLocationId('RSOL-001');
    expect(result?.shelfCode).toBe('RSOL');
    expect(result?.position).toBe('001');
  });
});

// ── getLocationDocId ──────────────────────────────────────────────────────────

describe('getLocationDocId', () => {
  it('pads numeric positions to 3 digits', () => {
    expect(getLocationDocId('MEC', 1)).toBe('MEC-001');
    expect(getLocationDocId('MEC', 9)).toBe('MEC-009');
    expect(getLocationDocId('MEC', 34)).toBe('MEC-034');
  });

  it('passes string positions through as-is', () => {
    expect(getLocationDocId('CAL', '031')).toBe('CAL-031');
  });
});

// ── isReprocesosLocation ──────────────────────────────────────────────────────

describe('isReprocesosLocation', () => {
  it('identifies CAL 001-022 as reprocesos (shelfCode+position form)', () => {
    expect(isReprocesosLocation('CAL', 1)).toBe(true);
    expect(isReprocesosLocation('CAL', 22)).toBe(true);
  });

  it('excludes CAL 023+ from reprocesos (shelfCode+position form)', () => {
    expect(isReprocesosLocation('CAL', 23)).toBe(false);
    expect(isReprocesosLocation('CAL', 34)).toBe(false);
  });

  it('excludes non-CAL shelves (shelfCode+position form)', () => {
    expect(isReprocesosLocation('PRE', 1)).toBe(false);
    expect(isReprocesosLocation('MEC', 5)).toBe(false);
  });

  it('identifies CAL 001-022 as reprocesos (locationId form)', () => {
    expect(isReprocesosLocation('CAL-001')).toBe(true);
    expect(isReprocesosLocation('CAL-022')).toBe(true);
  });

  it('excludes CAL 023+ from reprocesos (locationId form)', () => {
    expect(isReprocesosLocation('CAL-023')).toBe(false);
  });

  it('excludes non-CAL shelves (locationId form)', () => {
    expect(isReprocesosLocation('PRE-001')).toBe(false);
    expect(isReprocesosLocation('MEC-005')).toBe(false);
  });
});

// ── isUrgentLocation ──────────────────────────────────────────────────────────

describe('isUrgentLocation', () => {
  it('identifies MEC urgent zone (positions 1-4) as urgent', () => {
    expect(isUrgentLocation('MEC', 1)).toBe(true);
    expect(isUrgentLocation('MEC', 4)).toBe(true);
  });

  it('does not flag MEC non-urgent positions', () => {
    expect(isUrgentLocation('MEC', 5)).toBe(false);
    expect(isUrgentLocation('MEC', 34)).toBe(false);
  });

  it('works with locationId string form', () => {
    expect(isUrgentLocation('MEC-001')).toBe(true);
    expect(isUrgentLocation('MEC-005')).toBe(false);
  });

  it('returns false for unknown shelf codes', () => {
    expect(isUrgentLocation('XYZ-001')).toBe(false);
  });

  it('respects config.urgentLocations (adds to zone definition, not replaces)', () => {
    const config = {
      urgentLocations: ['MEC-010'],
      techReviewLocations: [],
      chiefMapping: {},
      qualityEmails: [],
      operarioRefreshInterval: 300000,
    };
    // MEC-010 is in the config override → urgent
    expect(isUrgentLocation('MEC-010', config)).toBe(true);
    // MEC-001 is in the hardcoded urgent zone (1-4) → still urgent regardless of config
    expect(isUrgentLocation('MEC-001', config)).toBe(true);
    // MEC-005 is not in config, not in urgent zone → not urgent
    expect(isUrgentLocation('MEC-005', config)).toBe(false);
  });
});

// ── isTechReviewLocation ──────────────────────────────────────────────────────

describe('isTechReviewLocation', () => {
  it('identifies CAL tech-review zone (position 29) as tech-review', () => {
    expect(isTechReviewLocation('CAL', 29)).toBe(true);
    expect(isTechReviewLocation('CAL', 32)).toBe(true);
  });

  it('does not flag CAL non-tech-review positions', () => {
    expect(isTechReviewLocation('CAL', 1)).toBe(false);
    expect(isTechReviewLocation('CAL', 23)).toBe(false);
  });

  it('works with locationId string form', () => {
    expect(isTechReviewLocation('CAL-029')).toBe(true);
    expect(isTechReviewLocation('CAL-001')).toBe(false);
  });

  it('respects config.techReviewLocations (adds to zone definition, not replaces)', () => {
    const config = {
      urgentLocations: [],
      techReviewLocations: ['CAL-005'],
      chiefMapping: {},
      qualityEmails: [],
      operarioRefreshInterval: 300000,
    };
    // CAL-005 is in the config override → tech review
    expect(isTechReviewLocation('CAL-005', config)).toBe(true);
    // CAL-029 is in the hardcoded tech-review zone → still tech review regardless of config
    expect(isTechReviewLocation('CAL-029', config)).toBe(true);
    // CAL-001 is not in config, not in tech-review zone → not tech review
    expect(isTechReviewLocation('CAL-001', config)).toBe(false);
  });
});

// ── isAluminioLocation ────────────────────────────────────────────────────────

describe('isAluminioLocation', () => {
  it('identifies REP ALUMINIO zone (5-14) correctly', () => {
    expect(isAluminioLocation('REP', 5)).toBe(true);
    expect(isAluminioLocation('REP', 14)).toBe(true);
  });

  it('does not flag REP positions outside the ALUMINIO zone', () => {
    expect(isAluminioLocation('REP', 4)).toBe(false);
    expect(isAluminioLocation('REP', 15)).toBe(false);
  });

  it('works with locationId string form', () => {
    expect(isAluminioLocation('REP-005')).toBe(true);
    expect(isAluminioLocation('REP-015')).toBe(false);
  });

  it('returns false for invalid locationId', () => {
    expect(isAluminioLocation('INVALID')).toBe(false);
  });
});

// ── getShelfDefinition ────────────────────────────────────────────────────────

describe('getShelfDefinition', () => {
  it('returns definition for known shelves', () => {
    const shelf = getShelfDefinition('MEC');
    expect(shelf).toBeDefined();
    expect(shelf?.code).toBe('MEC');
    expect(shelf?.section).toBe('MECANIZADO');
  });

  it('returns undefined for unknown code', () => {
    expect(getShelfDefinition('UNKNOWN')).toBeUndefined();
  });

  it('returns cart definitions', () => {
    const cart = getShelfDefinition('RSOL');
    expect(cart).toBeDefined();
    expect(cart?.type).toBe('cart');
  });
});

// ── generatePositions ─────────────────────────────────────────────────────────

describe('generatePositions', () => {
  it('generates 0-padded positions up to locationCount', () => {
    const pre = getShelfDefinition('PRE')!;
    const positions = generatePositions(pre);
    expect(positions).toHaveLength(9);
    expect(positions[0]).toBe('001');
    expect(positions[8]).toBe('009');
  });

  it('generates 34 positions for MEC', () => {
    const mec = getShelfDefinition('MEC')!;
    expect(generatePositions(mec)).toHaveLength(34);
  });
});

// ── ALL_SHELVES sanity ────────────────────────────────────────────────────────

describe('ALL_SHELVES', () => {
  it('contains all shelf definitions and cart definitions', () => {
    expect(ALL_SHELVES.length).toBeGreaterThan(SHELF_DEFINITIONS.length);
  });

  it('every shelf has a unique code', () => {
    const codes = ALL_SHELVES.map((s) => s.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('every shelf has at least one zone', () => {
    ALL_SHELVES.forEach((s) => {
      expect(s.layout.zones.length).toBeGreaterThan(0);
    });
  });

  it('every zone range has start <= end', () => {
    ALL_SHELVES.forEach((s) => {
      s.layout.zones.forEach((z) => {
        expect(z.range[0]).toBeLessThanOrEqual(z.range[1]);
      });
    });
  });
});
