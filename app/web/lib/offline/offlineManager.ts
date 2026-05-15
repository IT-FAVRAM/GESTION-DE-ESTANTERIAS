/**
 * offlineManager.ts - Utils funcionales para el estado de red de Firebase.
 * WMS v3.0 Gestor Estanterias.
 */
import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from '../firebase';

export const forceOfflineMode = async () => {
  try {
    await disableNetwork(db);
    console.log('[OfflineManager] Network disabled manually');
  } catch (err) {
    console.error('[OfflineManager] Error deshabilitando red:', err);
  }
};

export const forceOnlineMode = async () => {
  try {
    await enableNetwork(db);
    console.log('[OfflineManager] Network enabled manually');
  } catch (err) {
    console.error('[OfflineManager] Error habilitando red:', err);
  }
};

export const offlineManager = {
  forceOfflineMode,
  forceOnlineMode,
};
