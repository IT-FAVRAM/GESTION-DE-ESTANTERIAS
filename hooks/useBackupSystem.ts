
import { useState } from 'react';
import { db } from '../lib/firebase';
import { Assignments, HistoryEntry } from '../lib/warehouseData';
import { WarehouseConfig } from './useWarehouseConfig';
import { 
    WarehouseBackupData, 
    downloadBackupFile, 
    BACKUP_VERSION
} from '../lib/backup.ts';

export const useBackupSystem = (
    assignments: Assignments,
    setAssignments: (a: Assignments) => void,
    history: HistoryEntry[],
    setHistory: (h: HistoryEntry[]) => void,
    config: WarehouseConfig,
    setConfig: (c: WarehouseConfig) => void
) => {
    const [isLoading, setIsLoading] = useState(false);

    // --- EXPORT FROM FIRESTORE (Compat) ---
    const handleExport = async () => {
        setIsLoading(true);
        try {
            // 1. Assignments
            const assignmentsSnap = await db.collection("meta").doc("assignments").get();
            const assignmentsData = assignmentsSnap.exists ? (assignmentsSnap.data() as any).assignments : {};

            // 2. Config
            const configSnap = await db.collection("meta").doc("warehouseConfig").get();
            const configData = configSnap.exists ? configSnap.data() as WarehouseConfig : config;

            // 3. History
            const historySnap = await db.collection("history").get();
            const historyData = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // 4. Users
            const usersSnap = await db.collection("users").get();
            const usersData = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

            // 5. FinishedItems
            const finishedItemsSnap = await db.collection("finishedItems").get();
            const finishedItemsData = finishedItemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const backup: WarehouseBackupData = {
                version: BACKUP_VERSION,
                timestamp: new Date().toISOString(),
                assignments: assignmentsData,
                history: historyData as any[],
                config: configData,
                users: usersData,
                finishedItems: finishedItemsData
            };

            downloadBackupFile(backup);

        } catch (err) {
            console.error("Error creating backup from Firestore", err);
            alert("Error al generar backup desde la nube: " + (err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async (file: File): Promise<{ success: boolean; message: string }> => {
        return { success: false, message: "La restauración desde archivo está deshabilitada en esta versión (Solo Backup Cloud)." };
    };

    const restoreAutoBackup = () => {
        return { success: false, message: "La restauración automática está desactivada." };
    };

    return {
        handleExport,
        handleImport,
        restoreAutoBackup,
        lastAutoSave: null,
        hasAutoBackup: false,
        isLoading
    };
};
