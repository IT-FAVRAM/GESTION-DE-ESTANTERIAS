import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

type SessionPayload = {
    role?: string | null;
    deviceId?: string | null;
    operarioId?: string | null;
    operarioName?: string | null;
};

type InventoryOp = 'ubicar' | 'retirar' | 'retirarDeUbicacion' | 'mover';

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
    } catch (error: any) {
        const code = error?.code || 'unknown';
        const message = error?.message || 'Operation failed';
        throw new Error(`${code}:${message}`);
    }
};

const callLegacyInventoryOperate = async (op: 'assign' | 'remove' | 'move' | 'emptyShelf', payload: Record<string, unknown>, opId?: string) => {
    const callable = httpsCallable(functions, 'inventoryOperate');
    const result = await callable({ op, payload, opId: opId || generateUUID() });
    return (result?.data || {}) as { ok?: boolean; opId?: string; positions?: string[] };
};

export const inventoryApi = {
    ubicar: (payload: Record<string, unknown>, session?: SessionPayload, opId?: string) => callInventoryOperate({ op: 'ubicar', payload, session, opId }),
    retirar: (payload: Record<string, unknown>, session?: SessionPayload, opId?: string) => callInventoryOperate({ op: 'retirar', payload, session, opId }),
    retirarDeUbicacion: (payload: Record<string, unknown>, session?: SessionPayload, opId?: string) => callInventoryOperate({ op: 'retirarDeUbicacion', payload, session, opId }),
    mover: (payload: Record<string, unknown>, session?: SessionPayload, opId?: string) => callInventoryOperate({ op: 'mover', payload, session, opId }),
    assign: (payload: Record<string, unknown>, opId?: string) => callLegacyInventoryOperate('assign', payload, opId),
    remove: (payload: Record<string, unknown>, opId?: string) => callLegacyInventoryOperate('remove', payload, opId),
    move: (payload: Record<string, unknown>, opId?: string) => callLegacyInventoryOperate('move', payload, opId),
    emptyShelf: (payload: Record<string, unknown>, opId?: string) => callLegacyInventoryOperate('emptyShelf', payload, opId),
};
