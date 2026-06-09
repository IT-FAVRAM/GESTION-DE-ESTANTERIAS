/**
 * contiguityValidator — Valida si las posiciones seleccionadas son contiguas
 * (horizontal o verticalmente) en la definición física de la estantería.
 */

import type { Shelf } from './schema/shelves';

export interface ContiguityResult {
  isContiguous: boolean;
  direction: 'horizontal' | 'vertical' | null;
  message: string;
}

/**
 * Encuentra la posición (fila, columna) de un número de posición en los physicalBlocks
 */
function findPositionInGrid(
  position: number,
  shelfDef: Shelf
): { row: number; col: number; blockId: string } | null {
  if (!shelfDef.layout.physicalBlocks) return null;
  
  for (const block of shelfDef.layout.physicalBlocks) {
    for (let row = 0; row < block.rows.length; row++) {
      const col = block.rows[row].indexOf(position);
      if (col !== -1) {
        return { row, col, blockId: block.id };
      }
    }
  }
  return null;
}

/**
 * Valida si las posiciones seleccionadas son contiguas
 */
export function validateContiguity(
  positions: string[],
  shelfDef: Shelf
): ContiguityResult {
  if (positions.length <= 1) {
    return {
      isContiguous: true,
      direction: null,
      message: positions.length === 0 ? 'Selecciona al menos una posición' : 'Una posición seleccionada',
    };
  }
  
  // Convertir a números y encontrar sus posiciones en la cuadrícula
  const numericPositions = positions.map(p => parseInt(p, 10));
  const gridPositions = numericPositions
    .map(pos => ({
      numeric: pos,
      grid: findPositionInGrid(pos, shelfDef),
    }))
    .filter(p => p.grid !== null);
  
  if (gridPositions.length !== positions.length) {
    return {
      isContiguous: false,
      direction: null,
      message: 'Algunas posiciones no se encontraron en la cuadrícula',
    };
  }
  
  // Verificar que todas estén en el mismo bloque O sean contiguas en múltiples bloques
  const blockIds = new Set(gridPositions.map(p => p.grid!.blockId));
  const multiBlockShelvesAllowed = ['PLE', 'REP', 'PIN'];
  const isMultiBlockShelf = multiBlockShelvesAllowed.some(code => shelfDef.code === code);

  // Si hay múltiples bloques y NO es estantería que lo permite, rechazar
  if (blockIds.size > 1 && !isMultiBlockShelf) {
    return {
      isContiguous: false,
      direction: null,
      message: 'Las posiciones deben estar en el mismo bloque físico',
    };
  }

  // Para estanterías multi-bloque, permitir si son numéricamente contiguas
  if (blockIds.size > 1 && isMultiBlockShelf) {
    const sortedPositions = numericPositions.sort((a, b) => a - b);
    const isSequential = sortedPositions.every((pos, i) =>
      i === 0 || pos === sortedPositions[i - 1] + 1
    );

    if (!isSequential) {
      return {
        isContiguous: false,
        direction: null,
        message: 'Las posiciones deben ser consecutivas (ej: 31, 32, 33)',
      };
    }

    // Para multi-bloque, permitir pero informar
    return {
      isContiguous: true,
      direction: 'horizontal',
      message: `${positions.length} posiciones contiguas (multi-bloque)`,
    };
  }
  
  // Verificar si están en la misma fila
  const rows = new Set(gridPositions.map(p => p.grid!.row));
  const cols = new Set(gridPositions.map(p => p.grid!.col));
  
  if (rows.size === 1) {
    // Misma fila → verificar que sean consecutivas en columnas
    const sortedCols = gridPositions.map(p => p.grid!.col).sort((a, b) => a - b);
    const isConsecutive = sortedCols.every((col, i) => 
      i === 0 || col === sortedCols[i - 1] + 1
    );
    
    if (isConsecutive) {
      return {
        isContiguous: true,
        direction: 'horizontal',
        message: `${positions.length} posiciones contiguas en fila`,
      };
    }
  }
  
  if (cols.size === 1) {
    // Misma columna → verificar que sean consecutivas en filas
    const sortedRows = gridPositions.map(p => p.grid!.row).sort((a, b) => a - b);
    const isConsecutive = sortedRows.every((row, i) => 
      i === 0 || row === sortedRows[i - 1] + 1
    );
    
    if (isConsecutive) {
      return {
        isContiguous: true,
        direction: 'vertical',
        message: `${positions.length} posiciones contiguas en columna`,
      };
    }
  }
  
  // No son contiguas
  return {
    isContiguous: false,
    direction: null,
    message: 'Las posiciones deben ser contiguas (misma fila o columna, sin saltos)',
  };
}
