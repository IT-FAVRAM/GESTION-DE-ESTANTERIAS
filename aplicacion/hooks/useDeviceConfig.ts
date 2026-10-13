/**
 * useDeviceConfig — Lee la configuración del dispositivo actual
 */

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { COLLECTIONS, type DeviceDoc } from '../lib/firestoreSchema';

export interface UseDeviceConfigReturn {
  device: DeviceDoc | null;
  excludedCarts: string[];
  visualOnly: boolean;
  allowedShelves: string[];
  loading: boolean;
  error: string | null;
}

export const useDeviceConfig = (deviceId: string | null | undefined): UseDeviceConfigReturn => {
  const [device, setDevice] = useState<DeviceDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setDevice(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const readOnce = async () => {
      const deviceRef = doc(db, COLLECTIONS.DEVICES, deviceId);
      return getDoc(deviceRef);
    };

    const fetchDevice = async () => {
      try {
        setLoading(true);
        let deviceSnap;
        try {
          deviceSnap = await readOnce();
        } catch (err: any) {
          // Los kioskos leen su config con el claim `validatedDevice`. Si la lectura
          // llega antes de que el token tenga el claim, Firestore responde
          // permission-denied. Forzamos un refresh del token y reintentamos una vez.
          if (err?.code === 'permission-denied' && auth.currentUser) {
            await auth.currentUser.getIdToken(true).catch(() => {});
            deviceSnap = await readOnce();
          } else {
            throw err;
          }
        }
        if (cancelled) return;

        if (deviceSnap.exists()) {
          const deviceData = deviceSnap.data() as DeviceDoc;
          setDevice(deviceData);
          setError(null);
        } else {
          setDevice(null);
          setError('Dispositivo no encontrado');
        }
      } catch (err) {
        console.warn('[useDeviceConfig] Error fetching device config:', deviceId, err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDevice();
    return () => { cancelled = true; };
  }, [deviceId]);

  return {
    device,
    excludedCarts: device?.excludedCarts || [],
    visualOnly: device?.visualOnly || false,
    allowedShelves: device?.allowedShelves || [],
    loading,
    error,
  };
};
