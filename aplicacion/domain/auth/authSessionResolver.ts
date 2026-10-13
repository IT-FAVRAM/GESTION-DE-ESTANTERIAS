import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import {
  COLLECTIONS,
  type UserDoc,
  type UserRole,
  type WarehouseSection,
} from '../../lib/firestoreSchema';
import { readGuestSession, AUTH_STORAGE_KEYS } from './authStorage';
import { resolveCapabilities } from './authCapabilities';
import { resolveAssignedShelfForRole } from './sectionShelf';
import type { AuthMethod, SessionCapabilities, SessionKind } from './authTypes';

type GuestSession = {
  role: UserRole;
  section?: WarehouseSection;
  assignedShelf: string | null;
  displayName?: string;
};

export type ResolvedAuthSession = {
  role: UserRole | null;
  section: WarehouseSection | null;
  authMethod: AuthMethod | null;
  assignedShelf: string | null;
  /** Estanterías adicionales que el kiosko puede operar (device.allowedShelves). */
  allowedShelves: string[] | null;
  sessionKind: SessionKind;
  displayName: string;
  capabilities: SessionCapabilities;
};

const buildResolvedSession = ({
  role,
  section,
  authMethod,
  assignedShelf,
  allowedShelves,
  sessionKind,
  displayName,
}: Omit<ResolvedAuthSession, 'capabilities'>): ResolvedAuthSession => ({
  role,
  section,
  authMethod,
  assignedShelf,
  allowedShelves,
  sessionKind,
  displayName,
  capabilities: resolveCapabilities(role, authMethod, assignedShelf),
});

/** Lee device.allowedShelves del dispositivo del kiosko (para la validación de permisos). */
const readDeviceAllowedShelves = async (): Promise<string[] | null> => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const deviceId = localStorage.getItem(AUTH_STORAGE_KEYS.DEVICE_ID);
    if (!deviceId) return null;
    const snap = await getDoc(doc(db, COLLECTIONS.DEVICES, deviceId));
    if (!snap.exists()) return null;
    const arr = (snap.data() as { allowedShelves?: unknown }).allowedShelves;
    return Array.isArray(arr) ? (arr as string[]) : null;
  } catch {
    // Si falla la lectura, el backend sigue validando permisos igualmente.
    return null;
  }
};

export const resolveCurrentAuthSession = async (): Promise<ResolvedAuthSession> => {
  const guestSession = readGuestSession<GuestSession>();
  if (guestSession) {
    const allowedShelves = guestSession.role === 'OPERARIO' ? await readDeviceAllowedShelves() : null;
    return buildResolvedSession({
      role: guestSession.role,
      section: guestSession.section || null,
      authMethod: 'guest',
      assignedShelf: guestSession.assignedShelf || null,
      allowedShelves,
      sessionKind: 'kiosk',
      displayName: guestSession.displayName || '',
    });
  }

  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    return buildResolvedSession({
      role: null,
      section: null,
      authMethod: null,
      assignedShelf: null,
      allowedShelves: null,
      sessionKind: 'none',
      displayName: '',
    });
  }

  const snap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
  const userData = snap.exists() ? (snap.data() as UserDoc) : null;
  const role = userData?.role || null;
  const section = userData?.section || null;

  return buildResolvedSession({
    role,
    section,
    authMethod: 'email',
    assignedShelf: resolveAssignedShelfForRole(role, section),
    allowedShelves: null,
    sessionKind: 'authenticated',
    displayName: userData?.displayName || user.email || '',
  });
};


