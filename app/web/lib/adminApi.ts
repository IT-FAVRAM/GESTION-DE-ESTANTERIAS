import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseV3';
import type { AppConfig, DeviceDoc } from './firestoreSchema';

const callAdminOperate = async (op: string, payload: Record<string, unknown>) => {
  const callable = httpsCallable(functions, 'adminOperate');
  const result = await callable({ op, payload });
  return (result?.data || {}) as { ok?: boolean };
};

export const adminApi = {
  saveConfig: (config: Partial<AppConfig>) => callAdminOperate('saveConfig', config as Record<string, unknown>),
  upsertDevice: (deviceId: string, data: DeviceDoc) => callAdminOperate('upsertDevice', { deviceId, ...data }),
  updateDevice: (deviceId: string, data: Partial<DeviceDoc>) => callAdminOperate('updateDevice', { deviceId, ...data }),
  updateUser: (userId: string, data: { role: string; section?: string | null }) => callAdminOperate('updateUser', { userId, ...data }),
};
