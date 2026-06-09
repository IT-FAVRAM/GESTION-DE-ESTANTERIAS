/**
 * API de Control de Producción (Swagger)
 * Obtiene datos de piezas y órdenes de fabricación en tiempo real
 */

const API_BASE = 'http://10.0.0.19:8000';

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
 * Con timeout de 5 segundos y abort signal para cancelación
 */
export const getArticuloByOf = async (orderFab: string, signal?: AbortSignal): Promise<string | null> => {
  try {
    // Normalizar OF (remover "OF" prefix si existe)
    const ofNumber = orderFab.replace(/^OF26?-?/, '').trim();
    if (!ofNumber) return null;

    // Construir parámetro de query
    const params = new URLSearchParams({
      orderFab: `OF26-${ofNumber}`,
    });

    // Crear timeout de 5 segundos si no hay signal externo
    const controller = signal ? undefined : new AbortController();
    const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : undefined;
    const fetchSignal = signal || controller?.signal;

    try {
      const response = await fetch(`${API_BASE}/ControlOfProduccion/fichajes/getControlOfProduccion?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: fetchSignal,
      });

      if (!response.ok) {
        console.warn(`[ControlOfProducción] API error: ${response.status} para OF ${orderFab}`);
        return null;
      }

      const data = await response.json();

      // Extraer artículo de la respuesta
      if (!data) {
        console.warn(`[ControlOfProducción] Respuesta vacía para OF ${orderFab}`);
        return null;
      }

      // Si es un array, tomar el primer elemento
      const item = Array.isArray(data) ? data[0] : data;
      if (!item) {
        console.warn(`[ControlOfProducción] Sin datos en respuesta para OF ${orderFab}`);
        return null;
      }

      // Buscar el código de artículo en propiedades comunes
      const articulo = item.articulo || item.articleCode || item.articleCodeExtended;

      if (articulo) {
        console.log(`[ControlOfProducción] ✓ Artículo: ${articulo} (OF ${orderFab})`);
        return String(articulo).trim();
      }

      console.warn(`[ControlOfProducción] Campo artículo no encontrado en respuesta para OF ${orderFab}`);
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
 * Valida que la API esté disponible
 */
export const testControlOfProduccionApi = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/docs`, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};
