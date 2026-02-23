import { functions } from './firebase';

type InventoryOp = 'assign' | 'remove' | 'move' | 'emptyShelf';

interface InventoryOperateParams {
    op: InventoryOp;
    payload: Record<string, unknown>;
    opId?: string;
}

const callInventoryOperate = async ({ op, payload, opId }: InventoryOperateParams) => {
    const callable = functions.httpsCallable('inventoryOperate');
    try {
        const result = await callable({ op, payload, opId: opId || crypto.randomUUID() });
        return (result?.data || {}) as { ok?: boolean; opId?: string };
    } catch (error: any) {
        const code = error?.code || 'unknown';
        const message = error?.message || 'Operation failed';
        throw new Error(`${code}:${message}`);
    }
};

export const inventoryApi = {
    assign: (payload: Record<string, unknown>, opId?: string) => callInventoryOperate({ op: 'assign', payload, opId }),
    remove: (payload: Record<string, unknown>, opId?: string) => callInventoryOperate({ op: 'remove', payload, opId }),
    move: (payload: Record<string, unknown>, opId?: string) => callInventoryOperate({ op: 'move', payload, opId }),
    emptyShelf: (payload: Record<string, unknown>, opId?: string) => callInventoryOperate({ op: 'emptyShelf', payload, opId })
};
