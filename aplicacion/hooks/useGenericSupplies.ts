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

const COLLECTION_NAME = 'supplies_carts';

export const useGenericSupplies = (docId: string) => {
    const [items, setItems] = useState<SupplyItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!docId) return;

        setLoading(true);
        const unsubscribe = db.collection(COLLECTION_NAME).doc(docId).collection('items')
            .onSnapshot(snapshot => {
                const loadedItems = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as SupplyItem));
                setItems(loadedItems);
                setLoading(false);
            }, err => {
                console.error(`Error fetching supplies for ${docId}:`, err);
                setLoading(false);
            });

        return () => unsubscribe();
    }, [docId]);

    const addItem = async (shelfId: string, type: 'article' | 'plain', data: { description: string, barcode?: string, orderId?: string }) => {
        if (!auth.currentUser || !docId) return;
        try {
            await suppliesApi.addItem(COLLECTION_NAME, docId, shelfId, type, data);
        } catch (e: any) {
            console.error("Error adding supply item:", e);
        }
    };

    const removeItems = async (itemIds: string[]) => {
        if (itemIds.length === 0 || !docId) return;
        try {
            await suppliesApi.removeItems(COLLECTION_NAME, docId, itemIds);
        } catch (e: any) {
            console.error("Error removing supply items:", e);
        }
    };

    const moveItems = async (itemIds: string[], targetShelfId: string) => {
        if (itemIds.length === 0 || !docId) return;
        try {
            await suppliesApi.moveItems(COLLECTION_NAME, docId, itemIds, targetShelfId);
        } catch (e: any) {
            console.error("Error moving supply items:", e);
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
