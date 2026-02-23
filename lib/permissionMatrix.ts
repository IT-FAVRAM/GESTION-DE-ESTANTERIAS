export type PermissionRole = 'ADMIN' | 'JEFE' | 'CARRETILLERO';
export type Capability = 'copyPaste' | 'dragMove' | 'emptyShelf' | 'emptyLocation';

const PERMISSION_MATRIX: Record<PermissionRole, Record<Capability, boolean>> = {
    ADMIN: {
        copyPaste: true,
        dragMove: true,
        emptyShelf: true,
        emptyLocation: true
    },
    JEFE: {
        copyPaste: false,
        dragMove: false,
        emptyShelf: false,
        emptyLocation: true
    },
    CARRETILLERO: {
        copyPaste: false,
        dragMove: false,
        emptyShelf: false,
        emptyLocation: true
    }
};

const isPermissionRole = (role: unknown): role is PermissionRole => (
    role === 'ADMIN' || role === 'JEFE' || role === 'CARRETILLERO'
);

export const can = (role: unknown, capability: Capability): boolean => {
    if (!isPermissionRole(role)) return false;
    return PERMISSION_MATRIX[role][capability];
};

export { PERMISSION_MATRIX };
