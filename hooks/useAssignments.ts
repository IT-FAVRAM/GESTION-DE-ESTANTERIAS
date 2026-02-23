
import { useEffect, useCallback, useState, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { useLocalStorage } from './useLocalStorage';
import { Assignments, AssignmentItem, LocationId } from '../lib/warehouseData';
import firebase from "firebase/compat/app";

export const useAssignments = (activeWarehouse?: string) => {
  const [storageScope, setStorageScope] = useState('guest');
  const [assignments, setAssignments, syncAssignments] = useLocalStorage<Assignments>(`warehouse_assignments_all_${storageScope}`, {} as Assignments);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref to track which warehouses have received their first snapshot
  const initializedWarehouses = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      setStorageScope(user?.uid || 'guest');
      if (!user) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    setLoading(true);
    initializedWarehouses.current = new Set();
    const unsubscribes: (() => void)[] = [];

    // Internal state to accumulate assignments across all listeners
    // We use a local variable to merge updates before setting the state
    let globalAssignments: Assignments = { ...assignments };

    const warehousesToSubscribe = activeWarehouse ? [activeWarehouse] : ['MEC'];

    warehousesToSubscribe.forEach(whCode => {
      const ref = db.collection("assignments").doc(whCode).collection("locations");

      const unsubscribe = ref.onSnapshot(
        (snapshot) => {
          // Update only the locations belonging to THIS warehouse in the global assignments
          const updatedAssignments = { ...globalAssignments };

          // First, clean up existing locations for this warehouse to handle deletions correctly
          Object.keys(updatedAssignments).forEach(locId => {
            if (locId.startsWith(`${whCode}-`)) {
              delete updatedAssignments[locId as LocationId];
            }
          });

          // Add current items from snapshot
          snapshot.docs.forEach(doc => {
            const items = doc.data().items as AssignmentItem[];
            if (items && items.length > 0) {
              updatedAssignments[doc.id as LocationId] = items;
            }
          });

          globalAssignments = updatedAssignments;
          setAssignments(globalAssignments);

          // Track initialization
          initializedWarehouses.current.add(whCode);
          if (initializedWarehouses.current.size === warehousesToSubscribe.length) {
            setLoading(false);
          }
          setError(null);
        },
        (err) => {
          console.error(`Error subscribing to warehouse ${whCode}:`, err);
          if (err.code !== 'permission-denied') {
            setError(`Error al sincronizar almacén ${whCode}.`);
          }
          // Mark as initialized even on error to not block the app forever
          initializedWarehouses.current.add(whCode);
          if (initializedWarehouses.current.size === warehousesToSubscribe.length) {
            setLoading(false);
          }
        }
      );
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [setAssignments, isAuthenticated, activeWarehouse]);

  const saveAssignments = useCallback(async (nextOrUpdater: Assignments | ((prev: Assignments) => Assignments)) => {
    let next: Assignments;
    if (typeof nextOrUpdater === 'function') {
      next = (nextOrUpdater as (prev: Assignments) => Assignments)(assignments);
    } else {
      next = nextOrUpdater;
    }

    setAssignments(next);

    if (auth.currentUser) {
      const locsToWrite: Record<string, any> = {};
      const locsToDelete: string[] = [];

      // 1. Check for Additions/Updates
      Object.entries(next).forEach(([loc, items]) => {
        const prevItems = assignments[loc];
        if (JSON.stringify(prevItems) !== JSON.stringify(items)) {
          locsToWrite[loc] = items.map(item => ({
            barcode: item.barcode,
            orderId: item.orderId,
            timestamp: item.timestamp || new Date().toISOString(),
            assignedAt: item.assignedAt || null,
            movedAt: item.movedAt || null,
            status: item.status || 'UBICADO',
            packageType: item.packageType || null,
            itemKey: item.itemKey || null,
            quantity: item.quantity ?? 1,
            containerId: item.containerId || null,
            notes: item.notes || null
          }));
        }
      });

      // 2. Check for Deletions
      Object.keys(assignments).forEach(loc => {
        if (!next[loc] || next[loc].length === 0) {
          if (assignments[loc] && assignments[loc].length > 0) {
            locsToDelete.push(loc);
          }
        }
      });

      const batch = db.batch();
      let opsCount = 0;

      // Writers
      Object.entries(locsToWrite).forEach(([locId, items]) => {
        const targetWh = locId.split('-')[0];
        if (targetWh) {
          const docRef = db.collection("assignments").doc(targetWh).collection("locations").doc(locId);
          batch.set(docRef, {
            items: items,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          opsCount++;

          // Batch limit check (Firestore limit is usually 500, we can be safe at 400)
          if (opsCount >= 400) {
            // This would need more complex logic to handle multiple batches,
            // but for standard individual operations it's fine.
          }
        }
      });

      // Deleters
      locsToDelete.forEach(locId => {
        const targetWh = locId.split('-')[0];
        if (targetWh) {
          const docRef = db.collection("assignments").doc(targetWh).collection("locations").doc(locId);
          batch.delete(docRef);
          opsCount++;
        }
      });

      if (opsCount > 0) {
        try {
          await batch.commit();
        } catch (err) {
          console.error("Error saving partitioned assignments:", err);
          setError("Falló el guardado en la nube.");
        }
      }
    }
  }, [assignments, setAssignments]);

  const removeAssignment = useCallback(async (locationId: LocationId, barcode: string, orderId: string) => {
    await saveAssignments((prev) => {
      const currentItems = prev[locationId] || [];
      const newItems = currentItems.filter(item =>
        !(item.barcode === barcode && item.orderId === orderId)
      );

      const next = { ...prev };
      if (newItems.length === 0) {
        delete next[locationId];
      } else {
        next[locationId] = newItems;
      }
      return next;
    });
  }, [saveAssignments]);

  return {
    assignments,
    setAssignments: saveAssignments,
    removeAssignment,
    syncAssignments,
    loading,
    error
  };
};
