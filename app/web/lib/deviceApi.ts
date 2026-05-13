import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseV3';
import type { DeviceDoc } from './firestoreSchema';

export const fetchDeviceConfig = async (deviceId: string) => {
  const callable = httpsCallable(functions, 'resolveDeviceConfig');
  const result = await callable({ deviceId });
  return (result?.data || {}) as { exists?: boolean; device?: DeviceDoc };
};

export const sendDeviceHeartbeat = async (deviceId: string) => {
  const callable = httpsCallable(functions, 'deviceHeartbeat');
  const result = await callable({ deviceId });
  return (result?.data || {}) as { ok?: boolean; exists?: boolean };
};
