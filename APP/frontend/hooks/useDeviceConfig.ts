/**
 * useDeviceConfig — Lee la configuración del dispositivo actual
 */

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
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

    const fetchDevice = async () => {
      try {
        setLoading(true);
        const deviceRef = doc(db, COLLECTIONS.DEVICES, deviceId);
        const deviceSnap = await getDoc(deviceRef);

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
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchDevice();
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
