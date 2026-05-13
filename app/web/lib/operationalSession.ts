type OperationalRole = 'OPERARIO' | 'CARRETILLERO';

export type OperationalSession = {
  role: OperationalRole;
  deviceId: string;
  operarioId: string;
  operarioName?: string | null;
};

const DEVICE_ID_KEY = 'wms_device_id';
const OPERARIO_SESSION_KEY = 'wms_operario_session';

const hasBrowser = () => typeof window !== 'undefined';

export const getDeviceIdFromStorage = () => {
  if (!hasBrowser()) return null;
  return window.localStorage.getItem(DEVICE_ID_KEY);
};

export const getOperationalSession = (): OperationalSession | undefined => {
  if (!hasBrowser()) return undefined;

  const rawSession = window.sessionStorage.getItem(OPERARIO_SESSION_KEY);
  const deviceId = getDeviceIdFromStorage();
  if (!rawSession || !deviceId) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawSession) as {
      role?: string;
      operarioId?: string;
      operario?: { name?: string | null };
    };
    const role = parsed.role === 'CARRETILLERO' ? 'CARRETILLERO' : 'OPERARIO';
    const operarioId = String(parsed.operarioId || '').trim();
    if (!operarioId) {
      return undefined;
    }

    return {
      role,
      deviceId,
      operarioId,
      operarioName: parsed.operario?.name || null,
    };
  } catch {
    return undefined;
  }
};
