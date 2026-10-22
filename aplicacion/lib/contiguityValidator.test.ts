import { describe, it, expect } from 'vitest';
import { validateContiguity } from './contiguityValidator';
import { getShelfDefinition } from './schema/shelves';

describe('validateContiguity con huecos de texto', () => {
  it('BOMBO 1 + BOMBO 2 (misma columna, filas seguidas) es contiguo', () => {
    const bom = getShelfDefinition('BOM')!;
    expect(validateContiguity(['BOMBO 1', 'BOMBO 2'], bom).isContiguous).toBe(true);
  });

  it('031-033 en PLE son contiguos en fila', () => {
    const ple = getShelfDefinition('PLE')!;
    expect(validateContiguity(['031', '032', '033'], ple).isContiguous).toBe(true);
  });

  it('hueco de texto inexistente se rechaza', () => {
    const bom = getShelfDefinition('BOM')!;
    expect(validateContiguity(['BOMBO 1', 'BOMBO 9'], bom).isContiguous).toBe(false);
  });

  it('numéricos siguen funcionando', () => {
    const ple = getShelfDefinition('PLE')!;
    expect(validateContiguity(['034', '035', '036'], ple).isContiguous).toBe(true);
  });
});
