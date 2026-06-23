/**
 * useKiosk — Lee kiosko asignado a la tablet y sus estanterías
 */

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS, type KioskDoc } from '../lib/firestoreSchema';

export interface UseKioskReturn {
  kiosk: KioskDoc | null;
  shelves: string[];
  currentShelf: string | null;
  setCurrentShelf: (shelf: string, force?: boolean) => void;
  loading: boolean;
  error: string | null;
}

export const useKiosk = (kioskId: string | null | undefined, allowedShelves?: string[]): UseKioskReturn => {
  const [kiosk, setKiosk] = useState<KioskDoc | null>(null);
  const [currentShelf, setCurrentShelfState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kioskId && (!allowedShelves || allowedShelves.length === 0)) {
      setKiosk(null);
      setCurrentShelfState(null);
      setLoading(false);
      return;
    }

    // Si tenemos allowedShelves pero no kioskId, usar allowedShelves como fallback
    if (!kioskId && allowedShelves && allowedShelves.length > 0) {
      const fallbackKiosk: KioskDoc = {
        id: 'device-fallback',
        name: 'Dispositivo',
        shelves: allowedShelves,
        location: 'Zona',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setKiosk(fallbackKiosk);
      const firstShelf = allowedShelves[0] ?? null;
      setCurrentShelfState(firstShelf);
      setError(null);
      setLoading(false);
      return;
    }

    const fetchKiosk = async () => {
      try {
        setLoading(true);
        const kioskRef = doc(db, COLLECTIONS.KIOSKS, kioskId);
        const kioskSnap = await getDoc(kioskRef);

        if (kioskSnap.exists()) {
          const kioskData = kioskSnap.data() as KioskDoc;
          setKiosk(kioskData);

          // Cargar estantería actual desde localStorage o usar primera
          const savedShelf = localStorage.getItem(`kiosk-${kioskId}-shelf`);
          const defaultShelf = (savedShelf && kioskData.shelves.includes(savedShelf)) ? savedShelf : kioskData.shelves[0] ?? null;
          setCurrentShelfState(defaultShelf);

          setError(null);
        } else {
          // Fallback robusto para desarrollo y dispositivos no registrados
          const fallbackMap: Record<string, KioskDoc> = {
            'kiosko-mecanizado': {
              id: 'kiosko-mecanizado',
              name: 'Prensas - Mecanizado',
              shelves: ['PRE'],
              location: 'Zona Mecanizado y Prensas',
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          };

          if (kioskId in fallbackMap) {
            const fallbackKiosk = fallbackMap[kioskId];
            setKiosk(fallbackKiosk);
            const savedShelf = localStorage.getItem(`kiosk-${kioskId}-shelf`);
            const defaultShelf = (savedShelf && fallbackKiosk.shelves.includes(savedShelf)) ? savedShelf : fallbackKiosk.shelves[0] ?? null;
            setCurrentShelfState(defaultShelf);
            setError(null);
          } else {
            setKiosk(null);
            setCurrentShelfState(null);
            setError('Kiosko no encontrado');
          }
        }
      } catch (err) {
        console.warn('[useKiosk] Fallback activated for kiosk:', kioskId, err);
        // Fallback robusto si la consulta de red o reglas de seguridad fallan
        const fallbackMap: Record<string, KioskDoc> = {
          'kiosko-mecanizado': {
            id: 'kiosko-mecanizado',
            name: 'Prensas-Mecanizado',
            shelves: ['PRE'],
            location: 'Zona Mecanizado y Prensas',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };

        if (kioskId in fallbackMap) {
          const fallbackKiosk = fallbackMap[kioskId];
          setKiosk(fallbackKiosk);
          const savedShelf = localStorage.getItem(`kiosk-${kioskId}-shelf`);
          const defaultShelf = (savedShelf && fallbackKiosk.shelves.includes(savedShelf)) ? savedShelf : fallbackKiosk.shelves[0] ?? null;
          setCurrentShelfState(defaultShelf);
          setError(null);
        } else {
          setError(err instanceof Error ? err.message : 'Error desconocido');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchKiosk();
  }, [kioskId, allowedShelves]);

  const setCurrentShelf = (shelf: string, force = false) => {
    const allowedShelvesList = kiosk?.shelves || [];
    const isAllowed = allowedShelvesList.includes(shelf);
    if (isAllowed || force) {
      setCurrentShelfState(shelf);
      const storageKey = kioskId ? `kiosk-${kioskId}-shelf` : 'device-shelf';
      localStorage.setItem(storageKey, shelf);
    }
  };

  return {
    kiosk,
    shelves: kiosk?.shelves || [],
    currentShelf,
    setCurrentShelf,
    loading,
    error,
  };
};


