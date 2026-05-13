import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

type SessionPayload = {
  role?: string | null;
  deviceId?: string | null;
  operarioId?: string | null;
  operarioName?: string | null;
};

const callPickupQueueOperate = async (op: 'create' | 'complete', payload: Record<string, unknown>, session?: SessionPayload) => {
  const callable = httpsCallable(functions, 'pickupQueueOperate');
  const result = await callable({ op, payload, session });
  return (result?.data || {}) as { ok?: boolean; requestId?: string };
};

export const pickupQueueApi = {
  create: (payload: Record<string, unknown>, session?: SessionPayload) => callPickupQueueOperate('create', payload, session),
  complete: (payload: Record<string, unknown>, session?: SessionPayload) => callPickupQueueOperate('complete', payload, session),
};
