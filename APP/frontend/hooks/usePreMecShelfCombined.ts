/**
 * usePreMecShelfCombined — Combina datos de PRENSAS (PRE) y MECANIZADO (MEC)
 *
 * Mientras los datos estén en dos colecciones separadas, este hook lee de ambas
 * y combina los resultados para simular una estantería unificada.
 *
 * POST-MIGRACIÓN: Cambiar de vuelta a useShelf cuando PRE y MEC estén consolidados en PME
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ShelfLocationState } from './useShelf';

export function usePreMecShelfCombined() {
  const [locations, setLocations] = useState<ShelfLocationState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe: (() => void)[] = [];

    // Leer desde PRE (PRENSAS 1-9)
    const preUnsub = onSnapshot(
      collection(db, 'shelves', 'PRE', 'locations'),
      (snap) => {
        const preLocations: ShelfLocationState[] = snap.docs.map((doc) => ({
          ...(doc.data() as any),
          position: doc.id,
        }));

        // Leer desde MEC (MECANIZADO 14-46)
        const mecUnsub = onSnapshot(
          collection(db, 'shelves', 'MEC', 'locations'),
          (mecSnap) => {
            const mecLocations: ShelfLocationState[] = mecSnap.docs.map((doc) => ({
              ...(doc.data() as any),
              position: doc.id,
            }));

            // Combinar y ordenar por posición numérica
            const combined = [...preLocations, ...mecLocations].sort((a, b) => {
              const posA = parseInt(a.position, 10);
              const posB = parseInt(b.position, 10);
              return posA - posB;
            });

            setLocations(combined);
            setLoading(false);
          },
          (error) => {
            console.error('[usePreMecShelfCombined] Error reading MEC:', error);
            setLoading(false);
          }
        );

        unsubscribe.push(mecUnsub);
      },
      (error) => {
        console.error('[usePreMecShelfCombined] Error reading PRE:', error);
        setLoading(false);
      }
    );

    unsubscribe.push(preUnsub);

    return () => {
      unsubscribe.forEach((unsub) => unsub());
    };
  }, []);

  return { locations, loading };
}
