import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { parseCallableError } from '../callableError';

type SessionPayload = {
  role?: string | null;
  deviceId?: string | null;
  operarioId?: string | null;
  operarioName?: string | null;
};

type ChaperoOp = 'ubicar' | 'retirar' | 'mover';

const callChaperoOperate = async (op: ChaperoOp, payload: Record<string, unknown>, session?: SessionPayload) => {
  const callable = httpsCallable(functions, 'chaperoOperate');
  try {
    const result = await callable({ op, payload, session });
    return (result?.data || {}) as { ok?: boolean; itemId?: string; removed?: number };
  } catch (error: unknown) {
    throw new Error(parseCallableError(error));
  }
};

export const chaperoApi = {
  ubicar: (payload: Record<string, unknown>, session?: SessionPayload) =>
    callChaperoOperate('ubicar', payload, session),
  retirar: (payload: Record<string, unknown>, session?: SessionPayload) =>
    callChaperoOperate('retirar', payload, session),
  mover: (payload: Record<string, unknown>, session?: SessionPayload) =>
    callChaperoOperate('mover', payload, session),
};
