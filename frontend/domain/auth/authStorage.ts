export const AUTH_STORAGE_KEYS = {
  DEVICE_ID: 'wms_device_id',
  GUEST_SESSION: 'wms_guest_session',
  OPERARIO_SESSION: 'wms_operario_session',
} as const;

export const AUTH_SESSION_CHANGED_EVENT = 'wms:auth-session-changed';

const notifyAuthSessionChanged = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT));
};

export const clearAllSessionData = (): void => {
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.OPERARIO_SESSION);
  localStorage.removeItem(AUTH_STORAGE_KEYS.GUEST_SESSION);
  localStorage.removeItem('guest_role');
  localStorage.removeItem('guest_section');
  notifyAuthSessionChanged();
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
  localStorage.removeItem('guest_role');
  localStorage.removeItem('guest_section');
  notifyAuthSessionChanged();
};

export const getOrCreateDeviceId = (): string => {
  let id = localStorage.getItem(AUTH_STORAGE_KEYS.DEVICE_ID);
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(AUTH_STORAGE_KEYS.DEVICE_ID, id);
  }
  return id;
};


