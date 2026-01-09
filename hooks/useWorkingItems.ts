import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { WorkingItem } from '../lib/warehouseData';
import { finishWorkingItem } from '../lib/production';

export const useWorkingItems = () => {
    const [workingItems, setWorkingItems] = useState<WorkingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const unsubscribe = db.collection('workingItems').onSnapshot(
            (snapshot) => {
                const items: WorkingItem[] = [];
                snapshot.forEach((doc) => {
                    items.push(doc.data() as WorkingItem);
                });
                // Sort by withdrawnAt descending (newest first)
                items.sort((a, b) => new Date(b.withdrawnAt).getTime() - new Date(a.withdrawnAt).getTime());
                setWorkingItems(items);
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching working items:", err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const finishItem = useCallback(async (item: WorkingItem, user?: { uid: string; displayName: string }) => {
        try {
            await finishWorkingItem(item, user);
            return true;
        } catch (e) {
            console.error("Error finishing item:", e);
            throw e;
        }
    }, []);

    return {
        workingItems,
        loading,
        error,
        finishItem
    };
};
