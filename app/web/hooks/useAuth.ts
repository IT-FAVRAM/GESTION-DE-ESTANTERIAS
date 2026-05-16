import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { fetchDeviceConfig, sendDeviceHeartbeat } from '../lib/api/deviceApi';
import {
  type UserRole,
  type UserDoc,
  type DeviceDoc,
  type WarehouseSection,
  COLLECTIONS,
} from '../lib/firestoreSchema';
import { validateOperarioId, type Operario } from '../lib/api/operarioApi';
import {
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_STORAGE_KEYS,
  clearAllSessionData,
  readGuestSession,
  writeGuestSession,
  getOrCreateDeviceId,
} from '../domain/auth/authStorage';
import {
  canEditReprocesses as resolveCanEditReprocesses,
  canViewReprocessCosts as resolveCanViewReprocessCosts,
} from '../domain/reprocesos/reprocesosVisibility';
import { resolveCapabilities } from '../domain/auth/authCapabilities';
import type { AuthMethod } from '../domain/auth/authTypes';

// ── Auth resolved-state cache (for offline startup resilience) ────────────────

const AUTH_RESOLVED_CACHE_KEY = 'wms-auth-resolved-v1';

type AuthResolvedCache = {
  uid: string;
  role: UserRole;
  section: WarehouseSection | null;
  displayName: string;
  email: string;
  deviceMode: AuthMode;
};

const readAuthResolvedCache = (): AuthResolvedCache | null => {
  try {
    const raw = localStorage.getItem(AUTH_RESOLVED_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthResolvedCache) : null;
  } catch { return null; }
};

const writeAuthResolvedCache = (data: AuthResolvedCache) => {
  try { localStorage.setItem(AUTH_RESOLVED_CACHE_KEY, JSON.stringify(data)); } catch {}
};

const clearAuthResolvedCache = () => {
  try { localStorage.removeItem(AUTH_RESOLVED_CACHE_KEY); } catch {}
};

// ─────────────────────────────────────────────────────────────────────────────

const SECTION_TO_SHELF: Partial<Record<WarehouseSection, string>> = {
  MECANIZADO: 'MEC',
  PRENSAS: 'PRE',
  PLEGADORA: 'PLE',
  SOLDADURA: 'SOL',
  AUTOPLEGADORA: 'RPL',
  REPASADO: 'REP',
  PINTURA: 'PIN',
  CALIDAD: 'CAL',
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const signInAnonymouslyWithRetry = async () => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await signInAnonymously(auth);
    } catch (error: any) {
      lastError = error;
      const code = String(error?.code || '');
      if (code !== 'auth/operation-not-allowed' || attempt === 2) {
        throw error;
      }
      await wait(500 * (attempt + 1));
    }
  }
  throw lastError;
};

type GuestSession = {
  operarioId: string;
  operario: Operario | null;
  role: UserRole;
  section?: WarehouseSection;
  guest: true;
  assignedShelf: string | null;
  kioskId: string | null;
  displayName: string;
};

const resolveAssignedShelf = (role: UserRole, section?: WarehouseSection): string | null => {
  if (role === 'CALIDAD') return 'CAL';
  if (role !== 'OPERARIO') return null;
  return SECTION_TO_SHELF[section || 'MECANIZADO'] || 'MEC';
};

const buildGuestSession = (role: UserRole, section?: WarehouseSection): GuestSession => {
  const assignedShelf = resolveAssignedShelf(role, section);
  const displayNameByRole: Record<UserRole, string> = {
    OPERARIO: 'Operario Desarrollo',
    CARRETILLERO: 'Carretillero Desarrollo',
    JEFE_SECCION: 'Jefe Desarrollo',
    CALIDAD: 'Calidad Desarrollo',
    ADMIN: 'Admin Desarrollo',
    SUPERADMIN: 'Superadmin Desarrollo',
  };

  return {
    operarioId: `dev-${role.toLowerCase()}`,
    operario: role === 'OPERARIO'
      ? { id: '9999', name: displayNameByRole[role], department: section || 'MECANIZADO', active: true }
      : null,
    role,
    section,
    guest: true,
    assignedShelf,
    kioskId: null,
    displayName: displayNameByRole[role],
  };
};

export type AuthMode = 'kiosk' | 'carretillero' | 'admin' | 'unassigned' | 'loading';

export interface AuthState {
  loading: boolean;
  firebaseUser: User | null;
  role: UserRole | null;
  section: WarehouseSection | null;
  operario: Operario | null;
  operarioId: string | null;
  displayName: string;
  email: string | null;
  isKioskSession: boolean;
  assignedShelf: string | null;
  kioskId: string | null;
  deviceMode: AuthMode;
  authMethod: AuthMethod | null;
  error: string | null;
}

const buildSignedOutState = (prev: AuthState): AuthState => ({
  ...prev,
  loading: false,
  firebaseUser: null,
  role: null,
  section: null,
  operario: null,
  operarioId: null,
  displayName: '',
  email: null,
  isKioskSession: false,
  assignedShelf: null,
  kioskId: null,
  authMethod: null,
  error: null,
});

const getDeviceConfig = async (deviceId: string): Promise<DeviceDoc | null> => {
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.startsWith('192.')
  ) {
    return {
      type: 'CARRETILLERO',
      assignedShelf: null,
      name: 'Dispositivo Desarrollo',
      lastSeen: new Date().toISOString(),
      active: true,
    };
  }

  try {
    const result = await fetchDeviceConfig(deviceId);
    if (result.exists && result.device) return result.device;
    return null;
  } catch {
    return null;
  }
};

const resolveUserProfile = async (user: User): Promise<UserDoc | null> => {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
    if (snap.exists()) return snap.data() as UserDoc;
  } catch (e) {
    console.error('Error resolving profile', e);
  }
  return null;
};

export const useAuth = () => {
  const deviceId = getOrCreateDeviceId();

  const initialGuestSession = readGuestSession<GuestSession>();
  const initialAuthCache = !initialGuestSession ? readAuthResolvedCache() : null;

  // Pre-populate display fields from cache so they're ready when Firebase resolves.
  // Never set loading:false here — that would cause a flash to the login screen.
  const [state, setState] = useState<AuthState>({
    loading: initialGuestSession ? false : true,
    firebaseUser: null,
    role: initialGuestSession?.role ?? null,
    section: initialGuestSession?.section ?? null,
    operario: initialGuestSession?.operario ?? null,
    operarioId: initialGuestSession?.operarioId ?? null,
    displayName: initialGuestSession?.displayName ?? initialAuthCache?.displayName ?? '',
    email: initialAuthCache?.email ?? null,
    isKioskSession: !!initialGuestSession,
    assignedShelf: initialGuestSession?.assignedShelf ?? null,
    kioskId: initialGuestSession?.kioskId ?? null,
    deviceMode: initialGuestSession ? 'carretillero' : 'loading',
    authMethod: initialGuestSession ? 'guest' : null,
    error: null,
  });

  useEffect(() => {
    const detectMode = async () => {
      const deviceConfig = await getDeviceConfig(deviceId);
      if (!deviceConfig) {
        setState((prev) => ({ ...prev, deviceMode: 'admin', error: null }));
        return;
      }
      setState((prev) => ({
        ...prev,
        deviceMode: (deviceConfig.type?.toLowerCase() as AuthMode) || 'admin',
        assignedShelf: deviceConfig.assignedShelf || null,
        kioskId: deviceConfig.kioskId || null,
        error: null,
      }));
    };
    detectMode();
  }, [deviceId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || user.isAnonymous) {
        const session = readGuestSession<GuestSession>();
        if (session) {
          setState((prev) => ({
            ...prev,
            loading: false,
            firebaseUser: user,
            role: session.role,
            section: session.section || null,
            operario: session.operario,
            operarioId: session.operarioId,
            assignedShelf: session.assignedShelf || prev.assignedShelf,
            kioskId: session.kioskId || prev.kioskId,
            displayName: session.displayName || session.operario?.name || '',
            isKioskSession: true,
            authMethod: 'guest',
            error: null,
          }));
          return;
        }

        setState((prev) => ({
          ...prev,
          loading: false,
          firebaseUser: user,
          role: null,
          section: null,
          displayName: '',
          isKioskSession: false,
          authMethod: null,
          error: null,
        }));
        return;
      }

      const userData = await resolveUserProfile(user);

      // If Firestore returned nothing (cold cache + offline), fall back to localStorage cache
      const cachedForThisUser = initialAuthCache?.uid === user.uid ? initialAuthCache : null;
      const resolvedRole = userData?.role || cachedForThisUser?.role || null;
      const resolvedSection = userData?.section || cachedForThisUser?.section || null;
      const resolvedDisplayName = userData?.displayName || cachedForThisUser?.displayName || user.email || '';

      // Update cache whenever we have a good profile (online or Firestore cached)
      if (resolvedRole) {
        writeAuthResolvedCache({
          uid: user.uid,
          role: resolvedRole,
          section: resolvedSection,
          displayName: resolvedDisplayName,
          email: user.email || '',
          deviceMode: 'admin',
        });
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        firebaseUser: user,
        role: resolvedRole,
        section: resolvedSection,
        displayName: resolvedDisplayName,
        email: user.email,
        isKioskSession: false,
        authMethod: 'email',
        error: resolvedRole ? null : 'Usuario no configurado',
      }));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const syncGuestSession = () => {
      const session = readGuestSession<GuestSession>();
      if (session) {
        setState((prev) => ({
          ...prev,
          loading: false,
          firebaseUser: auth.currentUser,
          role: session.role,
          section: session.section || null,
          operario: session.operario,
          operarioId: session.operarioId,
          assignedShelf: session.assignedShelf || prev.assignedShelf,
          kioskId: session.kioskId || prev.kioskId,
          displayName: session.displayName || session.operario?.name || '',
          email: auth.currentUser?.email || null,
          isKioskSession: true,
          authMethod: 'guest',
          error: null,
        }));
        return;
      }

      if (!auth.currentUser) {
        setState((prev) => buildSignedOutState(prev));
      }
    };

    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, syncGuestSession);
    window.addEventListener('storage', syncGuestSession);

    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, syncGuestSession);
      window.removeEventListener('storage', syncGuestSession);
    };
  }, []);

  const loginAsGuest = useCallback(async (role: UserRole, section?: WarehouseSection) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      if (!['OPERARIO', 'CARRETILLERO'].includes(role)) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Este perfil requiere acceso con cuenta autorizada.',
        }));
        return false;
      }
      clearAllSessionData();
      try {
        await signOut(auth);
      } catch {
        // no-op if there is no Firebase session
      }
      await signInAnonymouslyWithRetry();

      const session = buildGuestSession(role, section);
      writeGuestSession(session);
      setState((prev) => ({
        ...prev,
        loading: false,
        firebaseUser: null,
        role,
        section: section || null,
        operario: session.operario,
        operarioId: session.operarioId,
        assignedShelf: session.assignedShelf,
        kioskId: session.kioskId,
        displayName: session.displayName,
        isKioskSession: true,
        authMethod: 'guest',
        error: null,
      }));
      return true;
    } catch (error: any) {
      localStorage.removeItem(AUTH_STORAGE_KEYS.GUEST_SESSION);
      const code = String(error?.code || '');
      const message = code === 'auth/operation-not-allowed'
        ? 'El acceso rapido requiere habilitar Anonymous Authentication en Firebase para OPERARIO/CARRETILLERO.'
        : code
          ? `Error al iniciar acceso rapido (${code}).`
        : 'Error al iniciar sesion de desarrollo';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      return false;
    }
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      clearAllSessionData();
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will fire and set authMethod: 'email'
      return true;
    } catch (e: any) {
      const msg = e?.code === 'auth/invalid-credential'
        ? 'Credenciales incorrectas'
        : 'Error de conexión. Comprueba tu red.';
      setState((prev) => ({ ...prev, loading: false, error: msg }));
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    clearAllSessionData();
    clearAuthResolvedCache();
    try {
      await signOut(auth);
    } catch {
      /* no-op if not signed in */
    }
    // Reset state — onAuthStateChanged will also fire (null user, no guest session)
    setState((prev) => buildSignedOutState(prev));
  }, []);

  const isAuthenticated =
    (state.firebaseUser !== null && state.role !== null) || state.isKioskSession;

  return {
    ...state,
    loginAsGuest,
    loginWithEmail,
    logout,
    isAuthenticated,
    canEditCarts:
      state.role === 'CARRETILLERO' ||
      state.role === 'ADMIN' ||
      state.role === 'SUPERADMIN',
    capabilities: resolveCapabilities(state.role, state.authMethod, state.assignedShelf),
    canEditReprocesses: resolveCanEditReprocesses(state.role, state.authMethod),
    canViewReprocessCosts: resolveCanViewReprocessCosts(state.role, state.authMethod),
    deviceId,
  };
};
