import { useState, useEffect } from 'react';
import { db, auth } from '../legacy/firebaseCompat';
import { suppliesApi } from '../lib/api/suppliesApi';

export interface SupplyItem {
    id: string;
    shelfId: string;
    type: 'article' | 'plain';
    description: string;
    barcode?: string;
    orderId?: string;
    addedBy: string;
    createdAt: string;
}

const DOC_ID = 'REPUESTOS_SOLDADURA';
const COLLECTION = 'supplies_soldadura';

export const useWeldingSupplies = () => {
    const [items, setItems] = useState<SupplyItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = db.collection(COLLECTION).doc(DOC_ID).collection('items')
            .onSnapshot(snapshot => {
                const loadedItems = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as SupplyItem));
                setItems(loadedItems);
                setLoading(false);
            }, err => {
                console.error("Error fetching welding supplies:", err);
                setLoading(false);
            });

        return () => unsubscribe();
    }, []);

    const addItem = async (shelfId: string, type: 'article' | 'plain', data: { description: string, barcode?: string, orderId?: string }) => {
        if (!auth.currentUser) return;
        try {
            await suppliesApi.addItem(COLLECTION, DOC_ID, shelfId, type, data);
        } catch (e: any) {
            console.error("Error adding welding supply:", e);
        }
    };

    const removeItems = async (itemIds: string[]) => {
        if (itemIds.length === 0) return;
        try {
            await suppliesApi.removeItems(COLLECTION, DOC_ID, itemIds);
        } catch (e: any) {
            console.error("Error removing welding supplies:", e);
        }
    };

    const moveItems = async (itemIds: string[], targetShelfId: string) => {
        if (itemIds.length === 0) return;
        try {
            await suppliesApi.moveItems(COLLECTION, DOC_ID, itemIds, targetShelfId);
        } catch (e: any) {
            console.error("Error moving welding supplies:", e);
        }
    };

    return {
        items,
        loading,
        addItem,
        removeItems,
        moveItems
    };
};
