/**
 * @deprecated Legacy auth/roles hook kept only for `app/web/legacy/**`.
 * Active V3 flows must use `useAuth` + domain auth capabilities.
 */

import { useEffect, useState } from 'react';
import { db, auth } from '../legacy/firebaseCompat';
import firebase from 'firebase/compat/app';
import { getSectionFromLocation, WarehouseSection } from '../lib/warehouseData';
import { can, type PermissionRole } from '../lib/permissionMatrix';

export type UserRole = PermissionRole;

const ROLE_MAPPING: Record<string, UserRole> = {
    'ADMINISTRACIÓN': 'ADMIN',
    'JEFE SECCIÓN': 'JEFE',
    'CARRETILLERO': 'CARRETILLERO',
    'ADMIN': 'ADMIN',
    'JEFE': 'JEFE',
    'CALIDAD': 'CALIDAD'
};

const normalizeRole = (value: unknown): UserRole | null => {
    if (typeof value !== 'string') return null;
    const normalized = ROLE_MAPPING[value.toUpperCase()] || ROLE_MAPPING[value];
    return normalized || null;
};

interface RolePermissions {
    canScan: boolean;
    canAssign: boolean;
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
    },
    'CALIDAD': {
        canScan: true,
        canAssign: false,
        canRequestItems: true,
        canUseAdvancedFilters: true,
        canExport: true,
        canAnalyzeAnomalies: true,
        canEditStructure: false,
        skipLocationValidation: true,
        canFinishProduction: false
    }
};

export const useRoles = (uid?: string) => {
    const [role, setRole] = useState<UserRole | null>(localStorage.getItem('guest_role') as UserRole || null);
    const [section, setSection] = useState<WarehouseSection | null>(localStorage.getItem('guest_section') as WarehouseSection || null);
    const [loading, setLoading] = useState(!localStorage.getItem('guest_role'));

    useEffect(() => {
        let isMounted = true;

        const fetchRole = async (currentUser: firebase.User | null) => {
            if (localStorage.getItem('guest_role')) {
                if (isMounted) {
                    setRole(localStorage.getItem('guest_role') as UserRole);
                    setSection(localStorage.getItem('guest_section') as WarehouseSection || null);
                    setLoading(false);
                }
                return;
            }

            if (!currentUser) {
                if (isMounted) {
                    setRole(null);
                    setSection(null);
                    setLoading(false);
                }
                return;
            }

            try {
                const tokenResult = await currentUser.getIdTokenResult(true);
                const claims = tokenResult.claims;

                if (claims && claims.role) {
                    const claimRole = normalizeRole(claims.role);
                    if (isMounted) {
                        setRole(claimRole);
                        setSection(claims.section as WarehouseSection || null);
                    }
                    if (claimRole) return;
                }

                const userDocSnap = await db.collection('users').doc(currentUser.uid).get();
                if (userDocSnap.exists) {
                    const userData = userDocSnap.data();
                    const dbRole = normalizeRole(userData?.role || userData?.user);
                    if (isMounted) {
                        setRole(dbRole);
                        setSection(userData?.section || null);
                    }
                }
            } catch (error) {
                console.error("Error fetching role:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (isMounted) setLoading(true);
            fetchRole(user);
        });

        if (auth.currentUser) fetchRole(auth.currentUser);

        return () => { isMounted = false; unsubscribe(); };
    }, []);

    const permissions = (role && PERMISSIONS[role]) ? PERMISSIONS[role] : PERMISSIONS['CARRETILLERO'];
    const safePermissions = (role && PERMISSIONS[role]) ? permissions : {
        canScan: false, canAssign: false, canRequestItems: false, canUseAdvancedFilters: false,
        canExport: false, canAnalyzeAnomalies: false, canEditStructure: false, skipLocationValidation: false,
        canFinishProduction: false
    };

    return {
        role,
        section,
        loading,
        canScan: () => safePermissions.canScan,
        canAssign: () => safePermissions.canAssign,
        canRemove: (locationId?: string) => {
            if (!role) return false;
            if (role === 'ADMIN' || role === 'CARRETILLERO') return true;
            if (role === 'JEFE') {
                if (!locationId) return true;
                const locSection = getSectionFromLocation(locationId);
                return section === locSection;
            }
            return false;
        },
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
        canAccessChapero: () => true
    };
};


