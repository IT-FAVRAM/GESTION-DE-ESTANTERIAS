import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

type ProductionOp = 'withdrawToWorking' | 'finishWorking' | 'locateWorking';

interface WithdrawToWorkingPayload {
  barcode: string;
  orderId: string;
  fromLocationId: string;
  itemKey?: string;
  containerId?: string;
}

interface FinishWorkingPayload {
  itemKey: string;
  barcode: string;
  orderId: string;
  packageType?: string;
}

interface LocateWorkingPayload {
  itemKey: string;
  barcode: string;
  orderId: string;
  toLocation: string;
  packageType?: string;
  quantity?: number;
  containerId?: string;
  notes?: string;
}

type ProductionPayload = WithdrawToWorkingPayload | FinishWorkingPayload | LocateWorkingPayload;

const callProductionOperate = async (op: ProductionOp, payload: ProductionPayload) => {
  const callable = httpsCallable(functions, 'productionOperate');
  try {
    const result = await callable({ op, payload });
    return (result?.data || {}) as { ok?: boolean; opId?: string; itemKey?: string };
  } catch (error: any) {
    const code = error?.code || 'unknown';
    const message = error?.message || 'Production operation failed';
    throw new Error(`${code}: ${message}`);
  }
};

export const productionApi = {
  withdrawToWorking: (payload: WithdrawToWorkingPayload) =>
    callProductionOperate('withdrawToWorking', payload),

  finishWorking: (payload: FinishWorkingPayload) =>
    callProductionOperate('finishWorking', payload),

  locateWorking: (payload: LocateWorkingPayload) =>
    callProductionOperate('locateWorking', payload),
};


