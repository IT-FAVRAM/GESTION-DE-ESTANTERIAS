import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const inboundOrdersOperate = httpsCallable(functions, 'inboundOrdersOperate');

export const inboundOrdersApi = {
  async create(order: any) {
    const res = await inboundOrdersOperate({ op: 'create', payload: order });
    return res.data as { ok: boolean };
  },

  async update(orderId: string, updates: any) {
    const res = await inboundOrdersOperate({ op: 'update', payload: { orderId, ...updates } });
    return res.data as { ok: boolean };
  },

  async delete(orderId: string) {
    const res = await inboundOrdersOperate({ op: 'delete', payload: { orderId } });
    return res.data as { ok: boolean };
  },
};
