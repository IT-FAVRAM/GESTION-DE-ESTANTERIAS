/**
 * useUtilesSoldadura - Hook para manejar ubicaciones de texto libre en UTS.
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/firestoreSchema';

export interface TextLocation {
  position: string;
  text: string;
  lastModified?: Date;
}

export interface UseUtilesSoldaduraReturn {
  locations: TextLocation[];
  loading: boolean;
  error: string | null;
  addText: (position: string, text: string) => Promise<boolean>;
  removeText: (position: string) => Promise<boolean>;
  updateText: (position: string, text: string) => Promise<boolean>;
}

const SHELF_CODE = 'UTS';

export const useUtilesSoldadura = (): UseUtilesSoldaduraReturn => {
  const [locations, setLocations] = useState<TextLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Suscripción a Firestore
  useEffect(() => {
    setLoading(true);
    setError(null);

    const locationsRef = collection(db, COLLECTIONS.SHELVES, SHELF_CODE, COLLECTIONS.LOCATIONS);

    const unsubscribe = onSnapshot(
      locationsRef,
      (snapshot) => {
        const locs: TextLocation[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          locs.push({
            position: data.position || docSnap.id,
            text: data.text || '',
            lastModified: data.lastModified?.toDate(),
          });
        });
        // Ordenar por posición
        locs.sort((a, b) => a.position.localeCompare(b.position));
        setLocations(locs);
        setLoading(false);
      },
      (err) => {
        console.error('[useUtilesSoldadura] Error:', err);
        setError('Error al cargar ubicaciones');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Añadir texto a una posición
  const addText = useCallback(async (position: string, text: string): Promise<boolean> => {
    try {
      const locationRef = doc(db, COLLECTIONS.SHELVES, SHELF_CODE, COLLECTIONS.LOCATIONS, position);
      await setDoc(locationRef, {
        position,
        text: text.trim(),
        lastModified: new Date(),
      }, { merge: true });
      return true;
    } catch (err) {
      console.error('[useUtilesSoldadura] addText error:', err);
      setError('Error al añadir texto');
      return false;
    }
  }, []);

  // Eliminar texto de una posición
  const removeText = useCallback(async (position: string): Promise<boolean> => {
    try {
      const locationRef = doc(db, COLLECTIONS.SHELVES, SHELF_CODE, COLLECTIONS.LOCATIONS, position);
      await deleteDoc(locationRef);
      return true;
    } catch (err) {
      console.error('[useUtilesSoldadura] removeText error:', err);
      setError('Error al eliminar texto');
      return false;
    }
  }, []);

  // Actualizar texto de una posición
  const updateText = useCallback(async (position: string, text: string): Promise<boolean> => {
    try {
      const locationRef = doc(db, COLLECTIONS.SHELVES, SHELF_CODE, COLLECTIONS.LOCATIONS, position);
      await setDoc(locationRef, {
        text: text.trim(),
        lastModified: new Date(),
      }, { merge: true });
      return true;
    } catch (err) {
      console.error('[useUtilesSoldadura] updateText error:', err);
      setError('Error al actualizar texto');
      return false;
    }
  }, []);

  return {
    locations,
    loading,
    error,
    addText,
    removeText,
    updateText,
  };
};
