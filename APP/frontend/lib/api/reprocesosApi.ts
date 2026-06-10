/**
 * reprocesosApi — API para gestionar reprocesos de Calidad
 * Gestor de Estanterías WMS v3.0
 * 
 * Permite actualizar cantidad e importe unitario en ubicaciones
 * de reproceso (CAL 001-022).
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

/**
 * Actualiza la cantidad e importe de un artículo en reprocesos.
 * Solo CALIDAD, ADMIN y SUPERADMIN pueden llamar a esta función.
 */
export const updateReproceso = async (
  position: string,
  presenceId: string,
  articleCode: string,
  orderFab: string,
  quantity: number,
  unitCost: number,
): Promise<boolean> => {
  try {
    const fn = httpsCallable(functions, 'updateReproceso');
    await fn({
      payload: {
        position,
        presenceId,
        articleCode,
        orderFab,
        quantity,
        unitCost,
      },
    });
    return true;
  } catch (err) {
    console.error('[reprocesosApi] Error actualizando reproceso:', err);
    return false;
  }
};

/**
 * Calcula el total de dinero en reprocesos a partir de los items de las ubicaciones.
 * Solo cuenta items que tengan quantity > 0 (reprocesos registrados).
 */
export const calcReprocesosTotal = (
  locationItems: Array<{ quantity?: number; unitCost?: number }>
): { totalImporte: number; totalPiezas: number } => {
  let totalImporte = 0;
  let totalPiezas = 0;
  for (const item of locationItems) {
    // Solo contar items con quantity registrada y > 0
    const qty = item.quantity ?? 0;
    if (qty <= 0) continue;

    const cost = item.unitCost ?? 0;
    totalImporte += qty * cost;
    totalPiezas += qty;
  }
  return { totalImporte, totalPiezas };
};

/**
 * Formatea un importe en euros con separador de miles.
 */
export const formatEuros = (amount: number): string => {
  return amount.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};


