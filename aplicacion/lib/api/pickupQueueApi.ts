import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { parseCallableError } from '../callableError';

type SessionPayload = {
  role?: string | null;
  deviceId?: string | null;
  operarioId?: string | null;
  operarioName?: string | null;
};

export type CarretilleroOption = { uid: string; name: string };

type PickupQueueOp = 'create' | 'complete' | 'acknowledge' | 'carretilleros';

const callPickupQueueOperate = async (op: PickupQueueOp, payload: Record<string, unknown>, session?: SessionPayload) => {
  const callable = httpsCallable(functions, 'pickupQueueOperate');
  try {
    const result = await callable({ op, payload, session });
    return (result?.data || {}) as { ok?: boolean; requestId?: string; carretilleros?: CarretilleroOption[] };
  } catch (error: unknown) {
    throw new Error(parseCallableError(error));
  }
};

export const pickupQueueApi = {
  create: (payload: Record<string, unknown>, session?: SessionPayload) => callPickupQueueOperate('create', payload, session),
  complete: (payload: Record<string, unknown>, session?: SessionPayload) => callPickupQueueOperate('complete', payload, session),
  acknowledge: (payload: Record<string, unknown>, session?: SessionPayload) => callPickupQueueOperate('acknowledge', payload, session),
  listCarretilleros: (session?: SessionPayload) => callPickupQueueOperate('carretilleros', {}, session),
};
