import { describe, it, expect } from 'vitest';
import { normalizeOf, isLookupableOf } from './ofNormalize';

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

describe('isLookupableOf', () => {
  it('distingue lo consultable de lo que aún se está tecleando', () => {
    expect(isLookupableOf('OF26-05315')).toBe(true);
    expect(isLookupableOf('OF2')).toBe(false);
    expect(isLookupableOf('OF26-')).toBe(false);
  });
});
