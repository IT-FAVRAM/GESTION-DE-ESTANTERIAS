


import { WAREHOUSES, SHELVES, RACKS, POSITIONS, WarehouseCode, LocationId, formatLocation } from './warehouseData';
import { isValidLayoutLocation } from './warehouseLayout';
import { isValidProduct, getProductDetails } from './catalog';

export type CodeType = 'location' | 'item' | 'order' | 'special' | 'unknown';

export interface ValidationResult {
  isValid: boolean;
  type: CodeType;
  normalizedCode: string;
  message?: string;
  details?: string;
  severity: 'success' | 'warning' | 'error' | 'info';
}

/**
 * Analiza un código de barras y determina qué es y si es válido.
 */
export const validateCode = (rawCode: string, strictMode: boolean = false): ValidationResult => {
  const code = rawCode.trim().toUpperCase();

  if (!code) {
    return { isValid: false, type: 'unknown', normalizedCode: code, message: 'Código vacío', severity: 'info' };
  }

  // 0. CÓDIGOS ESPECIALES
  if (code === 'ALMACEN') {
    return {
      isValid: true,
      type: 'special',
      normalizedCode: code,
      message: 'Comando Especial',
      details: 'Fin de Proceso',
      severity: 'info'
    };
  }

  // 1. VALIDAR SI ES ORDEN DE FABRICACIÓN (OF)
  // Formato: Empieza por "OF" - Strict check
  if (code.startsWith('OF')) {
    return {
      isValid: true,
      type: 'order',
      normalizedCode: code,
      message: 'Orden de Fabricación',
      details: code,
      severity: 'success'
    };
  }

  // 2. VALIDAR SI ES UBICACIÓN
  // Formato esperado: WAREHOUSE-E{Shelf}-B{Rack}-{Position}
  // MAJOR CHANGE: Use strict whitelist from warehouseLayout.ts
  if (isValidLayoutLocation(code)) {
    return {
      isValid: true,
      type: 'location',
      normalizedCode: code as LocationId,
      message: 'Ubicación Válida',
      details: formatLocation(code), // Use helper to show friendly name
      severity: 'success'
    };
  }

  // Fallback: Check if it looks like a location but is invalid (Ghost Location)
  const warehousePrefix = WAREHOUSES.find(w => code.startsWith(w + '-'));
  if (warehousePrefix) {
    return {
      isValid: false,
      type: 'location',
      normalizedCode: code,
      message: 'Ubicación Inexistente',
      details: 'El código tiene formato de almacén pero no existe en el plano.',
      severity: 'error'
    };
  }

  // 3. VALIDAR SI ES ARTÍCULO (Por defecto, si no es OF ni Ubicación)
  // Al ser catálogo abierto, aceptamos casi todo que no sea OF ni Location
  if (!code.startsWith('OF')) {
    return {
      isValid: true,
      type: 'item',
      normalizedCode: code,
      message: 'Artículo',
      details: 'Referencia detectada',
      severity: 'success'
    };
  }

  return {
    isValid: false,
    type: 'unknown',
    normalizedCode: code,
    message: 'Código Desconocido',
    details: 'No reconocido',
    severity: 'error'
  };
};