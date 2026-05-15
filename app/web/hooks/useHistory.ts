
import { useEffect, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { HistoryEntry } from '../lib/warehouseData';
import { db, auth } from '../legacy/firebaseCompat';

export const useHistory = () => {
  const [storageScope, setStorageScope] = useState('guest');
  const [history, setHistory, syncHistory] = useLocalStorage<HistoryEntry[]>(`warehouse_history_${storageScope}`, []);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      setStorageScope(user?.uid || 'guest');
      if (!user) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Firestore 'history' collection (Compat)
  useEffect(() => {
    if (!isAuthenticated) return;

    setLoading(true);
    const historyRef = db.collection("history");
    const q = historyRef.orderBy("timestamp", "desc").limit(1000);

    const unsubscribe = q.onSnapshot(
      (snap) => {
        const items: HistoryEntry[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          items.push({
            id: docSnap.id,
            barcode: data.barcode,
            orderId: data.orderId,
            action: data.action,
            fromLocation: data.fromLocation,
            toLocation: data.toLocation,
            timestamp: data.timestamp
          } as HistoryEntry);
        });
        setHistory(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        if (err.code !== 'permission-denied') {
            console.error("Error escuchando historial en Firestore:", err);
            setError("Error al cargar el historial.");
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [setHistory, isAuthenticated]);

  const addHistoryEntry = async (entry: Omit<HistoryEntry, 'id' | 'timestamp'> & { timestamp?: string }) => {
    const timestamp = entry.timestamp || new Date().toISOString();
    
    // 1. Optimistic UI update
    setHistory(prev => {
        const newEntry: HistoryEntry = {
            id: crypto.randomUUID(), 
            timestamp,
            ...entry
        };
        return [newEntry, ...prev];
    });

    // 2. Persist to Firestore (Compat)
    if (auth.currentUser) {
        const historyRef = db.collection("history");
        try {
            // Sanitize payload to remove undefined values
            const payload = {
                barcode: entry.barcode,
                action: entry.action,
                timestamp: timestamp,
                orderId: entry.orderId || null,
                fromLocation: entry.fromLocation || null,
                toLocation: entry.toLocation || null
            };

            await historyRef.add(payload);
        } catch (err) {
            console.error("Error guardando historial en Firestore:", err);
            setError("Error al guardar en historial.");
        }
    }
  };

  return {
    history,
    setHistory,
    addHistoryEntry,
    syncHistory,
    loading,
    error
  };
};
