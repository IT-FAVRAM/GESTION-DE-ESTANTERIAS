
import { Assignments, HistoryEntry } from './warehouseData';
import { WarehouseConfig } from '../hooks/useWarehouseConfig';

export const BACKUP_VERSION = 1;

export interface WarehouseBackupData {
    version: number;
    timestamp: string;
    assignments: Assignments;
    history: HistoryEntry[];
    config: WarehouseConfig;
    users?: any[];
    finishedItems?: any[];
}

export const generateBackupData = (
    assignments: Assignments,
    history: HistoryEntry[],
    config: WarehouseConfig
): WarehouseBackupData => {
    return {
        version: BACKUP_VERSION,
        timestamp: new Date().toISOString(),
        assignments,
        history,
        config
    };
};

export const downloadBackupFile = (data: WarehouseBackupData) => {
    const filename = `backup_cloud_almacen_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const validateBackupData = (data: any): { isValid: boolean; error?: string } => {
    if (!data || typeof data !== 'object') {
        return { isValid: false, error: 'Formato de archivo inválido (no es JSON válido).' };
    }

    if (data.version !== BACKUP_VERSION) {
        return { isValid: false, error: `Versión de backup incompatible. (Archivo: v${data.version}, App: v${BACKUP_VERSION})` };
    }

    if (!data.assignments || typeof data.assignments !== 'object') {
        return { isValid: false, error: 'Faltan datos de asignaciones (assignments).' };
    }

    if (!Array.isArray(data.history)) {
        return { isValid: false, error: 'Faltan datos de historial (history).' };
    }

    if (!data.config || !Array.isArray(data.config.warehouses)) {
        return { isValid: false, error: 'Faltan datos de configuración del almacén.' };
    }

    return { isValid: true };
};

export const readBackupFile = (file: File): Promise<WarehouseBackupData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                resolve(json);
            } catch (err) {
                reject(new Error("No se pudo leer el archivo JSON."));
            }
        };
        reader.onerror = () => reject(new Error("Error de lectura de archivo."));
        reader.readAsText(file);
    });
};

/**
 * Creates a cloud backup in Firestore at meta/backups/snapshots/{timestamp}
 */
import { db } from '../legacy/firebaseCompat';

export const backupToCloud = async (
    assignments: Assignments,
    history: HistoryEntry[],
    config: WarehouseConfig
): Promise<string> => {
    try {
        const data = generateBackupData(assignments, history, config);
        // Also fetch users for completeness if possible, but for now we backup the core operational data passed in opts

        // We might want to backup users too, but that requires a separate read. 
        // Let's assume for this phase we backup what we have in memory (Assignments/History/Config) 
        // plus we can try to grab users in the calling component or here.
        // For simplicity and safety (as requested in Phase 0), we will fetch users here to ensure full snapshot.

        const usersSnap = await db.collection("users").get();
        const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const fullBackup = {
            ...data,
            users: usersData,
            backupAgent: 'ANTIGRAVITY_AUTO'
        };

        const backupId = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        await db.collection("meta").doc("backups").collection("snapshots").doc(backupId).set(fullBackup);

        return backupId;
    } catch (error: any) {
        console.error("Backup failed:", error);
        throw new Error("Error creando backup en cloud: " + error.message);
    }
};


