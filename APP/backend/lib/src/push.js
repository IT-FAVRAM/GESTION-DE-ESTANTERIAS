"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyUserById = exports.notifyUsersByRole = exports.notifyUsersByEmails = exports.sendPushToUsers = exports.getAppConfig = exports.getUserById = exports.getUsersByRole = exports.getUsersByEmails = void 0;
const firebaseAdmin_1 = require("./firebaseAdmin");
const authz_1 = require("./authz");
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const chunk = (items, size) => {
    const groups = [];
    for (let index = 0; index < items.length; index += size) {
        groups.push(items.slice(index, index + size));
    }
    return groups;
};
const getUsersByEmails = async (emails) => {
    const normalizedEmails = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
    if (normalizedEmails.length === 0) {
        return [];
    }
    const batches = await Promise.all(chunk(normalizedEmails, 10).map((group) => firebaseAdmin_1.admin.firestore().collection('usuarios').where('email', 'in', group).get()));
    return batches.flatMap((snapshot) => snapshot.docs);
};
exports.getUsersByEmails = getUsersByEmails;
const getUsersByRole = async (role) => {
    const normalizedRole = (0, authz_1.normalizeRole)(role);
    const snapshot = await firebaseAdmin_1.admin.firestore().collection('usuarios').where('role', '==', normalizedRole).get();
    return snapshot.docs;
};
exports.getUsersByRole = getUsersByRole;
const getUserById = async (uid) => {
    const cleanUid = String(uid || '').trim();
    if (!cleanUid)
        return [];
    const doc = await firebaseAdmin_1.admin.firestore().collection('usuarios').doc(cleanUid).get();
    return doc.exists ? [doc] : [];
};
exports.getUserById = getUserById;
const getAppConfig = async () => {
    const snapshot = await firebaseAdmin_1.admin.firestore().collection('config').doc('app').get();
    return snapshot.exists ? snapshot.data() || {} : {};
};
exports.getAppConfig = getAppConfig;
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
const saveNotificationHistory = async (payload, result, recipientUserIds) => {
    try {
        await firebaseAdmin_1.admin.firestore().collection('notificationHistory').add({
            title: payload.title,
            body: payload.body,
            data: payload.data || null,
            sentAt: new Date().toISOString(),
            successCount: result.successCount,
            failureCount: result.failureCount,
            totalTokens: result.totalTokens,
            recipientUserIds,
        });
    }
    catch (err) {
        console.error('[sendPushToUsers] Error saving notification history:', err);
    }
};
const sendPushToUsers = async (userDocs, payload) => {
    const tokens = [];
    const tokenOwners = new Map();
    const recipientUserIds = [];
    userDocs.forEach((doc) => {
        const userData = doc.data();
        const userTokens = Array.isArray(userData === null || userData === void 0 ? void 0 : userData.fcmTokens) ? userData.fcmTokens : [];
        if (userTokens.length > 0) {
            recipientUserIds.push(doc.id);
        }
        userTokens.forEach((token) => {
            if (!token)
                return;
            tokens.push(token);
            tokenOwners.set(token, doc.id);
        });
    });
    if (tokens.length === 0) {
        return { successCount: 0, failureCount: 0 };
    }
    const FCM_BATCH_LIMIT = 500;
    let totalSuccess = 0;
    let totalFailure = 0;
    const allCleanupTasks = [];
    for (let i = 0; i < tokens.length; i += FCM_BATCH_LIMIT) {
        const tokenBatch = tokens.slice(i, i + FCM_BATCH_LIMIT);
        const response = await firebaseAdmin_1.admin.messaging().sendEachForMulticast({
            tokens: tokenBatch,
            notification: { title: payload.title, body: payload.body },
            data: payload.data,
            android: { priority: 'high' },
            webpush: { headers: { Urgency: 'high' } },
        });
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;
        response.responses.forEach((item, index) => {
            if (item.success || !item.error)
                return;
            if (TRANSIENT_FCM_ERRORS.has(item.error.code))
                return;
            const token = tokenBatch[index];
            const ownerId = tokenOwners.get(token);
            if (!ownerId)
                return;
            allCleanupTasks.push(firebaseAdmin_1.admin.firestore().collection('usuarios').doc(ownerId).update({
                fcmTokens: firebaseAdmin_1.admin.firestore.FieldValue.arrayRemove(token),
            }));
        });
    }
    await Promise.all(allCleanupTasks);
    const result = {
        successCount: totalSuccess,
        failureCount: totalFailure,
        totalTokens: tokens.length,
    };
    if (result.successCount === 0 && result.failureCount > 0) {
        console.warn(`[sendPushToUsers] All sends failed: ${result.failureCount}/${result.totalTokens} tokens failed.`, { payload: { title: payload.title, body: payload.body } });
    }
    // Save to notification history asynchronously (don't block the response)
    saveNotificationHistory(payload, result, recipientUserIds).catch(console.warn);
    return { successCount: result.successCount, failureCount: result.failureCount };
};
exports.sendPushToUsers = sendPushToUsers;
const notifyUsersByEmails = async (emails, payload) => (0, exports.sendPushToUsers)(await (0, exports.getUsersByEmails)(emails), payload);
exports.notifyUsersByEmails = notifyUsersByEmails;
const notifyUsersByRole = async (role, payload) => (0, exports.sendPushToUsers)(await (0, exports.getUsersByRole)(role), payload);
exports.notifyUsersByRole = notifyUsersByRole;
const notifyUserById = async (uid, payload) => (0, exports.sendPushToUsers)(await (0, exports.getUserById)(uid), payload);
exports.notifyUserById = notifyUserById;
//# sourceMappingURL=push.js.map