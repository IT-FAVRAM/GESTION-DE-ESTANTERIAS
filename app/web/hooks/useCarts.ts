
import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../legacy/firebaseCompat';
import firebase from 'firebase/compat/app';

export interface CartItem {
    id: string;
    shelfId: string; // "1", "2", etc.
    type: 'article' | 'plain';
    description: string; // "Tornillos" or "ART: ABC - OF: 123"
    barcode?: string;
    orderId?: string;
    addedBy: string;
    createdAt: string;
}

export const CARTS_CONFIG = [
    { id: 'CARRO_SOLDADURA', name: 'Carro Soldadura', shelves: 8 },
    { id: 'CARRO_SXP', name: 'Carro SXP', shelves: 4 },
    { id: 'CARRO_ROBOT_PLEGADO', name: 'Carro Autoplegadora', shelves: 4 },
];

export const useCarts = (cartId: string | null) => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!cartId) {
            setItems([]);
            return;
        }

        setLoading(true);
        // Subscribe to items subcollection of the specific cart
        const unsubscribe = db.collection('carts').doc(cartId).collection('items')
            .onSnapshot(snapshot => {
                const loadedItems = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as CartItem));
                setItems(loadedItems);
                setLoading(false);
            }, err => {
                console.error("Error obteniendo items del carro:", err);
                setLoading(false);
            });

        return () => unsubscribe();
    }, [cartId]);

    const addItem = async (shelfId: string, type: 'article' | 'plain', data: { description: string, barcode?: string, orderId?: string }) => {
        if (!cartId || !auth.currentUser) return;

        const newItem: Omit<CartItem, 'id'> = {
            shelfId,
            type,
            description: data.description,
            barcode: data.barcode,
            orderId: data.orderId,
            addedBy: auth.currentUser.uid,
            createdAt: new Date().toISOString()
        };

        await db.collection('carts').doc(cartId).collection('items').add(newItem);
    };

    const removeItems = async (itemIds: string[]) => {
        if (!cartId || itemIds.length === 0) return;

        const batch = db.batch();
        itemIds.forEach(id => {
            const ref = db.collection('carts').doc(cartId).collection('items').doc(id);
            batch.delete(ref);
        });
        await batch.commit();
    };

    const moveItems = async (itemIds: string[], targetShelfId: string) => {
        if (!cartId || itemIds.length === 0) return;

        const batch = db.batch();
        itemIds.forEach(id => {
            const ref = db.collection('carts').doc(cartId).collection('items').doc(id);
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
