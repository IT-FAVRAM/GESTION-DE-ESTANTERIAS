/**
 * useInitializeCriticalData.ts — Precaché de datos críticos offline
 * Gestor de Estanterías WMS v3.0
 *
 * Carga y cachea proactivamente datos críticos para funcionamiento offline:
 * estanterías, configuración, ubicaciones.
 */

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS, CONFIG_DOC_ID } from '../lib/firestoreSchema';
import { startBidirectionalSync, stopBidirectionalSync } from '../lib/offline/bidirectionalSync';

export interface InitializationStatus {
  isInitializing: boolean;
  itemsLoaded: boolean;
  shelvesLoaded: boolean;
  configLoaded: boolean;
  locationsLoaded: boolean;
  error: string | null;
}

/**
 * @param enabled Solo arranca el precaché + la sincronización cuando la sesión
 *   está resuelta y autenticada. CRUCIAL: si esto corre durante la fase anónima
 *   (antes del login con email), `canReadWarehouseState()` deniega los reads y el
 *   listener `onSnapshot` de items MUERE de forma permanente (Firestore no
 *   reintenta tras un permission-denied), dejando la app sin datos hasta recargar.
 */
export const useInitializeCriticalData = (enabled: boolean = true): InitializationStatus => {
  const [status, setStatus] = useState<InitializationStatus>({
    isInitializing: true,
    itemsLoaded: false,
    shelvesLoaded: false,
    configLoaded: false,
    locationsLoaded: false,
    error: null,
  });

  useEffect(() => {
    // No precachear ni abrir listeners hasta que la sesión esté autenticada.
    if (!enabled) return;

    let isMounted = true;

    const initializeCaches = async () => {
      try {
        console.log('[useInitializeCriticalData] Starting initialization...');

        // Precachear items activos
        try {
          const itemsSnap = await getDocs(collection(db, COLLECTIONS.ITEMS));
          const items = itemsSnap.docs.map((doc) => doc.data());
          localStorage.setItem('wms-items-cache', JSON.stringify(items));
          localStorage.setItem('wms-items-cache-timestamp', new Date().toISOString());

          if (isMounted) {
            setStatus((prev) => ({ ...prev, itemsLoaded: true }));
          }
          console.log(`[useInitializeCriticalData] Cached ${items.length} items`);
        } catch (e) {
          console.error('[useInitializeCriticalData] Error caching items', e);
        }

        // Precachear estanterías
        try {
          const shelvesSnap = await getDocs(collection(db, COLLECTIONS.SHELVES));
          const shelves = shelvesSnap.docs.map((doc) => doc.data());
          localStorage.setItem('wms-shelves-cache', JSON.stringify(shelves));
          localStorage.setItem('wms-shelves-cache-timestamp', new Date().toISOString());

          if (isMounted) {
            setStatus((prev) => ({ ...prev, shelvesLoaded: true }));
          }
          console.log(`[useInitializeCriticalData] Cached ${shelves.length} shelves`);
        } catch (e) {
          console.error('[useInitializeCriticalData] Error caching shelves', e);
        }

        // Precachear configuración
        try {
          const configSnap = await getDoc(doc(db, COLLECTIONS.CONFIG, CONFIG_DOC_ID));
          if (configSnap.exists()) {
            localStorage.setItem('wms-config-cache', JSON.stringify(configSnap.data()));
            localStorage.setItem('wms-config-cache-timestamp', new Date().toISOString());

            if (isMounted) {
              setStatus((prev) => ({ ...prev, configLoaded: true }));
            }
            console.log('[useInitializeCriticalData] Cached app config');
          }
        } catch (e) {
          console.error('[useInitializeCriticalData] Error caching config', e);
        }

        // Precachear ubicaciones (desde subcolecc iones de estanterías)
        try {
          const allLocations: any[] = [];
          const shelvesSnap = await getDocs(collection(db, COLLECTIONS.SHELVES));

          for (const shelfDoc of shelvesSnap.docs) {
            const locationsSnap = await getDocs(
              collection(db, COLLECTIONS.SHELVES, shelfDoc.id, 'locations')
            );
            locationsSnap.docs.forEach((doc) => {
              allLocations.push({ ...doc.data(), shelfCode: shelfDoc.id });
            });
          }

          localStorage.setItem('wms-locations-cache', JSON.stringify(allLocations));
          localStorage.setItem('wms-locations-cache-timestamp', new Date().toISOString());

          if (isMounted) {
            setStatus((prev) => ({ ...prev, locationsLoaded: true }));
          }
          console.log(`[useInitializeCriticalData] Cached ${allLocations.length} locations`);
        } catch (e) {
          console.error('[useInitializeCriticalData] Error caching locations', e);
        }

        // Iniciar sincronización bidireccional
        const unsubscribeSync = startBidirectionalSync();

        if (isMounted) {
          setStatus((prev) => ({ ...prev, isInitializing: false, error: null }));
        }

        return () => {
          unsubscribeSync();
          stopBidirectionalSync();
        };
      } catch (error) {
        console.error('[useInitializeCriticalData] Initialization error', error);
        if (isMounted) {
          setStatus((prev) => ({
            ...prev,
            isInitializing: false,
            error: error instanceof Error ? error.message : 'Error initializing caches',
          }));
        }
      }
    };

    const cleanup = initializeCaches();

    return () => {
      isMounted = false;
      cleanup.then((fn) => fn?.()).catch((e) => {
        console.warn('[useInitializeCriticalData] Cleanup error:', e);
      });
    };
  }, [enabled]);

  return status;
};


