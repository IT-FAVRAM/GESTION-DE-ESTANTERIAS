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
  setCurrentShelf: (shelf: string) => void;
  loading: boolean;
  error: string | null;
}

export const useKiosk = (kioskId: string | null | undefined): UseKioskReturn => {
  const [kiosk, setKiosk] = useState<KioskDoc | null>(null);
  const [currentShelf, setCurrentShelfState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kioskId) {
      setKiosk(null);
      setCurrentShelfState(null);
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
          const defaultShelf = savedShelf || kioskData.shelves[0] || null;
          setCurrentShelfState(defaultShelf);

          setError(null);
        } else {
          // Fallback robusto para desarrollo y dispositivos no registrados
          const fallbackMap: Record<string, KioskDoc> = {
            'kiosko-mecanizado': {
              id: 'kiosko-mecanizado',
              name: 'Mecanizado-Prensas',
              shelves: ['MEC', 'PRE'],
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
            const defaultShelf = savedShelf || fallbackKiosk.shelves[0] || null;
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
            name: 'Mecanizado-Prensas',
            shelves: ['MEC', 'PRE'],
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
          const defaultShelf = savedShelf || fallbackKiosk.shelves[0] || null;
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
  }, [kioskId]);

  const setCurrentShelf = (shelf: string) => {
    if (kioskId) {
      const allowedShelves = kiosk?.shelves || [];
      const isAllowed = allowedShelves.includes(shelf) || (kioskId === 'kiosko-mecanizado' && ['MEC', 'PRE'].includes(shelf));
      if (isAllowed) {
        setCurrentShelfState(shelf);
        localStorage.setItem(`kiosk-${kioskId}-shelf`, shelf);
      }
    }
  };

  return {
    kiosk,
    shelves: kiosk?.shelves || (kioskId === 'kiosko-mecanizado' ? ['MEC', 'PRE'] : []),
    currentShelf,
    setCurrentShelf,
    loading,
    error,
  };
};


