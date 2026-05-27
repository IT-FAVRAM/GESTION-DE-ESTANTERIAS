#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
async function generateUserReport() {
    try {
        console.log('🔄 Iniciando generación de reporte de usuarios activos...');
        const usersCollection = firebaseAdmin_1.admin.firestore().collection('users');
        const snapshot = await usersCollection.get();
        if (snapshot.empty) {
            console.log('⚠️  No se encontraron usuarios en la colección');
            return;
        }
        let totalUsers = 0;
        let activeUsers = 0;
        let activeWithFcmTokens = 0;
        const roleCounts = {};
        snapshot.forEach((doc) => {
            totalUsers++;
            const userData = doc.data();
            // Contar por rol
            const role = userData.role || 'unknown';
            roleCounts[role] = (roleCounts[role] || 0) + 1;
            // Determinar si el usuario está activo
            // Priorizar el campo 'active' si existe, sino considerar activo por defecto
            const isActive = userData.active !== false; // activo si no es explícitamente false
            if (isActive) {
                activeUsers++;
                // Verificar si tiene tokens FCM configurados
                const fcmTokens = userData.fcmTokens || [];
                if (Array.isArray(fcmTokens) && fcmTokens.length > 0) {
                    activeWithFcmTokens++;
                }
            }
        });
        console.log('\n📊 REPORTE DE USUARIOS ACTIVOS Y PUSH CONFIGURADO');
        console.log('='.repeat(50));
        console.log(`👥 Total de usuarios listados: ${totalUsers}`);
        console.log(`✅ Usuarios activos: ${activeUsers}`);
        console.log(`📱 Usuarios activos con FCM tokens: ${activeWithFcmTokens}`);
        console.log(`📱 Usuarios activos SIN FCM tokens: ${activeUsers - activeWithFcmTokens}`);
        if (Object.keys(roleCounts).length > 0) {
            console.log('\n👥 Desglose por rol:');
            Object.entries(roleCounts)
                .sort(([, a], [, b]) => b - a)
                .forEach(([role, count]) => {
                console.log(`  ${role}: ${count}`);
            });
        }
        console.log('\n✅ Reporte generado exitosamente');
    }
    catch (error) {
        console.error('❌ Error al generar el reporte:', error);
        process.exit(1);
    }
}
// Ejecutar el reporte
generateUserReport();
//# sourceMappingURL=generate_report.js.map