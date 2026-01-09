
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

// Usamos una colección genérica para los carros nuevos
const COLLECTION_NAME = 'supplies_carts';

export const useGenericSupplies = (docId: string) => {
    const [items, setItems] = useState<SupplyItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!docId) return;
        
        setLoading(true);
        // Subscribe to items subcollection of the specific document
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

        const newItem: Omit<SupplyItem, 'id'> = {
            shelfId,
            type,
            description: data.description,
            barcode: data.barcode,
            orderId: data.orderId,
            addedBy: auth.currentUser.uid,
            createdAt: new Date().toISOString()
        };

        await db.collection(COLLECTION_NAME).doc(docId).collection('items').add(newItem);
    };

    const removeItems = async (itemIds: string[]) => {
        if (itemIds.length === 0 || !docId) return;

        const batch = db.batch();
        itemIds.forEach(id => {
            const ref = db.collection(COLLECTION_NAME).doc(docId).collection('items').doc(id);
            batch.delete(ref);
        });
        await batch.commit();
    };

    const moveItems = async (itemIds: string[], targetShelfId: string) => {
        if (itemIds.length === 0 || !docId) return;

        const batch = db.batch();
        itemIds.forEach(id => {
            const ref = db.collection(COLLECTION_NAME).doc(docId).collection('items').doc(id);
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
