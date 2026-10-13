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
    let preReady = false;
    let mecReady = false;

    const mapSnapshot = (snap: import('firebase/firestore').QuerySnapshot): ShelfLocationState[] =>
      snap.docs.map((d) => ({
        ...(d.data() as ShelfLocationState),
        position: d.id,
      }));

    const recombine = (preLocs: ShelfLocationState[], mecLocs: ShelfLocationState[]) => {
      const combined = [...preLocs, ...mecLocs].sort((a, b) => {
        const posA = parseInt(a.position, 10);
        const posB = parseInt(b.position, 10);
        return posA - posB;
      });
      setLocations(combined);
      if (preReady && mecReady) setLoading(false);
    };

    let preLocations: ShelfLocationState[] = [];
    let mecLocations: ShelfLocationState[] = [];

    // PRE and MEC listeners in PARALLEL (not nested)
    const preUnsub = onSnapshot(
      collection(db, 'shelves', 'PRE', 'locations'),
      (snap) => {
        preLocations = mapSnapshot(snap);
        preReady = true;
        recombine(preLocations, mecLocations);
      },
      (error) => {
        console.error('[usePreMecShelfCombined] Error reading PRE:', error);
        setLoading(false);
      }
    );

    const mecUnsub = onSnapshot(
      collection(db, 'shelves', 'MEC', 'locations'),
      (snap) => {
        mecLocations = mapSnapshot(snap);
        mecReady = true;
        recombine(preLocations, mecLocations);
      },
      (error) => {
        console.error('[usePreMecShelfCombined] Error reading MEC:', error);
        setLoading(false);
      }
    );

    return () => {
      preUnsub();
      mecUnsub();
    };
  }, []);

  return { locations, loading };
}
