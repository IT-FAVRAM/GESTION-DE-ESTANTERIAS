/**
 * audit-BD-complete.ts - Auditoría simplificada de Firestore
 * Uso: importado desde admin.ts para ejecutar vía adminOperate
 */

import { admin } from '../src/firebaseAdmin';

interface AuditIssue {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: string;
  message: string;
  details?: any;
}

export const auditDatabase = async (): Promise<AuditIssue[]> => {
  const issues: AuditIssue[] = [];
  const db = admin.firestore();

  try {
    // Auditoría de Estanterías
    const shelvesSnap = await db.collection('shelves').get();
    for (const shelfDoc of shelvesSnap.docs) {
      const shelfCode = shelfDoc.id;
      const shelfData = shelfDoc.data() || {};

      if (!shelfData.locationCount || shelfData.locationCount < 1) {
        issues.push({
          severity: 'WARNING',
          category: 'SHELF_STRUCTURE',
          message: `Estantería ${shelfCode}: locationCount no definido`,
          details: { shelfCode }
        });
      }

      const locationsSnap = await db.collection('shelves').doc(shelfCode).collection('locations').get();
      const locCount = locationsSnap.size;
      const expectedCount = shelfData.locationCount || 0;

      if (locCount !== expectedCount && expectedCount > 0) {
        issues.push({
          severity: 'CRITICAL',
          category: 'LOCATION_COUNT_MISMATCH',
          message: `${shelfCode}: ${locCount} ubicaciones vs ${expectedCount} esperadas`,
          details: { shelfCode, actual: locCount, expected: expectedCount }
        });
      }
    }

    // Auditoría de Usuarios
    const usersSnap = await db.collection('usuarios').get();
    const validRoles = ['OPERARIO', 'CARRETILLERO', 'JEFE_SECCION', 'CALIDAD', 'ADMIN', 'SUPERADMIN'];

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data() || {};
      if (!userData.email || !userData.role) {
        issues.push({
          severity: 'WARNING',
          category: 'USER_STRUCTURE',
          message: `Usuario ${userDoc.id}: falta email o role`,
          details: { userId: userDoc.id }
        });
      }
      if (!validRoles.includes(userData.role)) {
        issues.push({
          severity: 'WARNING',
          category: 'USER_STRUCTURE',
          message: `Usuario ${userDoc.id}: rol inválido (${userData.role})`,
          details: { userId: userDoc.id, role: userData.role }
        });
      }
    }

    // Auditoría de Dispositivos
    const devicesSnap = await db.collection('dispositivos').get();
    for (const devDoc of devicesSnap.docs) {
      const devData = devDoc.data() || {};
      if (!['KIOSK', 'CARRETILLERO'].includes(devData.type)) {
        issues.push({
          severity: 'WARNING',
          category: 'DEVICE_STRUCTURE',
          message: `Dispositivo ${devDoc.id}: tipo inválido (${devData.type})`,
          details: { deviceId: devDoc.id }
        });
      }
    }

    // Auditoría de Config
    const configSnap = await db.collection('config').doc('app').get();
    if (!configSnap.exists) {
      issues.push({
        severity: 'CRITICAL',
        category: 'CONFIG',
        message: 'Documento de configuración no existe',
        details: {}
      });
    } else {
      const config = configSnap.data() || {};
      if (!Array.isArray(config.urgentLocations)) {
        issues.push({
          severity: 'WARNING',
          category: 'CONFIG',
          message: 'Config: urgentLocations no es array',
          details: {}
        });
      }
    }

    return issues;
  } catch (err) {
    console.error('Error en auditDatabase:', err);
    return [{
      severity: 'CRITICAL',
      category: 'AUDIT_ERROR',
      message: `Error ejecutando auditoría: ${err instanceof Error ? err.message : String(err)}`,
      details: {}
    }];
  }
};
