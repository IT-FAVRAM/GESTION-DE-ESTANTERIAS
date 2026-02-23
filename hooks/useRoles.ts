

import { useEffect, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { db, auth } from '../lib/firebase';
import firebase from 'firebase/compat/app';
import { getSectionFromLocation, WarehouseSection } from '../lib/warehouseData';
import { can, type PermissionRole } from '../lib/permissionMatrix';

// Nuevos roles definidos
export type UserRole = PermissionRole;

// Mapping para compatibilidad con datos antiguos (Migration Layer)
const ROLE_MAPPING: Record<string, UserRole> = {
    'ADMINISTRACIÓN': 'ADMIN',
    'JEFE SECCIÓN': 'JEFE',
    'CARRETILLERO': 'CARRETILLERO',
    'ADMIN': 'ADMIN',
    'JEFE': 'JEFE'
};

const normalizeRole = (value: unknown): UserRole | null => {
    if (typeof value !== 'string') return null;
    const normalized = ROLE_MAPPING[value.toUpperCase()] || ROLE_MAPPING[value];
    return normalized || null;
};

interface RolePermissions {
    canScan: boolean;
    canAssign: boolean;
    // canRemove es ahora una función lógica dinámica, no un booleano estático puro en la interfaz, 
    // pero mantenemos flags base para capacidades generales.
    canRequestItems: boolean;
    canUseAdvancedFilters: boolean;
    canExport: boolean;
    canAnalyzeAnomalies: boolean;
    canEditStructure: boolean;
    skipLocationValidation: boolean;
    canFinishProduction: boolean;
}

const PERMISSIONS: Record<UserRole, RolePermissions> = {
    'CARRETILLERO': {
        canScan: true,
        canAssign: true,
        canRequestItems: false,
        canUseAdvancedFilters: false,
        canExport: true,
        canAnalyzeAnomalies: false,
        canEditStructure: false,
        skipLocationValidation: false,
        canFinishProduction: true
    },
    'JEFE': {
        canScan: true,
        canAssign: true,
        canRequestItems: true,
        canUseAdvancedFilters: true,
        canExport: true,
        canAnalyzeAnomalies: false,
        canEditStructure: false,
        skipLocationValidation: false,
        canFinishProduction: true
    },
    'ADMIN': {
        canScan: true,
        canAssign: true,
        canRequestItems: true,
        canUseAdvancedFilters: true,
        canExport: true,
        canAnalyzeAnomalies: true,
        canEditStructure: true,
        skipLocationValidation: true,
        canFinishProduction: true
    }
};

const STATIC_ROLES: Record<string, { role: UserRole, section?: WarehouseSection }> = {
    'OeAGs5Ych3NNra0Ku1vU4FZA9XC3': { role: 'CARRETILLERO' },
    'wP4dQWC6NbQHSyrgtmAdmgLY7KB2': { role: 'CARRETILLERO' },
    'LWxLbxM5JtdkA1cqOdPbpLL8cF22': { role: 'JEFE', section: 'MECANIZADO' },
    'BXdfbh27KSNuxrfZ56dVsdbiLVG3': { role: 'JEFE', section: 'SOLDADURA' },
    'elKG8EO8EOMaosxtT3dl0bE9OUh1': { role: 'JEFE', section: 'PLEGADORA' },
    'X8NBj67hyPdArfsMfboF2iEGKzn2': { role: 'JEFE', section: 'REPASADO' },
    'a5OrNJCE9TaDQ2wgYCCaLPivgNo2': { role: 'ADMIN' },
    'XZKMAbBWf2TTO4atKUApqmHw1b83': { role: 'ADMIN' },
    'EexT0ywEsuhFBEzSOMivxN0w0Zh1': { role: 'JEFE', section: 'LASER' },
    'QqnJcD7by4Xzvu5IC1nHm1AlIdE3': { role: 'ADMIN' },
    '3CNa5Qv8UphfsUFPXh68oGqURvv1': { role: 'ADMIN' },
    '05r5OKSXjyMFxgKzkQN7wCzIsJz1': { role: 'CARRETILLERO' },
    'CDFJQnIMhNUFzmfoMBQaz52wuxJ3': { role: 'CARRETILLERO' },
    'EWGmCCwo4ZfHUqnL2KTQ8TeuDI63': { role: 'JEFE', section: 'SOLDADURA' },
};

export const useRoles = (uid?: string) => {
    // State now reflects Claims, not just DB
    const [role, setRole] = useState<UserRole | null>(null);
    const [section, setSection] = useState<WarehouseSection | null>(null);
    const [loading, setLoading] = useState(true);
    const [claimsLoaded, setClaimsLoaded] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const fetchRole = async (currentUser: firebase.User | null) => {
            if (!currentUser) {
                if (isMounted) {
                    setRole(null);
                    setSection(null);
                    setLoading(false);
                    setClaimsLoaded(true);
                }
                return;
            }

            try {
                // 1. Check Claims (Fastest)
                const tokenResult = await currentUser.getIdTokenResult(true);
                const claims = tokenResult.claims;

                if (claims && claims.role) {
                    const claimRole = normalizeRole(claims.role);
                    console.log("Rol obtenido por Claims:", claims.role, claims.section);
                    if (isMounted) {
                        setRole(claimRole);
                        setSection(claims.section as WarehouseSection || null);
                        setLoading(false);
                        setClaimsLoaded(true);
                    }
                    if (claimRole) return;
                }

                // 2. Fallback: Check 'users' collection in Firestore (Compat Syntax)
                const userDocSnap = await db.collection('users').doc(currentUser.uid).get();

                if (userDocSnap.exists) {
                    const userData = userDocSnap.data();
                    const dbRole = normalizeRole(userData?.role || userData?.user);
                    console.log("Rol obtenido por Firestore:", userData?.role, userData?.section);
                    if (isMounted) {
                        setRole(dbRole);
                        setSection(userData?.section || null);
                    }
                } else {
                    console.warn("Usuario sin documento de rol en Firestore:", currentUser.uid);
                    if (isMounted) {
                        setRole(null);
                        setSection(null);
                    }
                }

            } catch (error) {
                console.error("Error al obtener rol:", error);
                if (isMounted) {
                    setRole(null);
                    setSection(null);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                    setClaimsLoaded(true);
                }
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (isMounted) setLoading(true);
            fetchRole(user);
        });

        if (auth.currentUser) {
            fetchRole(auth.currentUser);
        }

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);


    // Permissions logic remains the same...
    // Safe permissions lookup
    const permissions = (role && PERMISSIONS[role]) ? PERMISSIONS[role] : PERMISSIONS['CARRETILLERO'];

    const safePermissions = (role && PERMISSIONS[role]) ? permissions : {
        canScan: false, canAssign: false, canRequestItems: false, canUseAdvancedFilters: false,
        canExport: false, canAnalyzeAnomalies: false, canEditStructure: false, skipLocationValidation: false,
        canFinishProduction: false
    };

    // --- Dynamic Permissions ---
    const canRemove = (locationId?: string) => {
        if (!role) return false;
        if (role === 'ADMIN' || role === 'CARRETILLERO') return true;
        if (role === 'JEFE') {
            if (!locationId) return true;
            const locSection = getSectionFromLocation(locationId);
            return section === locSection;
        }
        return false;
    };

    // --- Special Feature: Chapero Counting ---
    const canAccessChapero = () => {
        if (!role) return false;
        // ENABLED FOR ALL ROLES AS REQUESTED ("Vuelve a sacarla a la luz")
        return true;
    };

    return {
        role,
        section,
        loading,
        claimsLoaded, // New indicator
        canScan: () => safePermissions.canScan,
        canAssign: () => safePermissions.canAssign,
        canRemove,
        canRequestItems: () => safePermissions.canRequestItems,
        canUseAdvancedFilters: () => safePermissions.canUseAdvancedFilters,
        canExport: () => safePermissions.canExport,
        canAnalyzeAnomalies: () => safePermissions.canAnalyzeAnomalies,
        canEditStructure: () => safePermissions.canEditStructure,
        shouldSkipValidation: () => safePermissions.skipLocationValidation,
        canFinishProduction: () => safePermissions.canFinishProduction,
        canCopyPaste: () => can(role, 'copyPaste'),
        canDragMove: () => can(role, 'dragMove'),
        canEmptyShelf: () => can(role, 'emptyShelf'),
        canEmptyLocation: () => can(role, 'emptyLocation'),
        canAccessChapero
    };
};
