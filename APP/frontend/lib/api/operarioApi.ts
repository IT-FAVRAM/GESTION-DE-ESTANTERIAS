/**
 * API de Operarios — Conexión con Swagger del servidor interno
 * Gestor de Estanterías WMS v3.0
 * 
 * Endpoint: http://10.0.0.19:8000/fichajes/getOperarios
 * Se cachea en memoria con TTL configurable (default 5 min)
 */

// ─── Types ───

export interface SwaggerOperario {
  IDOperario: string;
  DescOperario: string;
  IDDepartamento: string;
  DescDepartamento: string;
  Activo: boolean;
  Productivo: boolean;
  Flexible: boolean;
}

export interface Operario {
  /** ID normalizado a 3 dígitos: "001", "042", "105" */
  id: string;
  /** Nombre completo: "BARRIENTOS MENDEZ, ALBERTO" */
  name: string;
  /** Departamento: "O.T.- Presup" */
  department: string;
  /** Si está activo */
  active: boolean;
}

// ─── Config ───

const SWAGGER_BASE_URL = import.meta.env.VITE_SWAGGER_BASE_URL || 'http://10.0.0.19:8000';
const OPERARIOS_ENDPOINT = `${SWAGGER_BASE_URL}/fichajes/getOperarios`;
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// ─── Cache ───

let cachedOperarios: Operario[] = [];
let cacheTimestamp = 0;
let cacheTTL = DEFAULT_CACHE_TTL;
let fetchPromise: Promise<Operario[]> | null = null;

// ─── Core Functions ───

/**
 * Normaliza un ID de operario a formato de 3 dígitos con padding.
 * "1" → "001", "01" → "001", "001" → "001", "42" → "042", "105" → "105"
 * Máximo 3 dígitos.
 */
export const normalizeOperarioId = (input: string): string => {
  // Eliminar espacios y caracteres no numéricos
  const cleaned = input.replace(/\D/g, '');
  
  if (cleaned.length === 0) return '';
  if (cleaned.length > 3) return cleaned.slice(0, 3);
  
  return cleaned.padStart(3, '0');
};

/**
 * Compara dos IDs de operario normalizándolos primero.
 * "1" == "01" == "001" → true
 */
export const isSameOperarioId = (a: string, b: string): boolean => {
  return normalizeOperarioId(a) === normalizeOperarioId(b);
};

/**
 * Transforma la respuesta del Swagger a nuestro formato interno.
 */
const mapSwaggerToOperario = (raw: SwaggerOperario): Operario => ({
  id: normalizeOperarioId(raw.IDOperario),
  name: raw.DescOperario.trim(),
  department: raw.DescDepartamento.trim(),
  active: raw.Activo,
});

/**
 * Obtiene la lista de operarios del servidor.
 * Cachea el resultado en memoria con TTL configurable.
 * Si hay un fetch en curso, espera al mismo para evitar duplicados.
 */
export const fetchOperarios = async (forceRefresh = false): Promise<Operario[]> => {
  const now = Date.now();
  
  // Return cache if valid and not forced
  if (!forceRefresh && cachedOperarios.length > 0 && (now - cacheTimestamp) < cacheTTL) {
    return cachedOperarios;
  }
  
  // If there's already a fetch in progress, wait for it
  if (fetchPromise) {
    return fetchPromise;
  }
  
  // Start new fetch
  fetchPromise = (async () => {
    try {
      const response = await fetch(OPERARIOS_ENDPOINT, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        // Timeout de 10 segundos
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        throw new Error(`Swagger API error: ${response.status} ${response.statusText}`);
      }
      
      const rawData: SwaggerOperario[] = await response.json();
      
      cachedOperarios = rawData
        .map(mapSwaggerToOperario)
        .filter(op => op.id !== '000'); // Filtrar IDs inválidos
      
      cacheTimestamp = Date.now();
      
      console.log(`[OperarioAPI] Loaded ${cachedOperarios.length} operarios`);
      return cachedOperarios;
      
    } catch (error) {
      console.error('[OperarioAPI] Error fetching operarios:', error);
      
      // Si tenemos cache viejo, devuélvelo como fallback
      if (cachedOperarios.length > 0) {
        console.warn('[OperarioAPI] Using stale cache as fallback');
        return cachedOperarios;
      }
      
      throw error;
    } finally {
      fetchPromise = null;
    }
  })();
  
  return fetchPromise;
};

/**
 * Busca un operario por su ID (normalizado).
 * Retorna null si no existe o no está activo.
 */
export const findOperarioById = async (id: string): Promise<Operario | null> => {
  const normalizedId = normalizeOperarioId(id);
  if (!normalizedId) return null;
  
  const operarios = await fetchOperarios();
  const found = operarios.find(op => op.id === normalizedId);
  
  if (!found) return null;
  if (!found.active) return null;
  
  return found;
};

/**
 * Valida que un ID de operario sea válido y esté activo.
 * Retorna el operario si es válido, o un error descriptivo.
 */
export const validateOperarioId = async (id: string): Promise<{ valid: true; operario: Operario } | { valid: false; error: string }> => {
  const normalizedId = normalizeOperarioId(id);
  
  if (!normalizedId || normalizedId === '000') {
    return { valid: false, error: 'ID de operario no válido' };
  }
  
  try {
    const operarios = await fetchOperarios();
    const found = operarios.find(op => op.id === normalizedId);
    
    if (!found) {
      return { valid: false, error: `No existe un operario con ID ${normalizedId}` };
    }
    
    if (!found.active) {
      return { valid: false, error: `El operario ${found.name} está inactivo` };
    }
    
    return { valid: true, operario: found };
    
  } catch (error) {
    return { valid: false, error: 'Error de conexión con el servidor. Reintente.' };
  }
};

/**
 * Obtiene todos los operarios activos.
 */
export const getActiveOperarios = async (): Promise<Operario[]> => {
  const operarios = await fetchOperarios();
  return operarios.filter(op => op.active);
};

/**
 * Configura el TTL del cache.
 */
export const setCacheTTL = (ttlMs: number): void => {
  cacheTTL = ttlMs;
};

/**
 * Fuerza una recarga inmediata del cache.
 */
export const refreshOperarios = (): Promise<Operario[]> => {
  return fetchOperarios(true);
};


