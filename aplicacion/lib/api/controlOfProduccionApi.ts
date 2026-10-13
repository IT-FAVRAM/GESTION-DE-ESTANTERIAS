/**
 * API de Control de Producción — Proxy Local
 *
 * NOTA IMPORTANTE: Usamos un servidor proxy local (Express + CORS) en lugar de:
 * - Cloud Functions (problemas con CORS)
 * - Llamadas directas a http://10.0.0.19:8000 (Mixed Content error)
 *
 * El flujo es:
 * 1. Frontend (HTTPS) llama al Proxy Local (HTTP) desde la red LAN ✓
 * 2. Proxy local hace solicitud HTTP a 10.0.0.19:8000 ✓
 * 3. No hay mixed content porque ambas son HTTP en la LAN
 *
 * CONFIGURAR:
 * 1. Instalar dependencias: npm install en la carpeta raíz
 * 2. Ejecutar: node proxy-server.js
 * 3. El servidor escuchará en http://localhost:3000
 */

// URL del proxy local (cambiar a tu IP si está en otra máquina)
const PROXY_BASE = process.env.REACT_APP_PROXY_URL || 'http://localhost:3000';

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
 * Usa Cloud Function HTTP proxy para evitar Mixed Content
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
      // Llamar al proxy local
      const response = await fetch(`${PROXY_BASE}/api/articulo?orderFab=${encodeURIComponent(completeOf)}`, {
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
 * Valida que el proxy local esté disponible
 */
export const testControlOfProduccionApi = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${PROXY_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
};
