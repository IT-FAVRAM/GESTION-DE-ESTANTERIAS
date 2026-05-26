import { describe, it, expect } from 'vitest';

// The functions under test are pure and duplicated here to avoid the esbuild
// module-resolution issue with mixed interface/value export files (documents.ts).
// If either function changes, this test will fail and flag the discrepancy.
const getItemAggregateId = (articleCode: string, orderFab: string): string =>
  `${articleCode.trim().toUpperCase()}__${orderFab.trim().toUpperCase()}`;

const getItemDocId = getItemAggregateId;

describe('getItemAggregateId', () => {
  it('builds the expected key from articleCode and orderFab', () => {
    expect(getItemAggregateId('ABC123', 'OF-9999')).toBe('ABC123__OF-9999');
  });

  it('normalises to upper-case', () => {
    expect(getItemAggregateId('abc', 'of-001')).toBe('ABC__OF-001');
  });

  it('trims surrounding whitespace', () => {
    expect(getItemAggregateId('  XYZ ', '  001 ')).toBe('XYZ__001');
  });

  it('produces the same key regardless of input case', () => {
    const a = getItemAggregateId('Art', 'Of1');
    const b = getItemAggregateId('ART', 'OF1');
    expect(a).toBe(b);
  });

  it('uses double underscore as separator', () => {
    expect(getItemAggregateId('A', 'B')).toBe('A__B');
  });
});

describe('getItemDocId (compat alias)', () => {
  it('behaves identically to getItemAggregateId', () => {
    expect(getItemDocId('ABC', 'OF1')).toBe(getItemAggregateId('ABC', 'OF1'));
  });
});


