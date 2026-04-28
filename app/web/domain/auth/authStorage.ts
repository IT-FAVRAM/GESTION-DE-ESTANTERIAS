export const AUTH_STORAGE_KEYS = {
  DEVICE_ID: 'wms_device_id',
  GUEST_SESSION: 'wms_guest_session',
  OPERARIO_SESSION: 'wms_operario_session',
} as const;

export const clearAllSessionData = (): void => {
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.OPERARIO_SESSION);
  localStorage.removeItem(AUTH_STORAGE_KEYS.GUEST_SESSION);
};

export const readGuestSession = <T>(): T | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.GUEST_SESSION);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const writeGuestSession = (session: unknown): void => {
  localStorage.setItem(AUTH_STORAGE_KEYS.GUEST_SESSION, JSON.stringify(session));
};

export const getOrCreateDeviceId = (): string => {
  let id = localStorage.getItem(AUTH_STORAGE_KEYS.DEVICE_ID);
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(AUTH_STORAGE_KEYS.DEVICE_ID, id);
  }
  return id;
};
