import { describe, it, expect } from 'vitest';
import { normalizeOf, isLookupableOf, canonicalOrderFab, isBareOfPrefix, isOverlongOf } from './ofNormalize';

describe('normalizeOf', () => {
  it('deja intacta una OF ya canónica', () => {
    expect(normalizeOf('OF26-05315')).toBe('OF26-05315');
  });

  it('rellena con ceros hasta 5 dígitos (el ERP devuelve 0 filas sin esto)', () => {
    expect(normalizeOf('OF26-5315')).toBe('OF26-05315');
    expect(normalizeOf('OF26-911')).toBe('OF26-00911');
    expect(normalizeOf('OF26-1')).toBe('OF26-00001');
  });

  it('conserva el año que escriba el operario, no lo hardcodea', () => {
    // Regresión: el proxy antiguo forzaba "OF26-" y rompía las OFs de 2025.
    expect(normalizeOf('OF25-06771')).toBe('OF25-06771');
    expect(normalizeOf('OF24-123')).toBe('OF24-00123');
  });

  it('tolera minúsculas, espacios y separadores alternativos', () => {
    expect(normalizeOf('of26-05315')).toBe('OF26-05315');
    expect(normalizeOf('  OF26-05315  ')).toBe('OF26-05315');
    expect(normalizeOf('OF26 5315')).toBe('OF26-05315');
    expect(normalizeOf('OF26_5315')).toBe('OF26-05315');
    expect(normalizeOf('OF265315')).toBe('OF26-05315');
    expect(normalizeOf('OF26 - 5315')).toBe('OF26-05315');
  });

  it('rechaza entradas sin año, que serían ambiguas', () => {
    // "05315" podría ser OF25, OF26… no se puede adivinar sin arriesgar
    // devolver el artículo de otra OF.
    expect(normalizeOf('05315')).toBeNull();
    expect(normalizeOf('5315')).toBeNull();
  });

  it('rechaza los centinelas de "sin OF"', () => {
    expect(normalizeOf('SIN-OF')).toBeNull();
    expect(normalizeOf('GENERAL')).toBeNull();
    expect(normalizeOf('SIN-REF')).toBeNull();
  });

  it('rechaza vacíos, basura y OFs a cero', () => {
    expect(normalizeOf('')).toBeNull();
    expect(normalizeOf(null)).toBeNull();
    expect(normalizeOf(undefined)).toBeNull();
    expect(normalizeOf('OF')).toBeNull();
    expect(normalizeOf('OF26-')).toBeNull();
    expect(normalizeOf('OF26-000000')).toBeNull(); // 6 dígitos: fuera de formato
    expect(normalizeOf('OF26-00000')).toBeNull();
    expect(normalizeOf('CL34712023')).toBeNull();
  });
});

describe('canonicalOrderFab', () => {
  it('unifica las OFs mal tecleadas que partían la identidad de la pieza (casos reales)', () => {
    expect(canonicalOrderFab('OF26-0461 9')).toBe('OF26-04619');
    expect(canonicalOrderFab('OF26--03910')).toBe('OF26-03910');
    expect(canonicalOrderFab('of26-5315')).toBe('OF26-05315');
    expect(canonicalOrderFab('OF26-04619')).toBe('OF26-04619');
  });

  it('deja tal cual el texto libre que se usa como nota y los centinelas', () => {
    expect(canonicalOrderFab('OF- RECHAZO SEDECAL')).toBe('OF- RECHAZO SEDECAL');
    expect(canonicalOrderFab('OF26-VARIOS')).toBe('OF26-VARIOS');
    expect(canonicalOrderFab('of parado')).toBe('OF PARADO');
    expect(canonicalOrderFab('SIN-OF')).toBe('SIN-OF');
    expect(canonicalOrderFab('')).toBe('');
  });
});

describe('isBareOfPrefix', () => {
  it('detecta el prefijo del año sin número detrás', () => {
    expect(isBareOfPrefix('OF26')).toBe(true);
    expect(isBareOfPrefix('OF26-')).toBe(true);
    expect(isBareOfPrefix('of26 - ')).toBe(true);
    expect(isBareOfPrefix('OF26-1')).toBe(false);
    expect(isBareOfPrefix('OF26-VARIOS')).toBe(false);
  });
});

describe('isOverlongOf', () => {
  it('detecta el artículo pegado detrás de la OF (casos reales)', () => {
    expect(isOverlongOf('OF26-0556524165')).toBe(true);
    expect(isOverlongOf('OF26-085931')).toBe(true);
    expect(isOverlongOf('OF26-05565')).toBe(false);
    expect(isOverlongOf('OF26-VARIOS')).toBe(false);
  });
});

describe('isLookupableOf', () => {
  it('distingue lo consultable de lo que aún se está tecleando', () => {
    expect(isLookupableOf('OF26-05315')).toBe(true);
    expect(isLookupableOf('OF2')).toBe(false);
    expect(isLookupableOf('OF26-')).toBe(false);
  });
});
