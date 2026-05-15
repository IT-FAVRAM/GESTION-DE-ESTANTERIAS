/**
 * retryStrategy.ts — Estrategia de reintentos con backoff exponencial
 * Gestor de Estanterías WMS v3.0
 *
 * Implementa backoff exponencial con jitter para reintentos de operaciones offline,
 * evitando thundering herd y sobrecarga del servidor.
 */

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
}

const defaultConfig: RetryConfig = {
  maxAttempts: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.2,
};

export const calculateBackoff = (
  attemptNumber: number,
  config: Partial<RetryConfig> = {}
): number => {
  const cfg = { ...defaultConfig, ...config };

  if (attemptNumber >= cfg.maxAttempts) {
    return -1;
  }

  const exponential = Math.pow(2, attemptNumber) * cfg.initialDelayMs;
  const capped = Math.min(exponential, cfg.maxDelayMs);
  const jitter = capped * cfg.jitterFactor * (Math.random() - 0.5);

  return Math.max(Math.round(capped + jitter), cfg.initialDelayMs);
};

export const shouldRetry = (attemptNumber: number, errorKind?: 'transient' | 'conflict'): boolean => {
  if (attemptNumber >= defaultConfig.maxAttempts) return false;
  if (errorKind === 'conflict') return false;
  return true;
};

export const formatBackoffTime = (delayMs: number): string => {
  if (delayMs < 0) return 'No';
  if (delayMs < 1000) return `${delayMs}ms`;
  if (delayMs < 60000) return `${(delayMs / 1000).toFixed(1)}s`;
  return `${(delayMs / 60000).toFixed(1)}m`;
};
