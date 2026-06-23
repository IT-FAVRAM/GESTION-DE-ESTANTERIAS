import { useState, useEffect } from 'react';
import { db, auth } from '../legacy/firebaseCompat';
import { cartsApi } from '../lib/api/cartsApi';

export interface CartItem {
    id: string;
    shelfId: string;
    type: 'article' | 'plain';
    description: string;
    barcode?: string;
    orderId?: string;
    addedBy: string;
    createdAt: string;
}

export const CARTS_CONFIG = [
    { id: 'CS', name: 'Carro Soldadura', shelves: 4 },
    { id: 'CP1', name: 'Carro Plegado 1', shelves: 4 },
    { id: 'CP2', name: 'Carro Plegado 2', shelves: 4 },
    { id: 'CRP', name: 'Carro Robot Plegado', shelves: 4 },
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
        try {
            await cartsApi.addItem(cartId, shelfId, type, data);
        } catch (e: any) {
            console.error("Error adding item to cart:", e);
        }
    };

    const removeItems = async (itemIds: string[]) => {
        if (!cartId || itemIds.length === 0) return;
        try {
            await cartsApi.removeItems(cartId, itemIds);
        } catch (e: any) {
            console.error("Error removing items from cart:", e);
        }
    };

    const moveItems = async (itemIds: string[], targetShelfId: string) => {
        if (!cartId || itemIds.length === 0) return;
        try {
            await cartsApi.moveItems(cartId, itemIds, targetShelfId);
        } catch (e: any) {
            console.error("Error moving items in cart:", e);
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
