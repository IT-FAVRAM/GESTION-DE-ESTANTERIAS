"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.admin = void 0;
const admin = require("firebase-admin");
exports.admin = admin;
if (!admin.apps.length) {
    admin.initializeApp();
}
//# sourceMappingURL=firebaseAdmin.js.map