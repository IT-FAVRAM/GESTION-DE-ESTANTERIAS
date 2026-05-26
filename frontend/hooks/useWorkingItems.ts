import { useState, useEffect, useCallback } from 'react';
import { db } from '../legacy/firebaseCompat';
import { LocationId, WorkingItem } from '../lib/warehouseData';
import { productionApi } from '../lib/api/productionApi';

export const useWorkingItems = () => {
    const [workingItems, setWorkingItems] = useState<WorkingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const unsubscribe = db.collection('workingItems').onSnapshot(
            (snapshot) => {
                const items: WorkingItem[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data() as WorkingItem;
                    items.push({
                        ...data,
                        itemKey: data.itemKey || doc.id,
                    });
                });
                // Sort by withdrawnAt descending (newest first)
                items.sort((a, b) => new Date(b.withdrawnAt).getTime() - new Date(a.withdrawnAt).getTime());
                setWorkingItems(items);
                setLoading(false);
            },
            (err) => {
                console.error("Error obteniendo items en trabajo:", err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const finishItem = useCallback(async (item: WorkingItem) => {
        try {
            await productionApi.finishWorking({
                itemKey: item.itemKey || item.barcode,
                barcode: item.barcode,
                orderId: item.orderId,
                packageType: item.packageType,
            });
            return true;
        } catch (e) {
            console.error("Error finalizando item:", e);
            throw e;
        }
    }, []);

    const locateItem = useCallback(async (item: WorkingItem, toLocation: LocationId) => {
        try {
            await productionApi.locateWorking({
                itemKey: item.itemKey || item.barcode,
                barcode: item.barcode,
                orderId: item.orderId,
                toLocation,
                packageType: item.packageType,
                quantity: 1,
                containerId: item.containerId,
                notes: item.notes,
            });
            return true;
        } catch (e) {
            console.error("Error localizando item desde trabajo:", e);
            throw e;
        }
    }, []);

    return {
        workingItems,
        loading,
        error,
        finishItem,
        locateItem
    };
};


