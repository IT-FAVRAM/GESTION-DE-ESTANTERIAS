import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const cartsOperate = httpsCallable(functions, 'cartsOperate');

export const cartsApi = {
  async addItem(cartId: string, shelfId: string, type: string, data: { description: string; barcode?: string; orderId?: string }) {
    const res = await cartsOperate({
      op: 'addItem',
      payload: { cartId, shelfId, type, ...data },
    });
    return res.data as { ok: boolean; itemId?: string };
  },

  async removeItems(cartId: string, itemIds: string[]) {
    const res = await cartsOperate({
      op: 'removeItems',
      payload: { cartId, itemIds },
    });
    return res.data as { ok: boolean; removed?: number };
  },

  async moveItems(cartId: string, itemIds: string[], targetShelfId: string) {
    const res = await cartsOperate({
      op: 'moveItems',
      payload: { cartId, itemIds, targetShelfId },
    });
    return res.data as { ok: boolean; moved?: number };
  },
};
