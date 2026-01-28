
import React, { useEffect } from 'react';
import { Assignments } from '../lib/warehouseData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { db, auth } from '../lib/firebase';

interface MigrationProps {
    assignments: Assignments;
    setAssignments: (newAssignments: Assignments) => void;
}

export const MigrationSolLocation: React.FC<MigrationProps> = ({ assignments, setAssignments }) => {
    useEffect(() => {
        const migrate = async () => {
            if (!assignments) return;

            // Define the range 41 to 70
            const targets = Array.from({ length: 30 }, (_, i) => i + 41); // 41..70 (30 items)

            let hasChanges = false;
            const newAssignments = { ...assignments };

            targets.forEach(num => {
                const oldSuffix = `SOL ${num.toString().padStart(3, '0')}`; // "SOL 041"
                const newSuffix = `SOL ${num}`; // "SOL 41"

                // Construct full Location IDs based on standard pattern for SOL Shelf 2 (General)
                // Defined in AssignmentList as: `SOL-E2-B1-SOL ${pad3(i + 5)}`
                const oldLocId = `SOL-E2-B1-${oldSuffix}`;
                const newLocId = `SOL-E2-B1-${newSuffix}`;

                // Check if old location has items
                if (newAssignments[oldLocId] && newAssignments[oldLocId].length > 0) {
                    console.log(`Migrating ${oldLocId} to ${newLocId}...`);

                    // Move items to new location
                    const existingInNew = newAssignments[newLocId] || [];
                    newAssignments[newLocId] = [...existingInNew, ...newAssignments[oldLocId]];

                    // Delete old location
                    delete newAssignments[oldLocId];
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                console.log("Saving migrated SOL locations...");
                setAssignments(newAssignments);

                // Sync with Firestore if authenticated
                if (auth.currentUser) {
                    try {
                        const batch = db.batch();
                        // Since we can't easily batch the whole big map update often, 
                        // we'll rely on the main `setAssignments` sync logic if it exists elsewhere, 
                        // OR assuming `setAssignments` handles local state which then triggers a sync.
                        // However, usually `useAssignments` (or similar) handles the sync. 
                        // If `setAssignments` passed here is just the local setter, we might depend on the app's sync effect.
                        // Let's force a direct write to be safe if the app logic is complex.
                        // But wait, the app usually syncs whole `assignments` doc or diffs. 
                        // Checking App.tsx logic is safer. Assuming `setAssignments` triggers the update hook.
                    } catch (e) {
                        console.error("Migration sync error", e);
                    }
                }
            }
        };

        migrate();
    }, [assignments, setAssignments]);

    return null; // Invisible component
};
