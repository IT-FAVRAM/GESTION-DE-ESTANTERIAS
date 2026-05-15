/**
 * bidirectionalSync.ts — Sincronización bidireccional de cambios
 * Gestor de Estanterías WMS v3.0
 *
 * Detecta cambios remotos mientras la app está offline y actualiza el caché local.
 */

import { collection, onSnapshot, query, where, type QueryConstraint } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, type ItemDoc } from '../firestoreSchema';

export interface SyncListener {
  unsubscribe: () => void;
  isActive: boolean;
}

const activeListeners = new Map<string, SyncListener>();

export const startBidirectionalSync = (): (() => void) => {
  const listeners: (() => void)[] = [];

  const syncItemsChanges = (): (() => void) => {
    try {
      const itemsQuery = query(
        collection(db, COLLECTIONS.ITEMS),
        where('active', '==', true)
      );

      const unsubscribe = onSnapshot(
        itemsQuery,
        (snapshot) => {
          const items = snapshot.docs.map(doc => doc.data() as ItemDoc);
          try {
            localStorage.setItem('wms-items-cache', JSON.stringify(items));
            localStorage.setItem('wms-items-cache-timestamp', new Date().toISOString());
            console.log('[bidirectionalSync] Updated items cache from server', items.length);

            const event = new CustomEvent('wms-cache-updated', {
              detail: { type: 'items', count: items.length },
            });
            window.dispatchEvent(event);
          } catch (e) {
            console.error('[bidirectionalSync] Error caching items', e);
          }
        },
        (error) => {
          console.error('[bidirectionalSync] Items snapshot error', error);
        }
      );

      activeListeners.set('items-sync', { unsubscribe, isActive: true });
      return unsubscribe;
    } catch (e) {
      console.error('[bidirectionalSync] Error starting items sync', e);
      return () => undefined;
    }
  };

  listeners.push(syncItemsChanges());

  return () => {
    listeners.forEach(unsub => {
      try {
        unsub();
      } catch (e) {
        console.error('[bidirectionalSync] Error unsubscribing', e);
      }
    });
    activeListeners.clear();
  };
};

export const getActiveSyncListeners = (): number => {
  return activeListeners.size;
};

export const stopBidirectionalSync = (): void => {
  activeListeners.forEach(listener => {
    try {
      listener.unsubscribe();
      listener.isActive = false;
    } catch (e) {
      console.error('[bidirectionalSync] Error stopping sync', e);
    }
  });
  activeListeners.clear();
};

export const listenForCacheUpdates = (
  callback: (event: { type: string; count?: number }) => void
): (() => void) => {
  const handler = (event: Event) => {
    if (event instanceof CustomEvent) {
      callback(event.detail);
    }
  };

  window.addEventListener('wms-cache-updated', handler);
  return () => window.removeEventListener('wms-cache-updated', handler);
};
