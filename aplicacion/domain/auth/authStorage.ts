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

// IDs de dispositivos kiosko fijos (registrados en Firebase/dispositivos).
// Si el URL contiene ?kiosko=prensas, se restaura este ID aunque el localStorage
// se haya limpiado. El marcador del ordenador kiosko debe incluir este parámetro.
const KIOSK_URL_TO_DEVICE_ID: Record<string, string> = {
  prensas:    'device_178031040273_3vj0pn',
  mecanizado: 'device_1780310509115_ow9t6y',
};

export const getOrCreateDeviceId = (): string => {
  // ?kiosko=XXX solo restaura el ID del marcador si el dispositivo no tiene uno
  // o si el ID existente ya corresponde a ese kiosko. Evita que un usuario externo
  // tome la identidad de un kiosko visitando la URL con el parámetro.
  if (typeof window !== 'undefined') {
    const kiosko = new URLSearchParams(window.location.search).get('kiosko');
    if (kiosko) {
      const fixedId = KIOSK_URL_TO_DEVICE_ID[kiosko.toLowerCase()];
      if (fixedId) {
        const existingId = localStorage.getItem(AUTH_STORAGE_KEYS.DEVICE_ID);
        if (!existingId || existingId === fixedId) {
          localStorage.setItem(AUTH_STORAGE_KEYS.DEVICE_ID, fixedId);
        }
        return localStorage.getItem(AUTH_STORAGE_KEYS.DEVICE_ID)!;
      }
    }
  }

  let id = localStorage.getItem(AUTH_STORAGE_KEYS.DEVICE_ID);
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(AUTH_STORAGE_KEYS.DEVICE_ID, id);
  }
  return id;
};


