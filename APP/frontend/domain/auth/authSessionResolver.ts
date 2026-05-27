import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import {
  COLLECTIONS,
  type UserDoc,
  type UserRole,
  type WarehouseSection,
} from '../../lib/firestoreSchema';
import { readGuestSession } from './authStorage';
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
  sessionKind: SessionKind;
  displayName: string;
  capabilities: SessionCapabilities;
};

const buildResolvedSession = ({
  role,
  section,
  authMethod,
  assignedShelf,
  sessionKind,
  displayName,
}: Omit<ResolvedAuthSession, 'capabilities'>): ResolvedAuthSession => ({
  role,
  section,
  authMethod,
  assignedShelf,
  sessionKind,
  displayName,
  capabilities: resolveCapabilities(role, authMethod, assignedShelf),
});

export const resolveCurrentAuthSession = async (): Promise<ResolvedAuthSession> => {
  const guestSession = readGuestSession<GuestSession>();
  if (guestSession) {
    return buildResolvedSession({
      role: guestSession.role,
      section: guestSession.section || null,
      authMethod: 'guest',
      assignedShelf: guestSession.assignedShelf || null,
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
    sessionKind: 'authenticated',
    displayName: userData?.displayName || user.email || '',
  });
};


