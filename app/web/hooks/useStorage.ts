
import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { FinishedItem } from '../lib/warehouseData';
import { auth, db } from '../legacy/firebaseCompat';
import firebase from 'firebase/compat/app';

export const useStorage = () => {
  const [finishedItems, setFinishedItems] = useLocalStorage<FinishedItem[]>('warehouse_finished_items', []);

  useEffect(() => {
    let unsubscribeFinished: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (unsubscribeFinished) {
        unsubscribeFinished();
        unsubscribeFinished = null;
      }

      if (!user) return;

      unsubscribeFinished = db
        .collection('finishedItems')
        .orderBy('finishedAt', 'desc')
        .onSnapshot(
          (snapshot) => {
            const items = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<FinishedItem, 'id'>) }));
            setFinishedItems(items);
          },
          (error) => {
            console.error('Error syncing finishedItems from Firestore:', error);
          }
        );
    });

    return () => {
      if (unsubscribeFinished) unsubscribeFinished();
      unsubscribeAuth();
    };
  }, [setFinishedItems]);

  const addFinishedItem = async (item: Omit<FinishedItem, 'id'>) => {
    const id = `${item.barcode.trim().toUpperCase()}__${item.orderId.trim().toUpperCase()}__${Date.now()}`;
    const newItem: FinishedItem = {
      id,
      ...item
    };

    setFinishedItems(prev => [newItem, ...prev]);

    if (auth.currentUser) {
      await db.collection('finishedItems').doc(id).set({
        ...item,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  };

  const removeFinishedItem = async (id: string) => {
      setFinishedItems(prev => prev.filter(item => item.id !== id));

      if (auth.currentUser) {
        await db.collection('finishedItems').doc(id).delete();
      }
  }

  const syncFinishedItemsFromCloud = async () => {
    if (!auth.currentUser) return;
    const snap = await db.collection('finishedItems').orderBy('finishedAt', 'desc').get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<FinishedItem, 'id'>) }));
    setFinishedItems(items);
  };

  return {
    finishedItems,
    setFinishedItems,
    addFinishedItem,
    removeFinishedItem,
    syncFinishedItems: syncFinishedItemsFromCloud
  };
};
