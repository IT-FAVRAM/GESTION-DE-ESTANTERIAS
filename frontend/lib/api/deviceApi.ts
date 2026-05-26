import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../firebase/index.js';
import type { DeviceDoc } from '../firestoreSchema';

type ResolveDeviceResult = {
  exists?: boolean;
  device?: DeviceDoc;
  claimsUpdated?: boolean;
};

export const fetchDeviceConfig = async (deviceId: string) => {
  const callable = httpsCallable(functions, 'resolveDeviceConfig');
  const result = await callable({ deviceId });
  const data = (result?.data || {}) as ResolveDeviceResult;

  // The server sets `validatedDevice: true` as a custom claim on the first call.
  // Force-refresh the ID token so Firestore security rules pick it up immediately,
  // instead of waiting for the automatic hourly refresh.
  if (data.claimsUpdated && auth.currentUser) {
    try {
      await auth.currentUser.getIdToken(true);
    } catch {
      // Non-fatal: all writes go through Cloud Functions which do their own
      // device validation. Firestore reads will unlock on the next token refresh.
    }
  }

  return { exists: data.exists, device: data.device };
};

export const sendDeviceHeartbeat = async (deviceId: string) => {
  const callable = httpsCallable(functions, 'deviceHeartbeat');
  const result = await callable({ deviceId });
  return (result?.data || {}) as { ok?: boolean; exists?: boolean };
};


