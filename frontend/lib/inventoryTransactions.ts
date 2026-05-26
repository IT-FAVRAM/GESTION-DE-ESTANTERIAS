/**
 * @deprecated
 * Las transacciones de inventario se ejecutan en Cloud Functions (shelfOperate /
 * inventoryOperate). Este módulo existe únicamente para compatibilidad de tipos
 * con código legado. No contiene lógica ejecutable.
 */

export type TransactionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};


