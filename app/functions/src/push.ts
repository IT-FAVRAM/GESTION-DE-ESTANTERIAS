import { admin } from './firebaseAdmin';
import { normalizeRole } from './authz';

const normalizeEmail = (value?: string | null) => String(value || '').trim().toLowerCase();

const chunk = <T>(items: T[], size: number) => {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
};

export const getUsersByEmails = async (emails: string[]) => {
  const normalizedEmails = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  if (normalizedEmails.length === 0) {
    return [] as FirebaseFirestore.QueryDocumentSnapshot[];
  }

  const batches = await Promise.all(
    chunk(normalizedEmails, 10).map((group) =>
      admin.firestore().collection('users').where('email', 'in', group).get(),
    ),
  );

  return batches.flatMap((snapshot) => snapshot.docs);
};

export const getUsersByRole = async (role: string) => {
  const normalizedRole = normalizeRole(role);
  const snapshot = await admin.firestore().collection('users').where('role', '==', normalizedRole).get();
  return snapshot.docs;
};

export const getAppConfig = async () => {
  const snapshot = await admin.firestore().collection('config').doc('app').get();
  return snapshot.exists ? snapshot.data() || {} : {};
};

export const sendPushToUsers = async (
  userDocs: FirebaseFirestore.QueryDocumentSnapshot[],
  payload: { title: string; body: string; data?: Record<string, string> },
) => {
  const tokens: string[] = [];
  const tokenOwners = new Map<string, string>();

  userDocs.forEach((doc) => {
    const userData = doc.data();
    const userTokens = Array.isArray(userData?.fcmTokens) ? userData.fcmTokens : [];
    userTokens.forEach((token: string) => {
      if (!token) return;
      tokens.push(token);
      tokenOwners.set(token, doc.id);
    });
  });

  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
    android: { priority: 'high' },
    webpush: { headers: { Urgency: 'high' } },
  });

  const cleanupTasks: Array<Promise<unknown>> = [];
  response.responses.forEach((item, index) => {
    if (item.success || !item.error) return;
    if (item.error.code !== 'messaging/registration-token-not-registered' && item.error.code !== 'messaging/invalid-argument') return;
    const token = tokens[index];
    const ownerId = tokenOwners.get(token);
    if (!ownerId) return;
    cleanupTasks.push(
      admin.firestore().collection('users').doc(ownerId).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
      }),
    );
  });

  await Promise.all(cleanupTasks);
  return { successCount: response.successCount, failureCount: response.failureCount };
};

export const notifyUsersByEmails = async (
  emails: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
) => sendPushToUsers(await getUsersByEmails(emails), payload);

export const notifyUsersByRole = async (
  role: string,
  payload: { title: string; body: string; data?: Record<string, string> },
) => sendPushToUsers(await getUsersByRole(role), payload);
