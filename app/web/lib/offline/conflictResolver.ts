/**
 * conflictResolver.ts — Resolución automática de conflictos offline
 * Gestor de Estanterías WMS v3.0
 *
 * Detecta y resuelve automáticamente conflictos cuando es posible,
 * comparando estado offline vs estado actual del servidor.
 */

import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, type ItemDoc, type LocationDoc } from '../firestoreSchema';
import type { OfflineQueueEntry } from './offlineQueue';

export type ConflictResolution = 'auto_resolved' | 'needs_manual_review' | 'discarded';

export interface ConflictAnalysis {
  resolution: ConflictResolution;
  reason: string;
  recommendation: string;
}

const getItemsFromServer = async (): Promise<ItemDoc[]> => {
  try {
    const snap = await getDocs(query(collection(db, COLLECTIONS.ITEMS), where('active', '==', true)));
    return snap.docs.map(doc => doc.data() as ItemDoc);
  } catch (error) {
    console.error('[conflictResolver] Error fetching items from server', error);
    return [];
  }
};

const getLocationFromServer = async (locationId: string): Promise<LocationDoc | null> => {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.LOCATIONS, locationId));
    return snap.exists() ? (snap.data() as LocationDoc) : null;
  } catch (error) {
    console.error('[conflictResolver] Error fetching location', locationId, error);
    return null;
  }
};

export const analyzeConflict = async (entry: OfflineQueueEntry): Promise<ConflictAnalysis> => {
  try {
    switch (entry.type) {
      case 'UBICAR': {
        const items = await getItemsFromServer();
        const alreadyExists = items.some(
          i => i.articleCode === entry.payload.articleCode &&
               i.orderFab === entry.payload.orderFab &&
               i.shelfCode === entry.payload.shelfCode
        );

        if (alreadyExists) {
          return {
            resolution: 'auto_resolved',
            reason: 'Artículo ya está ubicado en la posición',
            recommendation: 'Operación completada por otro usuario mientras estabas offline',
          };
        }

        return {
          resolution: 'needs_manual_review',
          reason: 'Artículo no está en la posición esperada',
          recommendation: 'Verifica el estado actual del artículo en la estantería',
        };
      }

      case 'RETIRAR': {
        const items = await getItemsFromServer();
        const stillExists = items.some(
          i => i.articleCode === entry.payload.articleCode &&
               i.orderFab === entry.payload.orderFab &&
               i.shelfCode === entry.payload.shelfCode
        );

        if (!stillExists) {
          return {
            resolution: 'auto_resolved',
            reason: 'Artículo ya fue retirado',
            recommendation: 'Operación completada por otro usuario mientras estabas offline',
          };
        }

        return {
          resolution: 'needs_manual_review',
          reason: 'Artículo sigue en la posición',
          recommendation: 'Intenta retirar nuevamente o revisa si hay cambios en la estantería',
        };
      }

      case 'RETIRAR_DE_UBICACION': {
        const locationId = String(entry.payload.locationId || '');
        const location = await getLocationFromServer(locationId);

        if (!location) {
          return {
            resolution: 'auto_resolved',
            reason: 'Ubicación no existe',
            recommendation: 'Operación completada mientras estabas offline',
          };
        }

        return {
          resolution: 'needs_manual_review',
          reason: 'Ubicación sigue con artículos',
          recommendation: 'Revisa el contenido actual de la ubicación',
        };
      }

      case 'MOVER': {
        const items = await getItemsFromServer();
        const inNewLocation = items.some(
          i => i.articleCode === entry.payload.articleCode &&
               i.orderFab === entry.payload.orderFab &&
               i.shelfCode === entry.payload.targetShelfCode
        );

        if (inNewLocation) {
          return {
            resolution: 'auto_resolved',
            reason: 'Artículo ya está en la posición destino',
            recommendation: 'Operación completada mientras estabas offline',
          };
        }

        return {
          resolution: 'needs_manual_review',
          reason: 'Artículo no está en la posición destino',
          recommendation: 'Verifica dónde está el artículo actualmente',
        };
      }

      case 'AVISAR_CARRETILLERO':
      case 'COMPLETAR_RECOGIDA':
      default:
        return {
          resolution: 'needs_manual_review',
          reason: 'Operación no puede ser verificada automáticamente',
          recommendation: 'Revisa manualmente el estado de la operación',
        };
    }
  } catch (error) {
    console.error('[conflictResolver] Analysis failed for entry', entry.id, error);
    return {
      resolution: 'needs_manual_review',
      reason: 'Error al analizar el conflicto',
      recommendation: 'Intenta nuevamente o contacta a administración',
    };
  }
};

export const shouldAutoResolve = (analysis: ConflictAnalysis): boolean => {
  return analysis.resolution === 'auto_resolved';
};
