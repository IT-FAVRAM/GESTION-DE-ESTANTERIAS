"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.admin = void 0;
const admin = require("firebase-admin");
exports.admin = admin;
const path = require("path");
const fs = require("fs");
if (!admin.apps.length) {
    // Buscar serviceAccount.json en la raíz del repo
    const possiblePaths = [
        path.resolve(__dirname, '../../../../serviceAccount.json'),
        path.resolve(__dirname, '../../../serviceAccount.json'),
        path.resolve(__dirname, '../../serviceAccount.json'),
        path.resolve(process.cwd(), 'serviceAccount.json'),
        path.resolve(process.cwd(), '../serviceAccount.json'),
    ];
    let serviceAccountPath = '';
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            serviceAccountPath = p;
            break;
        }
    }
    if (serviceAccountPath) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log(`[firebaseAdmin] Using service account: ${serviceAccountPath}`);
    }
    else {
        // Fallback: usar Application Default Credentials
        admin.initializeApp();
    }
}
//# sourceMappingURL=firebaseAdmin.js.map