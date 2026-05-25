import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { parseCallableError } from '../callableError';

type SessionPayload = {
  role?: string | null;
  deviceId?: string | null;
  operarioId?: string | null;
  operarioName?: string | null;
};

const callPickupQueueOperate = async (op: 'create' | 'complete', payload: Record<string, unknown>, session?: SessionPayload) => {
  const callable = httpsCallable(functions, 'pickupQueueOperate');
  try {
    const result = await callable({ op, payload, session });
    return (result?.data || {}) as { ok?: boolean; requestId?: string };
  } catch (error: unknown) {
    throw new Error(parseCallableError(error));
  }
};

export const pickupQueueApi = {
  create: (payload: Record<string, unknown>, session?: SessionPayload) => callPickupQueueOperate('create', payload, session),
  complete: (payload: Record<string, unknown>, session?: SessionPayload) => callPickupQueueOperate('complete', payload, session),
};
