

import { useCallback, useEffect, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import {
    DEFAULT_WAREHOUSES,
    DEFAULT_WAREHOUSE_NAMES,
    DEFAULT_SHELVES,
    DEFAULT_RACKS,
    DEFAULT_POSITIONS,
    Assignments
} from '../lib/warehouseData';
import { db, auth } from '../lib/firebase';

export interface WarehouseConfig {
    warehouses: { code: string; name: string }[];
    shelves: number[];
    racks: number[];
    positions: string[];
}

const INITIAL_CONFIG: WarehouseConfig = {
    warehouses: DEFAULT_WAREHOUSES.map(code => ({ code, name: DEFAULT_WAREHOUSE_NAMES[code] })),
    shelves: DEFAULT_SHELVES,
    racks: DEFAULT_RACKS,
    positions: [...DEFAULT_POSITIONS]
};

export const useWarehouseConfig = (assignments: Assignments) => {
    const [config, setConfig] = useLocalStorage<WarehouseConfig>('warehouse_config', INITIAL_CONFIG);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setIsAuthenticated(!!user);
            if (!user) setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Suscripción a Firestore en tiempo real (Compat)
    useEffect(() => {
        if (!isAuthenticated) return;

        setLoading(true);
        const ref = db.collection("meta").doc("warehouseConfig");

        const unsubscribe = ref.onSnapshot(
            (snap) => {
                const data = snap.data() as WarehouseConfig | undefined;
                if (data) {
                    setConfig(data);
                }
                setLoading(false);
                setError(null);
            },
            (err) => {
                if (err.code !== 'permission-denied') {
                    console.error("Error leyendo warehouseConfig de Firestore:", err);
                    setError("Error al cargar la configuración.");
                }
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [setConfig, isAuthenticated]);

    // Función unificada para actualizar local + Firestore (Compat)
    const updateConfigAndSync = useCallback(async (nextOrUpdater: WarehouseConfig | ((prev: WarehouseConfig) => WarehouseConfig)) => {
        let next: WarehouseConfig;
        if (typeof nextOrUpdater === 'function') {
            next = (nextOrUpdater as (prev: WarehouseConfig) => WarehouseConfig)(config);
        } else {
            next = nextOrUpdater;
        }

        setConfig(next);

        if (auth.currentUser) {
            const ref = db.collection("meta").doc("warehouseConfig");
            try {
                await ref.set(next, { merge: true });
            } catch (err) {
                console.error("Error guardando warehouseConfig en Firestore:", err);
                setError("Error al guardar configuración.");
            }
        }
    }, [config, setConfig]);

    // --- AUTO MIGRATION LOGIC ---
    useEffect(() => {
        let hasChanges = false;
        const newConfig = { ...config };

        // Add missing default warehouses
        DEFAULT_WAREHOUSES.forEach(code => {
            if (!newConfig.warehouses.some(w => w.code === code)) {
                newConfig.warehouses.push({ code, name: DEFAULT_WAREHOUSE_NAMES[code] });
                hasChanges = true;
            }
        });

        // Remove deprecated carts (CSO, CXP, CRP) and Prensas (PRE)
        const removedCodes = ['CSO', 'CXP', 'CRP', 'PRE'];
        removedCodes.forEach(code => {
            if (newConfig.warehouses.some(w => w.code === code)) {
                newConfig.warehouses = newConfig.warehouses.filter(w => w.code !== code);
                hasChanges = true;
            }
        });

        const updates = [
            { code: 'REP', name: 'Repasado' },
            { code: 'RPL', name: 'Robot de Plegado' }
        ];

        updates.forEach(update => {
            const idx = newConfig.warehouses.findIndex(w => w.code === update.code);
            if (idx !== -1 && newConfig.warehouses[idx].name !== update.name) {
                newConfig.warehouses[idx].name = update.name;
                hasChanges = true;
            }
        });

        // 3. EMOJI CLEANUP MIGRATION
        // Enforce default names for standard warehouses to strip user's stored emojis
        DEFAULT_WAREHOUSES.forEach(code => {
            const idx = newConfig.warehouses.findIndex(w => w.code === code);
            if (idx !== -1) {
                const currentName = newConfig.warehouses[idx].name;
                const cleanName = DEFAULT_WAREHOUSE_NAMES[code];
                // If name differs from clean default (e.g. has emoji "🏢 PLEGADO" vs "Plegado"), reset it
                if (currentName !== cleanName && (currentName.includes('🏢') || currentName.includes('⚡') || currentName.includes('🤖'))) {
                    newConfig.warehouses[idx].name = cleanName;
                    hasChanges = true;
                }
            }
        });

        if (hasChanges) {
            updateConfigAndSync(newConfig);
        }
    }, [config, updateConfigAndSync]);


    // --- WAREHOUSES ---
    const addWarehouse = (code: string, name: string) => {
        const upperCode = code.toUpperCase().trim();
        if (!upperCode) throw new Error("El código es obligatorio");
        if (upperCode.length > 5) throw new Error("El código no puede tener más de 5 caracteres");
        if (config.warehouses.some(w => w.code === upperCode)) throw new Error("Este código de almacén ya existe");

        updateConfigAndSync(prev => ({
            ...prev,
            warehouses: [...prev.warehouses, { code: upperCode, name: name.trim() || upperCode }]
        }));
    };

    const removeWarehouse = (code: string) => {
        const hasItems = Object.keys(assignments).some(loc => loc.startsWith(`${code}-`));
        if (hasItems) throw new Error(`No se puede eliminar ${code}: contiene artículos asignados. Vacíelo primero.`);

        updateConfigAndSync(prev => ({
            ...prev,
            warehouses: prev.warehouses.filter(w => w.code !== code)
        }));
    };

    // --- STRUCTURE (Shelves, Racks, Positions) ---

    const addShelf = (num: number) => {
        if (config.shelves.includes(num)) throw new Error(`La estantería ${num} ya existe`);
        updateConfigAndSync(prev => ({ ...prev, shelves: [...prev.shelves, num].sort((a, b) => a - b) }));
    };

    const removeShelf = (num: number) => {
        const hasItems = Object.keys(assignments).some(loc => loc.includes(`-E${num}-`));
        if (hasItems) throw new Error(`No se puede eliminar Estantería ${num}: hay artículos asignados en estanterías con este número.`);

        updateConfigAndSync(prev => ({ ...prev, shelves: prev.shelves.filter(s => s !== num) }));
    };

    const addRack = (num: number) => {
        if (config.racks.includes(num)) throw new Error(`El rack/balda ${num} ya existe`);
        updateConfigAndSync(prev => ({ ...prev, racks: [...prev.racks, num].sort((a, b) => a - b) }));
    };

    const removeRack = (num: number) => {
        const hasItems = Object.keys(assignments).some(loc => loc.includes(`-B${num}-`));
        if (hasItems) throw new Error(`No se puede eliminar Rack ${num}: hay artículos asignados en racks con este número.`);
        updateConfigAndSync(prev => ({ ...prev, racks: prev.racks.filter(r => r !== num) }));
    };

    const addPosition = (pos: string) => {
        const upperPos = pos.toUpperCase().trim();
        if (!upperPos) return;
        if (config.positions.includes(upperPos)) throw new Error(`La posición ${upperPos} ya existe`);
        updateConfigAndSync(prev => ({ ...prev, positions: [...prev.positions, upperPos] }));
    };

    const removePosition = (pos: string) => {
        const hasItems = Object.keys(assignments).some(loc => loc.endsWith(`-${pos}`));
        if (hasItems) throw new Error(`No se puede eliminar Posición ${pos}: hay artículos asignados en esta posición.`);
        updateConfigAndSync(prev => ({ ...prev, positions: prev.positions.filter(p => p !== pos) }));
    };

    const resetToDefaults = () => {
        updateConfigAndSync(INITIAL_CONFIG);
    };

    return {
        config,
        setConfig: updateConfigAndSync,
        addWarehouse,
        removeWarehouse,
        addShelf,
        removeShelf,
        addRack,
        removeRack,
        addPosition,
        removePosition,
        resetToDefaults,
        loading,
        error
    };
};