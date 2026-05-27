type OperationalRole = 'OPERARIO' | 'CARRETILLERO' | 'ADMIN' | 'SUPERADMIN' | 'CALIDAD';

export type OperationalSession = {
  role: OperationalRole;
  deviceId: string;
  operarioId: string;
  operarioName?: string | null;
};

const DEVICE_ID_KEY = 'wms_device_id';
const GUEST_SESSION_KEY = 'wms_guest_session';
const OPERARIO_SESSION_KEY = 'wms_operario_session';

const hasBrowser = () => typeof window !== 'undefined';

export const getDeviceIdFromStorage = () => {
  if (!hasBrowser()) return null;
  return window.localStorage.getItem(DEVICE_ID_KEY);
};

export const getOperationalSession = (): OperationalSession | undefined => {
  if (!hasBrowser()) return undefined;

  const deviceId = getDeviceIdFromStorage();
  if (!deviceId) {
    return undefined;
  }

  // Leer desde la guest session de localStorage (escrita por useAuth)
  const rawGuest = window.localStorage.getItem(GUEST_SESSION_KEY);
  if (rawGuest) {
    try {
      const parsed = JSON.parse(rawGuest) as {
        role?: string;
        operarioId?: string;
        operario?: { name?: string | null };
      };
      const allowed = ['OPERARIO', 'CARRETILLERO', 'ADMIN', 'SUPERADMIN', 'CALIDAD'];
      const role = allowed.includes(parsed.role || '') ? (parsed.role as OperationalRole) : null;
      if (!role || !parsed.operarioId) {
        return undefined;
      }
      return {
        role,
        deviceId,
        operarioId: String(parsed.operarioId).trim(),
        operarioName: parsed.operario?.name || null,
      };
    } catch {
      return undefined;
    }
  }

  // Fallback legacy: sessionStorage (por si otra parte del sistema lo escribe)
  const rawSession = window.sessionStorage.getItem(OPERARIO_SESSION_KEY);
  if (!rawSession) {
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


