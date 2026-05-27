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
      admin.firestore().collection('usuarios').where('email', 'in', group).get(),
    ),
  );

  return batches.flatMap((snapshot) => snapshot.docs);
};

export const getUsersByRole = async (role: string) => {
  const normalizedRole = normalizeRole(role);
  const snapshot = await admin.firestore().collection('usuarios').where('role', '==', normalizedRole).get();
  return snapshot.docs;
};

export const getAppConfig = async () => {
  const snapshot = await admin.firestore().collection('config').doc('app').get();
  return snapshot.exists ? snapshot.data() || {} : {};
};

// Only skip cleanup on known transient errors (server-side issues that may resolve).
// All other errors (unregistered token, invalid argument, sender-id mismatch,
// permission revoked, etc.) indicate a dead token that should be cleaned up.
const TRANSIENT_FCM_ERRORS = new Set([
  'messaging/internal',
  'messaging/unavailable',
  'messaging/server-unavailable',
  'messaging/too-many-topics',
  'messaging/quota-exceeded',
]);

const saveNotificationHistory = async (
  payload: { title: string; body: string; data?: Record<string, string> },
  result: { successCount: number; failureCount: number; totalTokens: number },
  recipientUserIds: string[],
) => {
  try {
    await admin.firestore().collection('notificationHistory').add({
      title: payload.title,
      body: payload.body,
      data: payload.data || null,
      sentAt: new Date().toISOString(),
      successCount: result.successCount,
      failureCount: result.failureCount,
      totalTokens: result.totalTokens,
      recipientUserIds,
    });
  } catch (err) {
    console.error('[sendPushToUsers] Error saving notification history:', err);
  }
};

export const sendPushToUsers = async (
  userDocs: FirebaseFirestore.QueryDocumentSnapshot[],
  payload: { title: string; body: string; data?: Record<string, string> },
) => {
  const tokens: string[] = [];
  const tokenOwners = new Map<string, string>();
  const recipientUserIds: string[] = [];

  userDocs.forEach((doc) => {
    const userData = doc.data();
    const userTokens = Array.isArray(userData?.fcmTokens) ? userData.fcmTokens : [];
    if (userTokens.length > 0) {
      recipientUserIds.push(doc.id);
    }
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
  let cleanedTokens = 0;

  response.responses.forEach((item, index) => {
    if (item.success || !item.error) return;
    if (TRANSIENT_FCM_ERRORS.has(item.error.code)) return;
    const token = tokens[index];
    const ownerId = tokenOwners.get(token);
    if (!ownerId) return;
    cleanupTasks.push(
      admin.firestore().collection('usuarios').doc(ownerId).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
      }),
    );
    cleanedTokens++;
  });

  await Promise.all(cleanupTasks);

  const result = {
    successCount: response.successCount,
    failureCount: response.failureCount,
    totalTokens: tokens.length,
  };

  if (result.successCount === 0 && result.failureCount > 0) {
    console.warn(
      `[sendPushToUsers] All sends failed: ${result.failureCount}/${result.totalTokens} tokens failed. Cleaned ${cleanedTokens} invalid tokens.`,
      { payload: { title: payload.title, body: payload.body } },
    );
  }

  // Save to notification history asynchronously (don't block the response)
  saveNotificationHistory(payload, result, recipientUserIds).catch(console.warn);

  return { successCount: result.successCount, failureCount: result.failureCount };
};

export const notifyUsersByEmails = async (
  emails: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
) => sendPushToUsers(await getUsersByEmails(emails), payload);

export const notifyUsersByRole = async (
  role: string,
  payload: { title: string; body: string; data?: Record<string, string> },
) => sendPushToUsers(await getUsersByRole(role), payload);
