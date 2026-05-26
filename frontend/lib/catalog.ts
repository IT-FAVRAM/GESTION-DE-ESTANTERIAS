
// CATALOGO ABIERTO
// Se ha eliminado la lista estática para permitir el ingreso de cualquier referencia.

const RAW_CODES_LIST: string[] = []; // Lista vacía intencionadamente

// Lógica de optimización (Set vacío)
const PRODUCT_CATALOG = new Set(RAW_CODES_LIST);

/**
 * Verifica si un código es un artículo válido.
 * Ahora acepta CUALQUIER string que no sea vacío, ya que el catálogo es abierto.
 * La validación de si es Ubicación u OF se hace antes en codeValidation.ts
 */
export const isValidProduct = (code: string): boolean => {
  if (!code || code.length < 2) return false;
  return true; // Aceptamos todo como artículo potencial (validación permisiva)
};

/**
 * Devuelve los detalles del producto.
 */
export const getProductDetails = (code: string) => {
  return {
    id: code,
    name: "Artículo General",
    category: "General"
  };
};


