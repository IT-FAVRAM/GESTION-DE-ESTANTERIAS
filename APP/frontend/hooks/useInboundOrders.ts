import { useState, useEffect } from 'react';
import { db } from '../legacy/firebaseCompat';
import { InboundOrder } from '../lib/warehouseData';
import { inboundOrdersApi } from '../lib/api/inboundOrdersApi';

export const useInboundOrders = (limitCount: number = 100) => {
    const [orders, setOrders] = useState<InboundOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = db.collection('inboundOrders')
            .orderBy('createdAt', 'desc')
            .limit(limitCount)
            .onSnapshot(snapshot => {
                const loadedOrders = snapshot.docs.map(doc => doc.data() as InboundOrder);
                setOrders(loadedOrders);
                setLoading(false);
            }, err => {
                console.error(err);
                setError("Error cargando pedidos: " + err.message);
                setLoading(false);
            });
        return () => unsubscribe();
    }, [limitCount]);

    const createOrder = async (order: InboundOrder) => {
        try {
            await inboundOrdersApi.create(order);
            return { success: true };
        } catch (e: any) {
            console.error(e);
            return { success: false, error: e.message };
        }
    };

    const updateOrder = async (orderId: string, updates: Partial<InboundOrder>) => {
        try {
            await inboundOrdersApi.update(orderId, updates);
            return { success: true };
        } catch (e: any) {
            console.error(e);
            return { success: false, error: e.message };
        }
    };

    const deleteOrder = async (orderId: string) => {
        try {
            await inboundOrdersApi.delete(orderId);
            return { success: true };
        } catch (e: any) {
            console.error(e);
            return { success: false, error: e.message };
        }
    }

    return { orders, loading, error, createOrder, updateOrder, deleteOrder };
};
