import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { parseCallableError } from '../callableError';

type SessionPayload = {
    role?: string | null;
    deviceId?: string | null;
    operarioId?: string | null;
    operarioName?: string | null;
};

type InventoryOp = 'ubicar' | 'ubicarMulti' | 'retirar' | 'retirarDeUbicacion' | 'mover' | 'emptyShelf';

interface InventoryOperateParams {
    op: InventoryOp;
    payload: Record<string, unknown>;
    session?: SessionPayload;
    opId?: string;
}

const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

const callInventoryOperate = async ({ op, payload, session, opId }: InventoryOperateParams) => {
    const callable = httpsCallable(functions, 'shelfOperate');
    try {
        const result = await callable({ op, payload, session, opId: opId || generateUUID() });
        return (result?.data || {}) as { ok?: boolean; opId?: string; positions?: string[] };
    } catch (error: unknown) {
        throw new Error(parseCallableError(error));
    }
};

const callLegacyInventoryOperate = async (op: 'assign' | 'remove' | 'move' | 'emptyShelf', payload: Record<string, unknown>, opId?: string) => {
    const callable = httpsCallable(functions, 'inventoryOperate');
    const result = await callable({ op, payload, opId: opId || generateUUID() });
    return (result?.data || {}) as { ok?: boolean; opId?: string; positions?: string[] };
};

export const inventoryApi = {
    ubicar: (payload: Record<string, unknown>, session?: SessionPayload, opId?: string) => callInventoryOperate({ op: 'ubicar', payload, session, opId }),
    ubicarMulti: (payload: Record<string, unknown>, session?: SessionPayload, opId?: string) => callInventoryOperate({ op: 'ubicarMulti', payload, session, opId }),
    retirar: (payload: Record<string, unknown>, session?: SessionPayload, opId?: string) => callInventoryOperate({ op: 'retirar', payload, session, opId }),
    retirarDeUbicacion: (payload: Record<string, unknown>, session?: SessionPayload, opId?: string) => callInventoryOperate({ op: 'retirarDeUbicacion', payload, session, opId }),
    mover: (payload: Record<string, unknown>, session?: SessionPayload, opId?: string) => callInventoryOperate({ op: 'mover', payload, session, opId }),
    emptyShelf: (payload: Record<string, unknown>, session?: SessionPayload, opId?: string) => callInventoryOperate({ op: 'emptyShelf', payload, session, opId }),
    assign: (payload: Record<string, unknown>, opId?: string) => callLegacyInventoryOperate('assign', payload, opId),
    remove: (payload: Record<string, unknown>, opId?: string) => callLegacyInventoryOperate('remove', payload, opId),
    move: (payload: Record<string, unknown>, opId?: string) => callLegacyInventoryOperate('move', payload, opId),
    emptyShelfLegacy: (payload: Record<string, unknown>, opId?: string) => callLegacyInventoryOperate('emptyShelf', payload, opId),
};


