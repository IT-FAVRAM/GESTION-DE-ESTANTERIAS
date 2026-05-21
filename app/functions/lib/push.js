"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyUsersByRole = exports.notifyUsersByEmails = exports.sendPushToUsers = exports.getAppConfig = exports.getUsersByRole = exports.getUsersByEmails = void 0;
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
const getAppConfig = async () => {
    const snapshot = await firebaseAdmin_1.admin.firestore().collection('config').doc('app').get();
    return snapshot.exists ? snapshot.data() || {} : {};
};
exports.getAppConfig = getAppConfig;
const sendPushToUsers = async (userDocs, payload) => {
    const tokens = [];
    const tokenOwners = new Map();
    userDocs.forEach((doc) => {
        const userData = doc.data();
        const userTokens = Array.isArray(userData === null || userData === void 0 ? void 0 : userData.fcmTokens) ? userData.fcmTokens : [];
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
    const response = await firebaseAdmin_1.admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        android: { priority: 'high' },
        webpush: { headers: { Urgency: 'high' } },
    });
    const cleanupTasks = [];
    response.responses.forEach((item, index) => {
        if (item.success || !item.error)
            return;
        if (item.error.code !== 'messaging/registration-token-not-registered' && item.error.code !== 'messaging/invalid-argument')
            return;
        const token = tokens[index];
        const ownerId = tokenOwners.get(token);
        if (!ownerId)
            return;
        cleanupTasks.push(firebaseAdmin_1.admin.firestore().collection('usuarios').doc(ownerId).update({
            fcmTokens: firebaseAdmin_1.admin.firestore.FieldValue.arrayRemove(token),
        }));
    });
    await Promise.all(cleanupTasks);
    return { successCount: response.successCount, failureCount: response.failureCount };
};
exports.sendPushToUsers = sendPushToUsers;
const notifyUsersByEmails = async (emails, payload) => (0, exports.sendPushToUsers)(await (0, exports.getUsersByEmails)(emails), payload);
exports.notifyUsersByEmails = notifyUsersByEmails;
const notifyUsersByRole = async (role, payload) => (0, exports.sendPushToUsers)(await (0, exports.getUsersByRole)(role), payload);
exports.notifyUsersByRole = notifyUsersByRole;
//# sourceMappingURL=push.js.map