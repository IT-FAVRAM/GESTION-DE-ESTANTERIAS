const PERMISSION_MATRIX = {
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

const isPermissionRole = (role) => (
    role === 'ADMIN' || role === 'JEFE' || role === 'CARRETILLERO'
);

const can = (role, capability) => {
    if (!isPermissionRole(role)) return false;
    return PERMISSION_MATRIX[role][capability];
};

module.exports = {
    PERMISSION_MATRIX,
    can
};
