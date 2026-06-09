/**
 * API de Control de Producción — Proxy a través de Cloud Function
 *
 * NOTA IMPORTANTE: Usamos un Cloud Function proxy en lugar de hacer llamadas directas
 * a http://10.0.0.19:8000 para evitar problemas de Mixed Content (HTTPS → HTTP).
 *
 * El flujo es:
 * 1. Frontend (HTTPS) llama al Cloud Function (HTTPS) ✓
 * 2. Cloud Function (backend) hace solicitud HTTP a 10.0.0.19:8000 ✓
 * 3. No hay mixed content porque backend-to-backend es permitido
 */

import { getFunctions, httpsCallable } from 'firebase/functions';

export interface ControlOfProduccionResponse {
  articulo?: string;
  articleCode?: string;
  articleCodeExtended?: string;
  of?: string;
  orderFab?: string;
  [key: string]: any;
}

/**
 * Obtiene el artículo desde la API Swagger por OF
 * Usa Cloud Function proxy para evitar Mixed Content
 */
export const getArticuloByOf = async (orderFab: string, signal?: AbortSignal): Promise<string | null> => {
  try {
    // Normalizar OF (remover "OF" prefix si existe)
    const ofNumber = orderFab.replace(/^OF26?-?/, '').trim();
    if (!ofNumber) return null;

    const completeOf = `OF26-${ofNumber}`;

    // Crear timeout de 5 segundos si no hay signal externo
    const controller = signal ? undefined : new AbortController();
    const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : undefined;

    try {
      // Llamar Cloud Function proxy
      const functions = getFunctions();
      const proxyFn = httpsCallable(functions, 'proxyControlOfProduccion');

      const result: any = await proxyFn({ orderFab: completeOf });

      // Verificar respuesta del proxy
      if (result.data.success && result.data.articulo) {
        console.log(`[ControlOfProducción] ✓ Artículo: ${result.data.articulo} (OF ${completeOf})`);
        return String(result.data.articulo).trim();
      }

      if (result.data.error) {
        console.warn(`[ControlOfProducción] API error: ${result.data.error}`);
      }

      return null;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn(`[ControlOfProducción] Timeout esperando artículo para OF ${orderFab}`);
      return null;
    }

    // Manejar errores del Cloud Function
    if (err?.code === 'functions/unavailable') {
      console.error(`[ControlOfProducción] Cloud Function no disponible`);
    } else if (err?.code === 'functions/deadline-exceeded') {
      console.warn(`[ControlOfProducción] Cloud Function timeout`);
    } else {
      console.error(`[ControlOfProducción] Error obteniendo artículo para OF ${orderFab}:`, err?.message || err);
    }

    return null;
  }
};

/**
 * Valida que el Cloud Function esté disponible
 * (En lugar de verificar el servidor externo)
 */
export const testControlOfProduccionApi = async (): Promise<boolean> => {
  try {
    // Intentar un pequeño test con OF inválido
    // El Cloud Function debe responder aunque falle la búsqueda
    const functions = getFunctions();
    const proxyFn = httpsCallable(functions, 'proxyControlOfProduccion');

    await proxyFn({ orderFab: 'OF26-00000' });
    return true;
  } catch {
    return false;
  }
};
