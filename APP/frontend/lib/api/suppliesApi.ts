import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const suppliesOperate = httpsCallable(functions, 'suppliesOperate');

export const suppliesApi = {
  async addItem(collection: string, docId: string, shelfId: string, type: string, data: { description: string; barcode?: string; orderId?: string }) {
    const res = await suppliesOperate({
      op: 'addItem',
      payload: { collection, docId, shelfId, type, ...data },
    });
    return res.data as { ok: boolean; itemId?: string };
  },

  async removeItems(collection: string, docId: string, itemIds: string[]) {
    const res = await suppliesOperate({
      op: 'removeItems',
      payload: { collection, docId, itemIds },
    });
    return res.data as { ok: boolean; removed?: number };
  },

  async moveItems(collection: string, docId: string, itemIds: string[], targetShelfId: string) {
    const res = await suppliesOperate({
      op: 'moveItems',
      payload: { collection, docId, itemIds, targetShelfId },
    });
    return res.data as { ok: boolean; moved?: number };
  },
};
