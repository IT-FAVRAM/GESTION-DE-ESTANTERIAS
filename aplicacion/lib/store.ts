
import { create } from 'zustand';
import { LocationId, WarehouseCode, PackageType } from './warehouseData';

export type WorkflowMode = 'assign' | 'remove' | 'request' | 'finish';

const safeParseCollapsedShelves = (): Record<string, Record<string, boolean>> => {
    try {
        const raw = localStorage.getItem('collapsed_shelves');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
};

export interface Notification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
}

interface AppState {
    // UI State
    // UI State
    activeWarehouse: string;
    setActiveWarehouse: (code: string) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    showEmptyOnly: boolean;
    setShowEmptyOnly: (show: boolean) => void;

    // Notifications
    notifications: Notification[];
    notify: (type: Notification['type'], title: string, message: string) => void;
    closeNotification: (id: string) => void;

    // Workflow State
    workflowMode: WorkflowMode;
    setWorkflowMode: (mode: WorkflowMode) => void;
    pendingAssignment: { article: string, order: string, location?: LocationId, mode?: 'move' | 'add' } | null;
    setPendingAssignment: (assignment: AppState['pendingAssignment']) => void;

    // Modal States
    modals: {
        scanner: boolean;
        photoAnalyzer: boolean;
        locationCapture: boolean;
        manualEntry: boolean;
        validationScanner: boolean;
        batchScanner: boolean;
        batchAssignment: boolean;
        requestReview: boolean;
        multiLocationSelector: boolean;
        assignment: boolean;
        delete: boolean;
        leadTime: boolean;
        move: boolean;
        relocate: boolean;
        adminPanel: boolean;
        emptyLocations: boolean;
        userProfile: boolean;
        packageType: boolean;
        occupiedAlert: boolean;
        duplicateAlert: boolean;
    };
    setModal: (key: keyof AppState['modals'], isOpen: boolean) => void;
    closeAllModals: () => void;

    // Specific Data for Workflows
    batchItems: { article: string; order: string }[];
    setBatchItems: (items: AppState['batchItems']) => void;

    // Collapse State
    collapsedShelves: Record<string, Record<string, boolean>>;
    toggleShelf: (warehouse: string, shelfId: string) => void;
    toggleAllShelves: (warehouse: string, collapse: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
    activeWarehouse: localStorage.getItem('active_warehouse') || 'PRE',
    setActiveWarehouse: (code) => {
        localStorage.setItem('active_warehouse', code);
        set({ activeWarehouse: code });
    },

    searchQuery: '',
    setSearchQuery: (searchQuery) => set({ searchQuery }),

    showEmptyOnly: false,
    setShowEmptyOnly: (showEmptyOnly) => set({ showEmptyOnly: showEmptyOnly }),

    notifications: [],
    notify: (type, title, message) => {
        const id = crypto.randomUUID();
        set((state) => ({
            notifications: [...state.notifications, { id, type, title, message }]
        }));
    },
    closeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
    })),

    workflowMode: 'assign',
    setWorkflowMode: (workflowMode) => set({ workflowMode }),

    pendingAssignment: null,
    setPendingAssignment: (pendingAssignment) => set({ pendingAssignment }),

    modals: {
        scanner: false,
        photoAnalyzer: false,
        locationCapture: false,
        manualEntry: false,
        validationScanner: false,
        batchScanner: false,
        batchAssignment: false,
        requestReview: false,
        multiLocationSelector: false,
        assignment: false,
        delete: false,
        leadTime: false,
        move: false,
        relocate: false,
        adminPanel: false,
        emptyLocations: false,
        userProfile: false,
        packageType: false,
        occupiedAlert: false,
        duplicateAlert: false,
    },
    setModal: (key, isOpen) => set((state) => ({
        modals: { ...state.modals, [key]: isOpen }
    })),
    closeAllModals: () => set((state) => ({
        modals: Object.keys(state.modals).reduce((acc, key) => ({
            ...acc, [key]: false
        }), {} as AppState['modals'])
    })),

    batchItems: [],
    setBatchItems: (batchItems) => set({ batchItems }),

    collapsedShelves: safeParseCollapsedShelves(),
    toggleShelf: (warehouse, shelfId) => set((state) => {
        const whState = state.collapsedShelves[warehouse] || {};
        const isAllCollapsed = whState['@all'] === true;
        const currentShelfValue = whState[shelfId];
        const effectiveCollapsed = currentShelfValue !== undefined ? currentShelfValue : isAllCollapsed;

        const newState = {
            ...state.collapsedShelves,
            [warehouse]: {
                ...whState,
                [shelfId]: !effectiveCollapsed
            }
        };
        localStorage.setItem('collapsed_shelves', JSON.stringify(newState));
        return { collapsedShelves: newState };
    }),
    toggleAllShelves: (warehouse, collapse) => set((state) => {
        const newState = {
            ...state.collapsedShelves,
            [warehouse]: { '@all': collapse }
        };
        localStorage.setItem('collapsed_shelves', JSON.stringify(newState));
        return { collapsedShelves: newState };
    }),
}));


