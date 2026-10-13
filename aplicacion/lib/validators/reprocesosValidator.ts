/**
 * reprocesosValidator — Validación ÚNICA para campos de reprocesos
 *
 * Centraliza TODA la lógica de validación de importe (EUR) y cantidad (piezas)
 * para ubicaciones CAL 001-022.
 * Usado por frontend (componentes) y backend (inventory.ts).
 */

export interface ReprocesosValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida importe unitario en EUR para ubicaciones de reproceso
 * - Debe ser un número positivo
 * - Máximo 99999.99
 * - Se requiere si hay cantidad
 */
export const validateUnitCost = (value?: number): string | null => {
  if (value === undefined || value === null) return null;

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Importe debe ser un número válido';
  }

  if (value < 0) {
    return 'Importe no puede ser negativo';
  }

  if (value > 99999.99) {
    return 'Importe máximo es €99999.99';
  }

  // Check decimal places (max 2)
  if (value % 1 !== 0 && value.toString().split('.')[1]?.length > 2) {
    return 'Importe máximo 2 decimales';
  }

  return null;
};

/**
 * Valida cantidad de piezas para ubicaciones de reproceso
 * - Debe ser un número entero positivo
 * - Mínimo 1
 * - Máximo 9999
 */
export const validateQuantity = (value?: number): string | null => {
  if (value === undefined || value === null) return null;

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Cantidad debe ser un número entero';
  }

  if (!Number.isInteger(value)) {
    return 'Cantidad debe ser un número entero (sin decimales)';
  }

  if (value < 1) {
    return 'Cantidad mínima es 1';
  }

  if (value > 9999) {
    return 'Cantidad máxima es 9999';
  }

  return null;
};

/**
 * Valida AMBOS campos juntos para ubicaciones de reproceso
 */
export const validateReprocesosFields = (
  unitCost?: number,
  quantity?: number,
  requireBoth = false,
): ReprocesosValidationResult => {
  const errors: string[] = [];

  const costError = validateUnitCost(unitCost);
  if (costError) errors.push(costError);

  const qtyError = validateQuantity(quantity);
  if (qtyError) errors.push(qtyError);

  // If one is provided, both should be provided
  if (requireBoth) {
    if ((unitCost !== undefined && quantity === undefined) || (quantity !== undefined && unitCost === undefined)) {
      errors.push('Importe y cantidad deben proporcionarse juntos');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Obtiene valor por defecto para un campo según contexto
 */
export const getDefaultReprocesosValue = (field: 'unitCost' | 'quantity'): number | undefined => {
  // No defaults — usuario debe ingresar explícitamente si es reproceso
  return undefined;
};
