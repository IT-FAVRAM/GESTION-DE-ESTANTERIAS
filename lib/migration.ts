
import { db } from './firebase';
import { Assignments, LocationId } from './warehouseData';
import firebase from "firebase/compat/app";

export const migrateAssignments = async (
    onProgress: (msg: string) => void
): Promise<{ success: boolean; error?: string }> => {
    try {
        onProgress("Iniciando migración...");

        // 1. Read old monolithic document
        const oldRef = db.collection("meta").doc("assignments");
        const doc = await oldRef.get();
        if (!doc.exists) {
            return { success: false, error: "No existe meta/assignments para migrar." };
        }

        const data = doc.data() as { assignments: Assignments };
        const assignments = data.assignments || {};

        const totalKeys = Object.keys(assignments).length;
        onProgress(`Leídas ${totalKeys} ubicaciones del sistema legacy.`);

        if (totalKeys === 0) {
            return { success: true };
        }

        // 2. Prepare Batches
        // Firestore batch limit is 500 operations.
        const BATCH_SIZE = 450;
        let batches: firebase.firestore.WriteBatch[] = [];
        let currentBatch = db.batch();
        let opCount = 0;

        // Group writes
        Object.entries(assignments).forEach(([locId, items]) => {
            if (!items || items.length === 0) return;

            const targetWh = locId.split('-')[0];
            if (!targetWh) {
                console.warn(`Skipping invalid locId: ${locId}`);
                return;
            }

            const newDocRef = db.collection("assignments").doc(targetWh).collection("locations").doc(locId);

            // Clean items just in case
            const cleanItems = items.map(item => ({
                barcode: item.barcode,
                orderId: item.orderId,
                timestamp: item.timestamp || new Date().toISOString(),
                assignedAt: item.assignedAt || null,
                movedAt: item.movedAt || null
            }));

            currentBatch.set(newDocRef, {
                items: cleanItems,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            opCount++;

            if (opCount >= BATCH_SIZE) {
                batches.push(currentBatch);
                currentBatch = db.batch();
                opCount = 0;
            }
        });

        // Push last batch
        if (opCount > 0) {
            batches.push(currentBatch);
        }

        onProgress(`Preparados ${batches.length} lotes de escritura para particionado.`);

        // 3. Execute Writes
        for (let i = 0; i < batches.length; i++) {
            onProgress(`Escribiendo lote ${i + 1} de ${batches.length}...`);
            await batches[i].commit();
        }

        // 4. Backup Old Data
        onProgress("Escritura completada. Creando backup del legacy...");
        await db.collection("meta").doc("assignments_backup").set(data);

        // 5. Delete or Mark Old Data
        // We DELETE it to force errors if anyone is still reading it (and to free space eventually)
        // actually, keeping it as backup is safer, but "migrated: true" flag?
        // Let's just create a flag doc so we know.
        await db.collection("meta").doc("migration_status").set({
            partitioned: true,
            migratedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // WARNING: We do NOT delete "meta/assignments" automatically to be super safe. 
        // User should delete it manually after verifying.
        // OR we replace it with a tombstone? 
        // Let's replace it with { migrated: true } so old clients fail gracefully? 
        // No, current useAssignments checks for data.assignments.
        // We will leave it for now. The new app ignores it (reads subcollections).

        onProgress("Migración exitosa.");
        return { success: true };

    } catch (err: any) {
        console.error("Migration error:", err);
        return { success: false, error: err.message };
    }
};

// --- PHASE 1: ROLE NORMALIZATION ---

import { UserRole } from '../hooks/useRoles';

const ROLE_NORMALIZATION_MAP: Record<string, UserRole> = {
    'ADMINISTRACIÓN': 'ADMIN',
    'JEFE SECCIÓN': 'JEFE',
    'JEFE SECCION': 'JEFE',
    'ADMIN': 'ADMIN',
    'JEFE': 'JEFE',
    'CARRETILLERO': 'CARRETILLERO'
};

export const migrateUserRoles = async (
    onProgress: (msg: string) => void
): Promise<{ success: boolean; error?: string }> => {
    try {
        onProgress("Iniciando normalización de roles de usuarios...");

        const usersRef = db.collection("users");
        const snapshot = await usersRef.get();

        if (snapshot.empty) {
            return { success: true, error: "No se encontraron usuarios para migrar." };
        }

        const batch = db.batch();
        let updateCount = 0;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const rawRole = data.role as string;
            const legacyUserField = data.user as string; // Check legacy field

            // Determine target role
            let targetRole: UserRole | null = null;
            let sourceValue = rawRole || legacyUserField;

            if (sourceValue) {
                const normalized = ROLE_NORMALIZATION_MAP[sourceValue.trim().toUpperCase()];
                if (normalized) targetRole = normalized;
            }

            // Only update if we have a valid target role and it differs or is missing
            if (targetRole && (data.role !== targetRole || !data.role)) {
                batch.update(doc.ref, {
                    role: targetRole,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    roleNormalized: true
                });
                updateCount++;
                onProgress(`Preparando actualización para usuario ${doc.id} -> ${targetRole}`);
            }
        });

        if (updateCount > 0) {
            onProgress(`Ejecutando ${updateCount} actualizaciones de rol...`);
            await batch.commit();
            onProgress("Actualización de roles completada con éxito.");
        } else {
            onProgress("Todos los usuarios ya tienen roles normalizados.");
        }

        return { success: true };

    } catch (err: any) {
        console.error("Role migration error:", err);
        return { success: false, error: err.message };
    }
};
