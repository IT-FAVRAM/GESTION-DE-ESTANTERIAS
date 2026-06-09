/**
 * API de Control de Producción — Proxy a través de Cloud Function
 *
 * NOTA IMPORTANTE: Usamos un Cloud Function proxy (HTTP con CORS) en lugar de hacer llamadas directas
 * a http://10.0.0.19:8000 para evitar problemas de Mixed Content (HTTPS → HTTP).
 *
 * El flujo es:
 * 1. Frontend (HTTPS) llama al Cloud Function HTTP (HTTPS) con CORS headers ✓
 * 2. Cloud Function (backend) hace solicitud HTTP a 10.0.0.19:8000 ✓
 * 3. No hay mixed content porque backend-to-backend es permitido
 */

const PROXY_BASE = 'https://us-central1-gestion-de-estanterias.cloudfunctions.net/proxyControlOfProduccion';

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
    const fetchSignal = signal || controller?.signal;

    try {
      // Llamar al Cloud Function proxy
      const response = await fetch(`${PROXY_BASE}?orderFab=${encodeURIComponent(completeOf)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: fetchSignal,
      });

      // Verificar respuesta del proxy
      if (!response.ok) {
        console.warn(`[ControlOfProducción] Proxy error: ${response.status} para OF ${completeOf}`);
        return null;
      }

      const data: any = await response.json();

      if (data.success && data.articulo) {
        console.log(`[ControlOfProducción] ✓ Artículo: ${data.articulo} (OF ${completeOf})`);
        return String(data.articulo).trim();
      }

      if (data.error) {
        console.warn(`[ControlOfProducción] API error: ${data.error}`);
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

    console.error(`[ControlOfProducción] Error obteniendo artículo para OF ${orderFab}:`, err?.message || err);
    return null;
  }
};

/**
 * Valida que el Cloud Function esté disponible
 */
export const testControlOfProduccionApi = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${PROXY_BASE}?orderFab=OF26-00000`);
    return response.ok;
  } catch {
    return false;
  }
};
