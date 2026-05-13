import { db } from '../legacy/firebaseCompat';
import { LocationId } from './warehouseData';
import firebase from "firebase/compat/app";

export const migrateComodinStructure = async (
    onProgress: (msg: string) => void
): Promise<{ success: boolean; error?: string; count?: number }> => {
    try {
        onProgress("Iniciando migración de Zona Comodín...");

        // 1. Identify all Comodín locations that need to be moved (E2 to E6)
        // Since we are now using E1 for everything, we need to find data in E2, E3, E4, E5, E6
        const oldShelves = [2, 3, 4, 5, 6];
        let movedCount = 0;

        for (const shelf of oldShelves) {
            onProgress(`Revisando Estantería ${shelf}...`);
            const shelfCollection = db.collection("assignments").doc("COM").collection("locations");

            // In our current DB structure, documents are named "COM-EX-B1-COM XXX"
            // We need to find all that start with "COM-E2", "COM-E3", etc.
            // Firestore doesn't support wildcard IDs easily without a collection group query or filtering.
            // But we know the exact IDs because they are predictable.

            const startPos = (shelf - 1) * 3 + 1;
            const positions = [
                `COM ${String(startPos).padStart(3, '0')}`,
                `COM ${String(startPos + 1).padStart(3, '0')}`,
                `COM ${String(startPos + 2).padStart(3, '0')}`
            ];

            for (const pos of positions) {
                const oldLocId = `COM-E${shelf}-B1-${pos}`;
                const newLocId = `COM-E1-B1-${pos}`;

                const docRef = shelfCollection.doc(oldLocId);
                const snap = await docRef.get();

                if (snap.exists) {
                    const data = snap.data();
                    if (data && data.items && data.items.length > 0) {
                        onProgress(`Moviendo ${pos} de E${shelf} a E1...`);

                        // Set new location
                        await shelfCollection.doc(newLocId).set({
                            ...data,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });

                        // Delete old location
                        await docRef.delete();
                        movedCount++;
                    }
                }
            }
        }

        onProgress(`Migración finalizada. Se han movido ${movedCount} ubicaciones.`);
        return { success: true, count: movedCount };

    } catch (err: any) {
        console.error("Migration error:", err);
        return { success: false, error: err.message };
    }
};
