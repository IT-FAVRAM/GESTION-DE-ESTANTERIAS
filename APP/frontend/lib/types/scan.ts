/**
 * Tipos compartidos para escaneo de artículos
 */

export type ScanMethod = 'manual' | 'barcode' | 'ocr';

export interface ParsedScan {
  articleCode: string;
  orderFab: string;
}

export interface ScanResult {
  success: true;
  data: ParsedScan;
}

export interface ScanError {
  success: false;
  error: string;
  rawInput: string;
}

export type ScanParseResult = ScanResult | ScanError;
