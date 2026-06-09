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
 * Filtra la respuesta para extraer el código de artículo
 */
export const getArticuloByOf = async (orderFab: string): Promise<string | null> => {
  try {
    // Normalizar OF (remover "OF" prefix si existe)
    const ofNumber = orderFab.replace(/^OF26?-?/, '').trim();
    if (!ofNumber) return null;

    // Construir parámetro de query
    const params = new URLSearchParams({
      orderFab: `OF26-${ofNumber}`,
    });

    const response = await fetch(`${API_BASE}/ControlOfProduccion/fichajes/getControlOfProduccion?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[ControlOfProducción] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Extraer artículo de la respuesta
    // El API puede devolver diferentes formatos, intentamos varias propiedades
    if (!data) return null;

    // Si es un array, tomar el primer elemento
    const item = Array.isArray(data) ? data[0] : data;
    if (!item) return null;

    // Buscar el código de artículo en propiedades comunes
    const articulo = item.articulo || item.articleCode || item.articleCodeExtended;

    if (articulo) {
      console.log(`[ControlOfProducción] Artículo encontrado: ${articulo} para OF ${orderFab}`);
      return String(articulo).trim();
    }

    console.warn(`[ControlOfProducción] No se encontró artículo en respuesta para OF ${orderFab}`);
    return null;
  } catch (err) {
    console.error(`[ControlOfProducción] Error obteniendo artículo:`, err);
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
