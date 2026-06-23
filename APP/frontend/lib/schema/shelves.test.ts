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

  it('handles multi-segment codes (CS-001)', () => {
    const result = parseLocationId('CS-001');
    expect(result?.shelfCode).toBe('CS');
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
  // MEC ya no existe como estantería (consolidación PRENSAS-MECANIZADO → PRE).
  // La zona urgente numérica de referencia es PLE URGENTE (1-6); las urgentes
  // de PRE son posiciones string compartidas ('URG MEC-PRE 001'..004).
  it('identifies PLE urgent zone (positions 1-6) as urgent', () => {
    expect(isUrgentLocation('PLE', 1)).toBe(true);
    expect(isUrgentLocation('PLE', 6)).toBe(true);
  });

  it('does not flag PLE non-urgent positions', () => {
    expect(isUrgentLocation('PLE', 7)).toBe(false);
    expect(isUrgentLocation('PLE', 64)).toBe(false);
  });

  it('works with locationId string form', () => {
    expect(isUrgentLocation('PLE-001')).toBe(true);
    expect(isUrgentLocation('PLE-007')).toBe(false);
  });

  it('identifies PRE shared urgent string positions by URG prefix', () => {
    expect(isUrgentLocation('PRE-URG MEC-PRE 001')).toBe(true);
  });

  it('returns false for unknown shelf codes', () => {
    expect(isUrgentLocation('XYZ-001')).toBe(false);
  });

  it('respects config.urgentLocations (adds to zone definition, not replaces)', () => {
    const config = {
      urgentLocations: ['PLE-010'],
      techReviewLocations: [],
      chiefMapping: {},
      qualityEmails: [],
      operarioRefreshInterval: 300000,
    };
    // PLE-010 is in the config override → urgent
    expect(isUrgentLocation('PLE-010', config)).toBe(true);
    // PLE-001 is in the hardcoded urgent zone (1-6) → still urgent regardless of config
    expect(isUrgentLocation('PLE-001', config)).toBe(true);
    // PLE-020 is not in config, not in urgent zone → not urgent
    expect(isUrgentLocation('PLE-020', config)).toBe(false);
  });
});

// ── isTechReviewLocation ──────────────────────────────────────────────────────

describe('isTechReviewLocation', () => {
  it('identifies CAL tech-review zone (positions 31 and 34) as tech-review', () => {
    expect(isTechReviewLocation('CAL', 31)).toBe(true);
    expect(isTechReviewLocation('CAL', 34)).toBe(true);
  });

  it('does not flag CAL non-tech-review positions', () => {
    expect(isTechReviewLocation('CAL', 1)).toBe(false);
    expect(isTechReviewLocation('CAL', 23)).toBe(false);
  });

  it('works with locationId string form', () => {
    expect(isTechReviewLocation('CAL-031')).toBe(true);
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
    // CAL-031 is in the hardcoded tech-review zone → still tech review regardless of config
    expect(isTechReviewLocation('CAL-031', config)).toBe(true);
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
    const shelf = getShelfDefinition('PRE');
    expect(shelf).toBeDefined();
    expect(shelf?.code).toBe('PRE');
    expect(shelf?.section).toBe('PRENSAS_MECANIZADO');
  });

  it('returns undefined for unknown code', () => {
    expect(getShelfDefinition('UNKNOWN')).toBeUndefined();
  });

  it('returns cart definitions', () => {
    const cart = getShelfDefinition('CS');
    expect(cart).toBeDefined();
    expect(cart?.type).toBe('cart');
  });
});

// ── generatePositions ─────────────────────────────────────────────────────────

describe('generatePositions', () => {
  it('generates all PRE positions (4 URG compartidas + 9 prensas + 33 mecanizado = 46)', () => {
    const pre = getShelfDefinition('PRE')!;
    const positions = generatePositions(pre);
    expect(positions).toHaveLength(46);
    // Las urgentes compartidas son posiciones string y van primero (bloque URG)
    expect(positions[0]).toBe('URG MEC-PRE 001');
    // Las numéricas van 0-padded
    expect(positions).toContain('001');
    expect(positions).toContain('009');
    expect(positions).toContain('046');
  });

  it('generates 4 positions for carts (CS)', () => {
    const cs = getShelfDefinition('CS')!;
    expect(generatePositions(cs)).toEqual(['001', '002', '003', '004']);
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


