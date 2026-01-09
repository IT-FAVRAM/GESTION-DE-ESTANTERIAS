
import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';

export interface SupplyItem {
    id: string;
    shelfId: string; // "1" to "8"
    type: 'article' | 'plain';
    description: string;
    barcode?: string;
    orderId?: string;
    addedBy: string;
    createdAt: string;
}

const DOC_ID = 'REPUESTOS_SOLDADURA';

export const useWeldingSupplies = () => {
    const [items, setItems] = useState<SupplyItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        // Subscribe to items subcollection of the welding supplies document
        const unsubscribe = db.collection('supplies_soldadura').doc(DOC_ID).collection('items')
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

        const newItem: Omit<SupplyItem, 'id'> = {
            shelfId,
            type,
            description: data.description,
            barcode: data.barcode,
            orderId: data.orderId,
            addedBy: auth.currentUser.uid,
            createdAt: new Date().toISOString()
        };

        await db.collection('supplies_soldadura').doc(DOC_ID).collection('items').add(newItem);
    };

    const removeItems = async (itemIds: string[]) => {
        if (itemIds.length === 0) return;

        const batch = db.batch();
        itemIds.forEach(id => {
            const ref = db.collection('supplies_soldadura').doc(DOC_ID).collection('items').doc(id);
            batch.delete(ref);
        });
        await batch.commit();
    };

    const moveItems = async (itemIds: string[], targetShelfId: string) => {
        if (itemIds.length === 0) return;

        const batch = db.batch();
        itemIds.forEach(id => {
            const ref = db.collection('supplies_soldadura').doc(DOC_ID).collection('items').doc(id);
            batch.update(ref, { shelfId: targetShelfId });
        });
        await batch.commit();
    };

    return {
        items,
        loading,
        addItem,
        removeItems,
        moveItems
    };
};
