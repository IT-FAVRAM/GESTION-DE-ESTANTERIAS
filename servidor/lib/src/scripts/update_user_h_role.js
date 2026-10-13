#!/usr/bin/env node
"use strict";
/**
 * update_user_h_role — Cambia el rol de H a CARRETILLERO
 */
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
async function updateUserH() {
    const db = firebaseAdmin_1.admin.firestore();
    console.log('🔧 Actualizando rol de usuario H...');
    console.log('='.repeat(60));
    try {
        await db.collection('usuarios').doc('oQeTtvMxJWPmpu9c6dSVHjV5rLV2').set({
            role: 'CARRETILLERO',
            section: null,
            displayName: 'H',
            email: 'h@favram.com',
            loginNames: ['H', 'h'],
            fcmTokens: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }, { merge: true });
        console.log('\n✅ Usuario H actualizado:');
        console.log('   - Nuevo rol: CARRETILLERO');
        console.log('   - Acceso a: SXP (mediante device allowedShelves)');
        return { ok: true };
    }
    catch (err) {
        console.error('❌ Error:', err);
        return { ok: false, error: String(err) };
    }
}
// Ejecutar si es llamado directamente
if (require.main === module) {
    const serviceAccount = require('../../../../serviceAccount.json');
    try {
        if (!firebaseAdmin_1.admin.apps.length) {
            firebaseAdmin_1.admin.initializeApp({
                credential: firebaseAdmin_1.admin.credential.cert(serviceAccount),
                projectId: 'gestion-de-estanterias',
            });
        }
    }
    catch (err) {
        console.warn('Firebase app already initialized, continuing...');
    }
    updateUserH()
        .then((result) => {
        console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
        process.exit(result.ok ? 0 : 1);
    })
        .catch((err) => {
        console.error('❌ Error fatal:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=update_user_h_role.js.map