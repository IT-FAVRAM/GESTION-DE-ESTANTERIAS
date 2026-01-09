


import React, { useState, useCallback, useMemo, Suspense, useRef, useEffect } from 'react';
import { LocationId, WarehouseCode, HistoryEntry, formatLocation, PackageType } from './lib/warehouseData';
import { validateCode } from './lib/codeValidation';
import firebase from 'firebase/compat/app';
import { auth } from './lib/firebase';
import { Activity } from 'lucide-react';
import { LeadTimeModal } from './components/LeadTimeModal';

// Components - Critical Path (Eager Load)
import LoginScreen from './components/LoginScreen';
import AssignmentList from './components/AssignmentList';
import Scanner, { ValidationResult as ScannerValidationResult } from './components/Scanner';
import SyncStatus from './components/SyncStatus';
import HistoryView from './components/HistoryView';
import StorageView from './components/StorageView';
import GeminiButton from './components/GeminiButton';
import ThemeToggle from './components/ThemeToggle';
import NotificationToast, { Notification, NotificationType } from './components/NotificationToast';
import { MessagesView } from './components/MessagesView';
import ForkliftBanner from './components/ForkliftBanner';
import WeldingSuppliesView from './components/WeldingSuppliesView';
import GenericSuppliesSection from './components/GenericSuppliesSection';
import { LogoIcon, BatchScanIcon, HistoryIcon, CloseIcon, SettingsIcon, UserIcon, SparklesIcon, CopyIcon, CheckIcon, CameraIcon, SearchIcon, LoadingIcon, BellIcon, TrashIcon, MapIcon, ListIcon, BoxIcon, ChevronLeftIcon, ChevronRightIcon, MultiLayerIcon, DownloadIcon, ChartIcon, LogOutIcon, ErrorIcon, MessageSquareIcon, ShoppingCartIcon, LayersIcon, FactoryIcon } from './components/Icons';

// Components - Lazy Load (Optimization)
const ManualEntryModal = React.lazy(() => import('./components/ManualEntryModal'));
const BatchAssignmentModal = React.lazy(() => import('./components/BatchAssignmentModal'));
const BatchScanner = React.lazy(() => import('./components/BatchScanner'));
const RequestReviewModal = React.lazy(() => import('./components/RequestReviewModal'));
const GeminiResponseModal = React.lazy(() => import('./components/GeminiResponseModal'));
const ValidationScanner = React.lazy(() => import('./components/ValidationScanner'));
const LocationDetailModal = React.lazy(() => import('./components/LocationDetailModal'));
const ShelfDetailModal = React.lazy(() => import('./components/ShelfDetailModal')); // Added for Plegado Carts
const AnomalyReportModal = React.lazy(() => import('./components/AnomalyReportModal'));
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const UserProfileModal = React.lazy(() => import('./components/UserProfileModal'));
const PhotoAnalyzerModal = React.lazy(() => import('./components/PhotoAnalyzerModal'));
const AssignmentModal = React.lazy(() => import('./components/AssignmentModal'));
const MoveItemModal = React.lazy(() => import('./components/MoveItemModal'));
const AddMethodModal = React.lazy(() => import('./components/AddMethodModal'));
const MoveConfirmationModal = React.lazy(() => import('./components/MoveConfirmationModal'));
const RemoveConfirmationModal = React.lazy(() => import('./components/RemoveConfirmationModal'));
const RequestConfirmationModal = React.lazy(() => import('./components/RequestConfirmationModal'));
const ProcessFinishedModal = React.lazy(() => import('./components/ProcessFinishedModal'));
const DuplicateItemModal = React.lazy(() => import('./components/DuplicateItemModal'));
import OccupiedLocationModal from './components/OccupiedLocationModal';
const MultiLocationSelector = React.lazy(() => import('./components/MultiLocationSelector'));
const RelocateLocationModal = React.lazy(() => import('./components/RelocateLocationModal'));
const PackageTypeModal = React.lazy(() => import('./components/PackageTypeModal'));
import WorkingItemsList from './components/WorkingItemsList';
import { useWorkingItems } from './hooks/useWorkingItems';
// const LandingScreen = React.lazy(() => import('./components/LandingScreen')); // REMOVED
const ChaperoCountView = React.lazy(() => import('./components/ChaperoCountView'));
const EmptyLocationsModal = React.lazy(() => import('./components/EmptyLocationsModal'));
const CarretilleroRequestsView = React.lazy(() => import('./components/CarretilleroRequestsView'));

// Hooks
import { useAssignments } from './hooks/useAssignments';
import { useHistory } from './hooks/useHistory';
import { useStorage } from './hooks/useStorage';
import { useInventoryOperations } from './hooks/useInventoryOperations';
import { useGeminiAnalysis } from './hooks/useGeminiAnalysis';
import { useIndexing } from './hooks/useIndexing';
import { useWarehouseConfig } from './hooks/useWarehouseConfig';
import { useRoles, UserRole } from './hooks/useRoles';
import { useSystemNotifications } from './hooks/useSystemNotifications';
import { exportInventoryToExcel } from './lib/excelExport';

type ActiveView = 'warehouse' | 'history' | 'storage' | 'messages' | 'chapero' | 'working' | 'requests';
type WorkflowMode = 'assign' | 'remove' | 'request' | 'finish';

export interface BatchItem {
    article: string;
    order: string;
}

const App: React.FC = () => {
    const [user, setUser] = useState<firebase.User | null>(null);
    const [initializingAuth, setInitializingAuth] = useState(true);

    // Notifications State
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const notify = useCallback((type: NotificationType, title: string, message: string) => {
        const id = crypto.randomUUID();
        setNotifications(prev => [...prev, { id, type, title, message }]);
    }, []);
    const closeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // Role Management
    // Role Management
    const { role, section, loading: roleLoading, canEditStructure, canAnalyzeAnomalies, canAssign, canRemove, canRequestItems, shouldSkipValidation, canExport, canFinishProduction, canAccessChapero } = useRoles(user?.uid);

    // System Notifications Hook & Forklift Banner Data
    const { sendSystemAlert, unreadRequestsCount } = useSystemNotifications(role, notify);

    // WAREHOUSE STATE (Moved up)
    const [activeWarehouse, setActiveWarehouse] = useState<string>(() => {
        return localStorage.getItem('active_warehouse') || 'MEC';
    });

    const handleWarehouseChange = (code: string) => {
        setActiveWarehouse(code);
        localStorage.setItem('active_warehouse', code);
    };

    const { assignments, setAssignments, syncAssignments, loading: assignmentsLoading, error: assignmentsError } = useAssignments();

    const { history, setHistory, addHistoryEntry, syncHistory, loading: historyLoading, error: historyError } = useHistory();
    const { finishedItems, addFinishedItem, syncFinishedItems } = useStorage();
    const { searchAssignments } = useIndexing(assignments, history);

    const { config, setConfig, ...configActions } = useWarehouseConfig(assignments);
    const configLoading = configActions.loading;
    const configError = configActions.error;

    // Inventory Operations with Notification Capability
    const { assignItem, requestItem, removeItem, moveItem, copyItem, relocateLocationContents, emptyShelf, batchAssign, batchAssignToSingleLocation, batchAssignToMultipleLocations, findItemLocation, adminClearLocations, withdrawItem } = useInventoryOperations(assignments, setAssignments, addHistoryEntry, notify, sendSystemAlert, user?.email || undefined);
    const { workingItems } = useWorkingItems(); // Lifted state for AssignmentList
    const gemini = useGeminiAnalysis();

    const [activeView, setActiveView] = useState<ActiveView>('warehouse');

    // Deep Link Logic: Check URL for ?view=requests
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view');
        if (viewParam === 'requests') {
            setActiveView('requests');
            // Optional: Clean URL
            // window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const [searchQuery, setSearchQuery] = useState('');
    const [showEmptyOnly, setShowEmptyOnly] = useState(false);

    // Workflow State
    const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('assign');
    const [pendingAssignment, setPendingAssignment] = useState<{ article: string, order: string, location?: LocationId, mode?: 'move' | 'add' } | null>(null);

    const [isScannerOpen, setScannerOpen] = useState(false);
    const [isPhotoAnalyzerOpen, setPhotoAnalyzerOpen] = useState(false);
    const [isLocationCaptureOpen, setLocationCaptureOpen] = useState(false);
    const [isManualEntryOpen, setManualEntryOpen] = useState(false);
    const [isValidationScannerOpen, setValidationScannerOpen] = useState(false);

    const [isBatchScannerOpen, setBatchScannerOpen] = useState(false);
    const [isBatchAssignmentOpen, setBatchAssignmentOpen] = useState(false);
    const [isRequestReviewOpen, setRequestReviewOpen] = useState(false);
    const [batchItems, setBatchItems] = useState<BatchItem[]>([]);

    // NEW: Multi Location Workflow States
    const [isMultiLocationSelectorOpen, setMultiLocationSelectorOpen] = useState(false);
    const [multiSelectedLocations, setMultiSelectedLocations] = useState<LocationId[]>([]);

    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [leadTimeModalOpen, setLeadTimeModalOpen] = useState(false); // New State
    const [isMoveModalOpen, setMoveModalOpen] = useState(false);
    const [isRelocateModalOpen, setRelocateModalOpen] = useState(false);
    const [relocateSourceLoc, setRelocateSourceLoc] = useState<LocationId | null>(null);

    const [isAdminPanelOpen, setAdminPanelOpen] = useState(false);
    const [isEmptyLocationsModalOpen, setIsEmptyLocationsModalOpen] = useState(false);
    const [isUserProfileOpen, setUserProfileOpen] = useState(false);

    // PackageType Modal State
    const [isPackageTypeModalOpen, setPackageTypeModalOpen] = useState(false);
    const [pendingPackageTypeData, setPendingPackageTypeData] = useState<{
        barcode: string;
        orderId: string;
        location: LocationId | LocationId[];
        allowMultiLocation: boolean;
    } | null>(null);

    const [itemToCopy, setItemToCopy] = useState<{ barcode: string; fromLocation: LocationId; orderId?: string } | null>(null);
    const [itemToMove, setItemToMove] = useState<{ barcode: string; fromLocation: LocationId; orderId?: string } | null>(null);
    const [itemPendingDeletion, setItemPendingDeletion] = useState<{ barcode: string; location: LocationId; orderId?: string } | null>(null);

    const [addItemTarget, setAddItemTarget] = useState<LocationId | null>(null);
    const [inputMethodModal, setInputMethodModal] = useState<{ title: string, subtitle?: string } | null>(null);
    const [selectedMapLocation, setSelectedMapLocation] = useState<LocationId | null>(null);
    const [shelfDetailMode, setShelfDetailMode] = useState<'view' | 'add_choice'>('view'); // New state for ShelfDetailModal mode

    // --- SHELF COLLAPSE STATE ---
    const [collapsedShelves, setCollapsedShelves] = useState<Record<string, Record<string, boolean>>>(() => {
        const saved = localStorage.getItem('collapsed_shelves');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem('collapsed_shelves', JSON.stringify(collapsedShelves));
    }, [collapsedShelves]);

    const toggleShelf = (warehouse: string, shelfId: string) => {
        setCollapsedShelves(prev => {
            const whState = prev[warehouse] || {};
            const isAllCollapsed = whState['@all'] === true;
            const currentShelfValue = whState[shelfId];

            // Effective state logic: 
            // 1. If individual state exists, use it.
            // 2. Otherwise, use the global @all state.
            const effectiveCollapsed = currentShelfValue !== undefined ? currentShelfValue : isAllCollapsed;

            return {
                ...prev,
                [warehouse]: {
                    ...whState,
                    [shelfId]: !effectiveCollapsed
                }
            };
        });
    };

    const toggleAllShelves = (warehouse: string, collapse: boolean) => {
        setCollapsedShelves(prev => ({
            ...prev,
            [warehouse]: {
                '@all': collapse
            }
        }));
    };

    // Auto-expand when selecting a location (e.g. from search)
    useEffect(() => {
        if (selectedMapLocation) {
            // Try to infer shelfId from locationId
            // format: WH-E-SHELF-B-POS
            const parts = selectedMapLocation.split('-');
            const wh = parts[0];
            let shelfId: string | null = null;

            if (wh === 'MEC') {
                if (selectedMapLocation.includes('URGENTE')) shelfId = 'URGENTE';
                else if (selectedMapLocation.includes('GENERAL') || selectedMapLocation.includes('GEN_')) {
                    const pos = selectedMapLocation.split('-').pop() || '';
                    const num = parseInt(pos.replace('MEC ', ''), 10);
                    if (num >= 5 && num <= 13) shelfId = 'GEN_A';
                    else if (num >= 14 && num <= 22) shelfId = 'GEN_B';
                    else if (num >= 23 && num <= 34) shelfId = 'GEN_C';
                    else if (num >= 35 && num <= 46) shelfId = 'GEN_D';
                }
            } else if (wh === 'PLE') {
                const pos = selectedMapLocation.split('-').pop() || '';
                if (pos.startsWith('PLE')) {
                    const num = parseInt(pos.replace('PLE ', ''), 10);
                    if (num >= 1 && num <= 6) shelfId = 'PLE_1_URG';
                    else if (num >= 7 && num <= 16) shelfId = 'PLE_1_GEN';
                    else if (num >= 17 && num <= 30) shelfId = 'EST_2';
                    else if (num >= 31 && num <= 53) shelfId = 'PUNZONADORA';
                }
            } else if (wh === 'REP') {
                if (selectedMapLocation.includes('URGENTE')) shelfId = 'URGENTE';
                else if (selectedMapLocation.includes('ALUMINIO')) shelfId = 'ALUMINIO';
                else if (selectedMapLocation.includes('NORMAL')) shelfId = 'NORMAL';
                else if (selectedMapLocation.includes('MODULAR')) shelfId = 'MODULAR';
            } else if (wh === 'SOL') {
                if (selectedMapLocation.includes('-E1-')) shelfId = '1';
                else if (selectedMapLocation.includes('-E2-')) shelfId = '2';
            }
            // Add more mappings as needed or a generic one
            if (!shelfId) {
                // Generic attempt: parts[1] is often E{shelfId} (e.g. WH-E1 -> 1)
                // or parts[2] is the shelf (MEC-E-URGENTE -> URGENTE)
                if (parts[1] && parts[1].startsWith('E')) {
                    if (parts[1] === 'E' && parts[2]) {
                        shelfId = parts[2];
                    } else {
                        shelfId = parts[1].substring(1);
                    }
                }
            }

            // Special case for RPL
            if (wh === 'RPL' && shelfId) {
                shelfId = 'EST' + shelfId;
            }

            if (shelfId) {
                setCollapsedShelves(prev => {
                    const whState = prev[wh] || {};
                    if (whState[shelfId!] === false && !whState['@all']) return prev;
                    return {
                        ...prev,
                        [wh]: {
                            ...whState,
                            [shelfId!]: false,
                            '@all': false // Ensure it's expanded even if all were collapsed
                        }
                    };
                });
            }
        }
    }, [selectedMapLocation]);

    // New state for Confirmation Modals
    const [moveConfirmationData, setMoveConfirmationData] = useState<{ barcode: string; orderId: string; currentLoc: string; targetLoc: string } | null>(null);
    const [removeConfirmationData, setRemoveConfirmationData] = useState<{ barcode: string; orderId: string; location: string } | null>(null);
    const [requestConfirmationData, setRequestConfirmationData] = useState<{ barcode: string; orderId: string; location?: string } | null>(null);
    const [processFinishedData, setProcessFinishedData] = useState<{ barcode: string; orderId: string; location: string } | null>(null);
    const [duplicateItemData, setDuplicateItemData] = useState<{ barcode: string; orderId: string; location: string } | null>(null);

    // New state for Occupied Location Alert
    const [occupiedLocationData, setOccupiedLocationData] = useState<{ locationId: LocationId; newItem: { barcode: string; orderId: string }; mode: 'move' | 'add' } | null>(null);

    const warehouseListRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = auth.onAuthStateChanged((firebaseUser) => {
            setUser(firebaseUser);
            setInitializingAuth(false);
        });
        return () => unsub();
    }, []);

    const handleLogout = () => {
        auth.signOut().catch(console.error);
    };

    const handleSyncData = useCallback(() => {
        syncAssignments();
        syncHistory();
        syncFinishedItems();
        notify('success', 'Sincronizado', 'Datos recargados desde memoria local.');
    }, [syncAssignments, syncHistory, syncFinishedItems, notify]);

    // Global Error State
    const globalError = assignmentsError || historyError || configError;

    const resetScanWorkflow = () => {
        setPendingAssignment(null);
        setScannerOpen(false);
        setPhotoAnalyzerOpen(false);
        setLocationCaptureOpen(false);
        setValidationScannerOpen(false);
        setAddItemTarget(null);
        setDuplicateItemData(null);
        setBatchItems([]);
        setOccupiedLocationData(null);
        // Clean up new flow too
        setMultiLocationSelectorOpen(false);
        setMultiSelectedLocations([]);
        setIsEmptyLocationsModalOpen(false);
    };

    const isFreeTextTarget = useMemo(() => {
        // Allow free text for carts implicitly if needed, or by logic
        if (!addItemTarget) return false;
        return false;
    }, [addItemTarget]);

    const scrollWarehouseList = (direction: 'left' | 'right') => {
        if (warehouseListRef.current) {
            const scrollAmount = 200;
            if (direction === 'left') {
                warehouseListRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else {
                warehouseListRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        }
    };

    // --- WORKFLOW STARTERS ---
    const handleInitiateRemoveWorkflow = () => {
        // Permission check handled in execution time for location specific, but global button visibility check handles basic capability
        setWorkflowMode('remove');
        resetScanWorkflow();
        setInputMethodModal({ title: 'Retirar Artículo', subtitle: 'Seleccione cómo identificar el artículo' });
    };

    const handleInitiateRequestWorkflow = () => {
        if (!canRequestItems()) return;
        setWorkflowMode('request');
        resetScanWorkflow();
        setInputMethodModal({ title: 'Realizar Solicitud', subtitle: 'Escanee o introduzca manualmente los artículos' });
    };

    const handleInitiateFinishWorkflow = () => {
        if (!canFinishProduction()) return;
        setWorkflowMode('finish');
        resetScanWorkflow();
        setPhotoAnalyzerOpen(true);
    };

    // --- NEW WORKFLOW: MULTI OCCUPANCY ---
    const handleInitiateMultiOccupancy = () => {
        if (!canAssign()) return;
        setWorkflowMode('assign');
        resetScanWorkflow();
        setMultiLocationSelectorOpen(true);
    };

    const handleMultiLocationSelectionConfirm = (locations: LocationId[]) => {
        setMultiSelectedLocations(locations);
        setMultiLocationSelectorOpen(false);
        // Start camera flow immediately after selection
        setTimeout(() => setPhotoAnalyzerOpen(true), 100);
    };


    // --- CONFIRMATION HANDLERS ---
    const handleConfirmMove = () => {
        if (!moveConfirmationData) return;
        const { barcode, orderId, targetLoc } = moveConfirmationData;

        checkLocationAndAssign(barcode, orderId, targetLoc as LocationId, 'move', () => {
            setMoveConfirmationData(null);
        });
    };

    const handleConfirmRemove = () => {
        if (!removeConfirmationData) return;
        const { barcode, location, orderId } = removeConfirmationData;

        // Permissions check for removal
        if (!canRemove(location)) {
            notify('error', 'Permiso Denegado', `No tienes permisos para retirar artículos de ${formatLocation(location)}.`);
            setRemoveConfirmationData(null);
            resetScanWorkflow();
            return;
        }

        const success = removeItem(barcode, location as LocationId, orderId);
        if (success) {
            notify('success', 'Retirado', `${barcode} eliminado de ${formatLocation(location)}`);
        }
        setRemoveConfirmationData(null);
        resetScanWorkflow();
    };

    const handleConfirmProcessFinish = () => {
        if (!processFinishedData) return;
        const { barcode, orderId, location } = processFinishedData;

        const now = new Date().toISOString();
        const success = removeItem(barcode, location as LocationId, orderId);

        if (success) {
            addHistoryEntry({
                barcode,
                orderId,
                action: 'process_finished',
                fromLocation: location as LocationId,
                timestamp: now
            });
            addFinishedItem({
                barcode,
                orderId,
                timestamp: now,
                finishedAt: now,
                status: 'FINALIZADO'
            });
            notify('success', 'Producción Finalizada', `El artículo ${barcode} ha pasado a ALMACÉN.`);
        }

        setProcessFinishedData(null);
        resetScanWorkflow();
    };



    const handleConfirmBatchRequest = () => {
        if (batchItems.length === 0) return;

        batchItems.forEach(item => {
            requestItem(item.article, item.order);
        });

        notify('success', 'Solicitud Múltiple Enviada', `Se han notificado ${batchItems.length} artículos al carretillero.`);
        setBatchItems([]);
        setRequestReviewOpen(false);
        setWorkflowMode('assign');
    };

    const handleDuplicateMove = () => {
        if (duplicateItemData) {
            setPendingAssignment({
                article: duplicateItemData.barcode,
                order: duplicateItemData.orderId,
                location: undefined,
                mode: 'move'
            });
            setDuplicateItemData(null);
            setLocationCaptureOpen(true);
        }
    };

    const handleDuplicateAdd = () => {
        if (duplicateItemData) {
            setPendingAssignment({
                article: duplicateItemData.barcode,
                order: duplicateItemData.orderId,
                location: undefined,
                mode: 'add'
            });
            setDuplicateItemData(null);
            setLocationCaptureOpen(true);
        }
    };

    const handleConfirmOccupiedAssignment = (mode: 'merge' | 'new_batch') => {
        if (!occupiedLocationData) return;
        const { newItem, locationId } = occupiedLocationData;

        const forceMulti = mode === 'new_batch';

        assignItem(newItem.barcode, newItem.orderId, locationId, { allowMultiLocation: forceMulti });

        if (mode === 'merge') {
            notify('success', 'Lote Actualizado', `${newItem.barcode} unificado en ${formatLocation(locationId)}`);
        } else {
            notify('success', 'Nuevo Lote Añadido', `${newItem.barcode} añadido a ${formatLocation(locationId)}`);
        }

        setOccupiedLocationData(null);
        resetScanWorkflow();
    };

    const handleDirectAssign = useCallback((barcode: string, orderId: string, location: LocationId) => {
        assignItem(barcode, orderId, location, { allowMultiLocation: true });
        notify('success', 'Añadido', `${barcode} añadido a ${formatLocation(location)}`);
    }, [assignItem, notify]);

    const handleDirectRemove = useCallback((barcode: string, location: LocationId, orderId: string) => {
        const success = removeItem(barcode, location, orderId);
        if (success) notify('success', 'Eliminado', `${barcode} retirado de ${formatLocation(location)}`);
    }, [removeItem, notify]);

    const checkLocationAndAssign = (
        barcode: string,
        orderId: string,
        targetLocation: LocationId,
        mode: 'move' | 'add',
        onSuccess?: () => void
    ) => {
        const existingItems = assignments[targetLocation] || [];
        const isOccupied = existingItems.length > 0;

        if (isOccupied) {
            setOccupiedLocationData({
                locationId: targetLocation,
                newItem: { barcode, orderId },
                mode
            });
            if (onSuccess) onSuccess();
            return;
        }

        // Show PackageType Modal before assigning
        setPendingPackageTypeData({
            barcode,
            orderId,
            location: targetLocation,
            allowMultiLocation: mode === 'add'
        });
        setPackageTypeModalOpen(true);
        if (onSuccess) onSuccess();
    };

    // Handler for when user selects a package type
    const handlePackageTypeSelect = (packageType: PackageType) => {
        if (!pendingPackageTypeData) return;

        const { barcode, orderId, location, allowMultiLocation } = pendingPackageTypeData;

        assignItem(barcode, orderId, location, {
            allowMultiLocation,
            packageType
        });

        const locText = Array.isArray(location)
            ? `${location.length} ubicaciones`
            : formatLocation(location);
        notify('success', 'Asignado', `${barcode} -> ${locText}`);

        // Cleanup
        setPackageTypeModalOpen(false);
        setPendingPackageTypeData(null);
        resetScanWorkflow();
    };


    const handlePhotoAnalysisResult = (result: string | { article: string; order: string }) => {
        let barcode = '';
        let orderId = 'PENDIENTE';

        if (typeof result === 'object') {
            barcode = result.article;
            orderId = result.order;
        } else {
            barcode = result;
        }

        // NEW: Check if we are in Multi-Location mode
        if (multiSelectedLocations.length > 0) {
            setPhotoAnalyzerOpen(false);
            // Execute mass assignment
            assignItem(barcode, orderId, multiSelectedLocations, { allowMultiLocation: true });
            notify('success', 'Asignación Masiva', `Artículo ${barcode} asignado a ${multiSelectedLocations.length} ubicaciones.`);
            resetScanWorkflow();
            return;
        }

        processScanInput(barcode, orderId);
    };

    const processScanInput = (code: string, order: string | null) => {
        const finalOrder = order || 'PENDIENTE';

        setScannerOpen(false);
        setPhotoAnalyzerOpen(false);
        setManualEntryOpen(false);

        if (workflowMode === 'finish') {
            const location = findItemLocation(code, finalOrder);
            if (location) {
                setProcessFinishedData({ barcode: code, orderId: finalOrder, location });
            } else {
                notify('error', 'No encontrado en planta', `El artículo ${code} (OF: ${finalOrder}) no tiene asignada ninguna ubicación.`);
                resetScanWorkflow();
            }
            return;
        }

        if (workflowMode === 'request') {
            const location = findItemLocation(code, finalOrder);
            setRequestConfirmationData({
                barcode: code,
                orderId: finalOrder,
                location: location || undefined
            });
            setScannerOpen(false);
            setPhotoAnalyzerOpen(false);
            setManualEntryOpen(false);
            return;
        }

        if (workflowMode === 'remove') {
            // Attempt strict search first
            const location = findItemLocation(code, finalOrder);

            if (location) {
                // Found exact match (Article + OF)
                setRemoveConfirmationData({ barcode: code, orderId: finalOrder, location });
            } else {
                // Strict failed, check loose matching (only Barcode)
                // This is crucial if the stored OF differs from the one entered manually
                const locationLoose = findItemLocation(code);

                if (locationLoose) {
                    // Retrieve the ACTUAL items in that location to verify ambiguity
                    const itemsInLoc = assignments[locationLoose] || [];
                    const matches = itemsInLoc.filter(i => i.barcode === code);

                    if (matches.length === 1) {
                        // Found unique article, resolve using the DB's orderId
                        const realOrder = matches[0].orderId;
                        setRemoveConfirmationData({ barcode: code, orderId: realOrder, location: locationLoose });
                    } else {
                        // Ambiguity: Multiple items with same barcode but different OFs
                        notify('warning', 'Múltiples coincidencias', `Existen varios artículos ${code} con distintas OF. Por favor, retíralo manualmente desde la lista de la ubicación.`);
                        resetScanWorkflow();
                    }
                } else {
                    notify('error', 'No encontrado', `El artículo ${code} no está en inventario.`);
                    resetScanWorkflow();
                }
            }
            return;
        }

        if (workflowMode === 'request') {
            setRequestConfirmationData({ barcode: code, orderId: finalOrder });
            return;
        }

        // --- ASSIGN LOGIC ---
        const existingLoc = findItemLocation(code, finalOrder);
        if (existingLoc && !addItemTarget) {
            setDuplicateItemData({ barcode: code, orderId: finalOrder, location: existingLoc });
            return;
        }

        setPendingAssignment({ article: code, order: finalOrder, location: addItemTarget || undefined, mode: 'move' });

        if (addItemTarget) {
            if (isFreeTextTarget || shouldSkipValidation()) {
                checkLocationAndAssign(code, finalOrder, addItemTarget, 'add');
            } else {
                setValidationScannerOpen(true);
            }
        } else {
            setLocationCaptureOpen(true);
        }
    };

    const handleLocationCaptureResult = (extractedText: string | { article: string; order: string }) => {
        let locationText = typeof extractedText === 'string' ? extractedText.toUpperCase().trim() : '';
        if (!locationText) return;

        if (locationText.includes("ALMACEN") || locationText.includes("ALMACÉN") || locationText.includes("FINAL")) {
            if (batchItems.length > 0) {
                const now = new Date().toISOString();
                batchItems.forEach(item => {
                    const currentLoc = findItemLocation(item.article, item.order);
                    if (currentLoc) removeItem(item.article, currentLoc, item.order);
                    addHistoryEntry({ barcode: item.article, orderId: item.order, action: 'process_finished', fromLocation: currentLoc || undefined, timestamp: now });
                    addFinishedItem({ barcode: item.article, orderId: item.order, timestamp: now, finishedAt: now, status: 'FINALIZADO' });
                });
                notify('success', 'Lote Finalizado', `${batchItems.length} artículos movidos a ALMACÉN.`);
                setLocationCaptureOpen(false);
                setBatchItems([]);
                resetScanWorkflow();
                return;
            }

            if (pendingAssignment) {
                const currentLoc = findItemLocation(pendingAssignment.article, pendingAssignment.order);
                if (currentLoc) {
                    setProcessFinishedData({ barcode: pendingAssignment.article, orderId: pendingAssignment.order, location: currentLoc });
                    setLocationCaptureOpen(false);
                } else {
                    notify('error', 'Error', 'El artículo no está asignado, no se puede finalizar.');
                    resetScanWorkflow();
                }
                return;
            }
        }

        const normalizedText = locationText.replace(/[\.\-_]/g, ' ').replace(/\s+/g, ' ');

        const whMappings = [
            { keyword: 'ROB SOL', code: 'RSO' }, { keyword: 'ROB.SOL', code: 'RSO' },
            { keyword: 'ROB PLE', code: 'RPL' }, { keyword: 'ROB.PLE', code: 'RPL' },
            { keyword: 'RSO', code: 'RSO' }, { keyword: 'RPL', code: 'RPL' },
            { keyword: 'MEC', code: 'MEC' }, { keyword: 'PLE', code: 'PLE' },
            { keyword: 'SOL', code: 'SOL' }, { keyword: 'REP', code: 'REP' },
            { keyword: 'PIN', code: 'PIN' },
            { keyword: 'SXP', code: 'SXP' },
            { keyword: 'COM', code: 'COM' }, { keyword: 'CAL', code: 'CAL' },
            { keyword: 'ZIN', code: 'ZIN' }, { keyword: 'BALDA', code: 'ZIN' },
            { keyword: 'CARRO 1', code: 'C1' }, { keyword: 'CARRO 2', code: 'C2' },
            { keyword: 'C1', code: 'C1' }, { keyword: 'C2', code: 'C2' }
        ];

        let matchedCode: string | null = null;
        let matchedNumber: number = 0;

        for (const map of whMappings) {
            if (normalizedText.includes(map.keyword)) {
                const digitMatch = normalizedText.match(/(\d+)/);
                if (digitMatch) {
                    matchedCode = map.code;
                    matchedNumber = parseInt(digitMatch[0], 10);
                    break;
                }
            }
        }

        let matchedLocation: LocationId | null = null;
        const pad3 = (n: number) => n.toString().padStart(3, '0');
        const numStr = pad3(matchedNumber);

        if (matchedCode) {
            if (matchedCode === 'MEC') {
                let shelf;
                if (matchedNumber <= 4) shelf = 'URGENTE';
                else if (matchedNumber <= 13) shelf = 'GEN_A';
                else if (matchedNumber <= 22) shelf = 'GEN_B';
                else if (matchedNumber <= 34) shelf = 'GEN_C';
                else shelf = 'GEN_D';
                matchedLocation = `MEC-E-${shelf}-B1-MEC ${numStr}` as LocationId;
            }
            else if (matchedCode === 'SOL') {
                const shelf = matchedNumber <= 4 ? '1' : '2';
                matchedLocation = `SOL-E${shelf}-B1-SOL ${numStr}` as LocationId;
            }
            else if (matchedCode === 'PLE') {
                matchedLocation = `PLE-E1-B1-PLE ${numStr}` as LocationId;
            }

            else if (matchedCode === 'SXP') matchedLocation = `SXP-E1-B1-SXP ${numStr}` as LocationId;
            else if (matchedCode === 'RSO') matchedLocation = `RSO-E1-B1-ROB.SOL ${numStr}` as LocationId;
            else if (matchedCode === 'RPL') {
                const shelf = matchedNumber <= 14 ? '1' : '2';
                matchedLocation = `RPL-E${shelf}-B1-ROB.PLE ${numStr}` as LocationId;
            }
            else if (matchedCode === 'REP') {
                if (matchedNumber <= 4) matchedLocation = `REP-E-URGENTE-B1-REP ${numStr}` as LocationId;
                else if (matchedNumber <= 14) matchedLocation = `REP-E-ALUMINIO-B1-REP ${numStr}` as LocationId;
                else if (matchedNumber <= 24) matchedLocation = `REP-E-NORMAL-B1-REP ${numStr}` as LocationId;
                else if (matchedNumber <= 40) matchedLocation = `REP-E-MODULAR-B1-REP ${numStr}` as LocationId;
                else matchedLocation = `REP-E-MODULAR-B1-REP ${numStr}` as LocationId; // Default to modular if higher
            }
            else if (matchedCode === 'PIN') {
                const shelf = matchedNumber <= 27 ? 'DENTRO' : 'FUERA';
                matchedLocation = `PIN-E-${shelf}-B1-PIN ${numStr}` as LocationId;
            }
            else if (matchedCode === 'CAL') {
                const shelf = matchedNumber <= 22 ? 'RECHAZOS' : 'GENERAL';
                matchedLocation = `CAL-E-${shelf}-B1-CAL ${numStr}` as LocationId;
            }
            else if (matchedCode === 'COM') {
                matchedLocation = `COM-E1-B1-COM ${numStr}` as LocationId;
            }
            else if (matchedCode === 'ZIN') {
                if (matchedNumber >= 1 && matchedNumber <= 5) matchedLocation = `ZIN-E1-B${matchedNumber}-1` as LocationId;
            }
            else if (matchedCode === 'C1') matchedLocation = `PLE-E1-B1-PLE C1-${matchedNumber}` as LocationId;
            else if (matchedCode === 'C2') matchedLocation = `PLE-E1-B1-PLE C2-${matchedNumber}` as LocationId;
        }

        if (!matchedLocation) {
            const foundKey = Object.keys(assignments).find(k => k.endsWith(locationText) || k.includes(locationText));
            if (foundKey) matchedLocation = foundKey as LocationId;
        }

        if (matchedLocation) {
            if (batchItems.length > 0) {
                batchAssignToSingleLocation(batchItems, matchedLocation);
                setLocationCaptureOpen(false);
                setBatchItems([]);
                resetScanWorkflow();
                return;
            }

            if (pendingAssignment) {
                const intent = pendingAssignment.mode || 'move';

                if (intent === 'add') {
                    setLocationCaptureOpen(false);
                    checkLocationAndAssign(pendingAssignment.article, pendingAssignment.order, matchedLocation, 'add');
                } else {
                    const currentLoc = findItemLocation(pendingAssignment.article, pendingAssignment.order);
                    setLocationCaptureOpen(false);

                    if (currentLoc && currentLoc !== matchedLocation) {
                        setMoveConfirmationData({
                            barcode: pendingAssignment.article,
                            orderId: pendingAssignment.order,
                            currentLoc: currentLoc,
                            targetLoc: matchedLocation
                        });
                    } else {
                        checkLocationAndAssign(pendingAssignment.article, pendingAssignment.order, matchedLocation, 'move');
                    }
                }
            }
        } else {
            notify('error', 'Ubicación no reconocida', `Texto detectado: "${locationText}". Inténtelo de nuevo.`);
        }
    };


    const handleWorkflowScan = useCallback((decodedText: string) => {
        const result = validateCode(decodedText);
        const code = result.normalizedCode;

        if (result.type === 'special' && code === 'ALMACEN') {
            if (pendingAssignment) {
                const location = findItemLocation(pendingAssignment.article, pendingAssignment.order);
                if (location) {
                    setProcessFinishedData({ barcode: pendingAssignment.article, orderId: pendingAssignment.order, location });
                    setScannerOpen(false);
                    setIsAssignmentModalOpen(false);
                }
            }
            return;
        }

        processScanInput(code, 'PENDIENTE');

    }, [pendingAssignment, findItemLocation, assignItem, notify]);


    const handleAssignmentModalConfirm = (barcode: string, locationOrLocations: LocationId | LocationId[]) => {
        if (!canAssign()) return;

        const targetLocs = Array.isArray(locationOrLocations) ? locationOrLocations : [locationOrLocations];
        const singleTarget = targetLocs[0];

        setIsAssignmentModalOpen(false);

        const finalOrder = pendingAssignment?.order || 'PENDIENTE';
        const intent = pendingAssignment?.mode || 'move';

        setPendingAssignment(prev => prev ? { ...prev, location: singleTarget } : { article: barcode, order: finalOrder, location: singleTarget, mode: intent });

        if (targetLocs.length > 1) {
            assignItem(barcode, finalOrder, locationOrLocations, { allowMultiLocation: true });
            notify('success', 'Asignado Múltiple', `Artículo asignado a ${targetLocs.length} ubicaciones.`);
            resetScanWorkflow();
        } else {
            if (shouldSkipValidation()) {
                checkLocationAndAssign(barcode, finalOrder, singleTarget, intent);
            } else {
                setValidationScannerOpen(true);
            }
        }
    };

    const handleValidationSuccess = () => {
        if (pendingAssignment && pendingAssignment.location) {
            const intent = pendingAssignment.mode || 'move';
            const existingLoc = findItemLocation(pendingAssignment.article, pendingAssignment.order);

            if (intent === 'add') {
                checkLocationAndAssign(pendingAssignment.article, pendingAssignment.order, pendingAssignment.location, 'add');
            } else {
                if (existingLoc && existingLoc !== pendingAssignment.location) {
                    setMoveConfirmationData({
                        barcode: pendingAssignment.article,
                        orderId: pendingAssignment.order,
                        currentLoc: existingLoc,
                        targetLoc: pendingAssignment.location
                    });
                } else {
                    checkLocationAndAssign(pendingAssignment.article, pendingAssignment.order, pendingAssignment.location, 'move');
                }
            }
        }
        setValidationScannerOpen(false);
    };

    const handleBatchScanComplete = (items: BatchItem[]) => {
        setBatchItems(items);
        setBatchScannerOpen(false);

        if (workflowMode === 'request') {
            setRequestReviewOpen(true);
        } else {
            // Fallback for "Lote" button legacy flow (Batch Scan -> Location Photo)
            // Kept for single-location batch fill
            setLocationCaptureOpen(true);
        }
    };

    // Replaced manual batch map by MultiLocationSelector flow, but keeping signature if needed or unused.
    const handleBatchAssignmentMap = (mappedItems: { item: BatchItem; location: LocationId }[]) => {
        setBatchAssignmentOpen(false);
        const groupedByLoc: Record<string, BatchItem[]> = {};
        mappedItems.forEach(entry => {
            if (!groupedByLoc[entry.location]) groupedByLoc[entry.location] = [];
            groupedByLoc[entry.location].push(entry.item);
        });
        const locations = Object.keys(groupedByLoc);
        if (locations.length === 1) {
            const loc = locations[0];
            batchAssignToSingleLocation(groupedByLoc[loc], loc as LocationId);
        } else {
            locations.forEach(loc => {
                batchAssignToSingleLocation(groupedByLoc[loc], loc as LocationId);
            });
            notify('success', 'Distribución Completada', `Lote distribuido en ${locations.length} ubicaciones.`);
        }
        setBatchItems([]);
        resetScanWorkflow();
    };

    const handleFinishProduction = () => {
        setIsAssignmentModalOpen(false);
        if (pendingAssignment) {
            const currentLoc = findItemLocation(pendingAssignment.article, pendingAssignment.order);
            if (currentLoc) {
                setProcessFinishedData({ barcode: pendingAssignment.article, orderId: pendingAssignment.order, location: currentLoc });
            }
        }
    };

    const handleInitiateDelete = (barcode: string, location: LocationId, orderId?: string) => {
        // Updated: Permission Check with Location Context
        if (!canRemove(location)) {
            notify('error', 'Permiso Denegado', `No tienes permisos para retirar artículos de ${formatLocation(location)}.`);
            return;
        }
        setItemPendingDeletion({ barcode, location, orderId });
    };

    const handleConfirmDelete = () => {
        if (!itemPendingDeletion) return;
        const success = removeItem(itemPendingDeletion.barcode, itemPendingDeletion.location, itemPendingDeletion.orderId);
        setItemPendingDeletion(null);
        if (success) {
            notify('success', 'Retirado', 'Artículo eliminado correctamente.');
        }
    };

    const handleInitiateCopy = (barcode: string, fromLocation: LocationId, orderId?: string) => {
        if (!canAssign()) return;
        setItemToMove(null);
        setItemToCopy(prev => (prev?.barcode === barcode && prev?.fromLocation === fromLocation && prev?.orderId === orderId) ? null : { barcode, fromLocation, orderId });
        if (selectedMapLocation) setSelectedMapLocation(null);
    };

    const handleInitiateMove = (barcode: string, fromLocation: LocationId, orderId?: string) => {
        if (!canAssign()) return;
        setItemToCopy(null);
        setItemToMove({ barcode, fromLocation, orderId });
        setMoveModalOpen(true);
        if (selectedMapLocation) setSelectedMapLocation(null);
    };

    const handleMoveModalConfirm = (toLocation: LocationId) => {
        if (itemToMove) {
            checkLocationAndAssign(itemToMove.barcode, itemToMove.orderId || 'PENDIENTE', toLocation, 'move');
            setMoveModalOpen(false);
            setItemToMove(null);
        }
    };

    const handlePasteMovedItem = (toLocation: LocationId) => {
        if (!itemToMove) return;
        checkLocationAndAssign(itemToMove.barcode, itemToMove.orderId || 'PENDIENTE', toLocation, 'move');
        setItemToMove(null);
    };

    const handleDragMove = (barcode: string, fromLocation: LocationId, toLocation: LocationId) => {
        if (!canAssign()) return;
        if (fromLocation === toLocation) return;
        const item = assignments[fromLocation]?.find(i => i.barcode === barcode);
        if (item) {
            checkLocationAndAssign(barcode, item.orderId, toLocation, 'move');
        }
    };

    const handleInitiateAdd = (locationId: LocationId) => {
        if (!canAssign()) {
            notify('error', 'Permiso Denegado', 'No tiene permisos para añadir artículos.');
            return;
        }

        if (locationId.includes('PLE C1') || locationId.includes('PLE C2')) {
            setSelectedMapLocation(locationId);
            setShelfDetailMode('add_choice');
            return;
        }

        setWorkflowMode('assign');
        setAddItemTarget(locationId);

        setInputMethodModal({ title: 'Añadir a Ubicación', subtitle: formatLocation(locationId) });
    };

    const handleInitiateRequest = (barcode: string, orderId: string, fromLocation: LocationId) => {
        if (!canRequestItems()) {
            notify('error', 'Permiso Denegado', 'No tiene permisos para solicitar artículos.');
            return;
        }
        setRequestConfirmationData({ barcode, orderId, location: fromLocation });
    };

    const handleConfirmRequest = (priority: 'normal' | 'high' = 'normal') => {
        if (!requestConfirmationData) return;
        requestItem(requestConfirmationData.barcode, requestConfirmationData.orderId, requestConfirmationData.location as LocationId, priority);
        setRequestConfirmationData(null);
        resetScanWorkflow();
    };

    const handleSelectManualAdd = () => {
        setManualEntryOpen(true);
    };

    const handleSelectPhotoAdd = () => {
        setPhotoAnalyzerOpen(true);
    };

    const handleFabClick = () => {
        if (activeView !== 'warehouse') setActiveView('warehouse');
        setWorkflowMode('assign');
        resetScanWorkflow();
        setPhotoAnalyzerOpen(true);
    }

    const searchResults = useMemo(() => searchAssignments(searchQuery), [searchQuery, searchAssignments]);

    const handleTabChange = (whCode: string) => {
        setActiveView('warehouse');
        handleWarehouseChange(whCode);
    };

    // --- RENDERING CONDITIONS & LOADERS ---

    // AUDIT BYPASS: REMOVED - Auth Restored
    if (initializingAuth) {
        return (
            <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
                <LoadingIcon className="h-12 w-12 text-cyan-600 animate-spin" />
                <p className="text-slate-600 dark:text-slate-300 font-bold text-lg">Cargando sesión...</p>
            </div>
        );
    }

    if (!user) {
        return <LoginScreen />;
    }

    if (roleLoading) {
        return (
            <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
                <LoadingIcon className="h-12 w-12 text-purple-600 animate-spin" />
                <p className="text-slate-600 dark:text-slate-300 font-bold text-lg">Cargando permisos...</p>
            </div>
        );
    }

    if (!role) {
        return (
            <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 text-red-600 dark:text-red-400">
                    <ErrorIcon className="h-10 w-10" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Acceso No Autorizado</h1>
                <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-sm">
                    No tienes un rol asignado en el sistema. Por favor, contacta con administración para activar tu cuenta.
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button
                        onClick={handleLogout}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-3"
                    >
                        <LogOutIcon className="h-5 w-5" />
                        Cerrar Sesión
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-all"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    // Data Loading Block
    const isDataLoading = assignmentsLoading || historyLoading || configLoading;

    if (isDataLoading) {
        return (
            <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
                <LoadingIcon className="h-12 w-12 text-blue-500 animate-spin" />
                <p className="text-slate-600 dark:text-slate-300 font-bold text-lg">Cargando datos del almacén...</p>
            </div>
        );
    }

    return (
        <>
            <div className="fixed inset-0 z-[-1] bg-slate-50 dark:bg-slate-950"></div>

            {/* Notifications Toast Container */}
            <div className="fixed top-4 right-4 z-[999] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 md:px-0">
                {notifications.map(n => <NotificationToast key={n.id} notification={n} onClose={closeNotification} />)}
            </div>

            <div className="relative min-h-screen flex flex-col pb-24 md:pb-0">

                {/* HEADER */}
                <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 safe-area-inset-top">
                    <div className="max-w-7xl mx-auto px-4 h-16 md:h-20 flex justify-between items-center">
                        <div className="flex items-center gap-2 md:gap-3">
                            <LogoIcon className="h-7 w-7 md:h-8 md:w-8 text-cyan-600 dark:text-cyan-400" />
                            <div className="leading-tight">
                                <h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white tracking-tight">GESTOR</h1>
                                {role !== 'CARRETILLERO' && (
                                    <div className="flex flex-col">
                                        <span className="text-[10px] md:text-xs font-bold bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-300 uppercase w-fit">{role}</span>
                                        {role === 'JEFE' && section && <span className="text-[8px] md:text-[10px] text-purple-600 dark:text-purple-400 font-bold mt-0.5 uppercase">{section}</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Desktop Nav Pills */}
                        <div className="hidden md:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveView('warehouse')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeView === 'warehouse' ? 'bg-cyan-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'} `}
                            >
                                Planta
                            </button>
                            <button
                                onClick={() => setActiveView('storage')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeView === 'storage' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'} `}
                            >
                                Almacén
                            </button>
                            <button
                                onClick={() => setActiveView('working')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeView === 'working' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'} `}
                            >
                                En Trabajo
                            </button>
                            <button
                                onClick={() => setActiveView('history')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeView === 'history' ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'} `}
                            >
                                Historial
                            </button>
                            <button
                                onClick={() => setActiveView('messages')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeView === 'messages' ? 'bg-pink-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'} `}
                            >
                                <MessageSquareIcon className="h-4 w-4" />
                                Chat
                            </button>
                            {canAccessChapero() && (
                                <button
                                    onClick={() => setActiveView('chapero')}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeView === 'chapero' ? 'bg-orange-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'} `}
                                >
                                    <LayersIcon className="h-4 w-4" />
                                    Chapero
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2 md:gap-4">
                            <SyncStatus onSync={handleSyncData} />



                            <div className="hidden md:flex gap-2">
                                <ThemeToggle />
                                {role === 'ADMIN' && (
                                    <button
                                        onClick={() => setIsEmptyLocationsModalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors border border-red-200 dark:border-red-800/30"
                                        title="Vaciar Ubicaciones Administrativamente"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                        <span className="hidden lg:inline text-xs">VACIAR</span>
                                    </button>
                                )}
                                <button onClick={() => setUserProfileOpen(true)} className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="Perfil de Usuario"><UserIcon className="h-5 w-5" /></button>
                                {(role === 'ADMIN' || role === 'JEFE') && (
                                    <button
                                        onClick={() => setAdminPanelOpen(true)}
                                        className={`p - 3 rounded-full transition-colors flex items-center gap-2 ${role === 'ADMIN' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800'} `}
                                        title={role === 'ADMIN' ? "Panel Admin" : "Gestión Recepción"}
                                    >
                                        {role === 'ADMIN' ? <SettingsIcon className="h-5 w-5" /> : <><span className="text-lg">📦</span> <span className="font-bold text-xs hidden lg:inline">Recepción</span></>}
                                    </button>
                                )}
                                <button onClick={handleLogout} className="p-3 rounded-full bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors" title="Cerrar Sesión"><LogOutIcon className="h-5 w-5" /></button>
                            </div>
                            <div className="md:hidden flex gap-2 items-center">
                                {role === 'ADMIN' && (
                                    <button
                                        onClick={() => setIsEmptyLocationsModalOpen(true)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-100 border border-red-200 shadow-sm whitespace-nowrap"
                                        title="Vaciar Ubicaciones"
                                    >
                                        VACIAR ESTANTERIAS
                                    </button>
                                )}
                                <button onClick={() => setUserProfileOpen(true)} className="p-2 rounded-full text-slate-500 dark:text-slate-300">
                                    <UserIcon className="h-6 w-6" />
                                </button>
                                <button onClick={handleLogout} className="p-2 rounded-full text-red-500 dark:text-red-400">
                                    <LogOutIcon className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* CARRETILLERO ALERT BANNER */}
                    {role === 'CARRETILLERO' && (
                        <ForkliftBanner
                            count={unreadRequestsCount}
                            onClick={() => {
                                setActiveView('messages');
                            }}
                        />
                    )}
                </header>

                <main className="flex-grow p-3 md:p-4 max-w-7xl mx-auto w-full flex flex-col gap-4 md:gap-6">

                    {/* Global Error Banner */}
                    {globalError && (
                        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-3">
                            <ErrorIcon className="h-6 w-6" />
                            <p className="font-bold">Error cargando datos. Inténtalo de nuevo o revisa tu conexión.</p>
                        </div>
                    )}

                    {activeView === 'warehouse' && (
                        <div className="sticky top-16 md:top-20 z-20 bg-slate-50 dark:bg-slate-950 pb-2 -mx-3 px-3 md:mx-0 md:px-0 group">
                            <button
                                onClick={() => scrollWarehouseList('left')}
                                className="absolute left-0 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hidden md:flex hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                aria-label="Scroll Left"
                            >
                                <ChevronLeftIcon className="h-5 w-5" />
                            </button>

                            <div ref={warehouseListRef} className="overflow-x-auto smooth-scroll no-scrollbar flex gap-2 pb-2 snap-x w-full px-1 md:px-12">
                                {config.warehouses.map(wh => (
                                    <React.Fragment key={wh.code}>
                                        <button
                                            onClick={() => handleTabChange(wh.code)}
                                            className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border
                                        ${activeWarehouse === wh.code
                                                    ? 'bg-cyan-600 text-white border-cyan-700 shadow-md transform scale-105 z-10'
                                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                }
        `}
                                        >
                                            {wh.name}
                                        </button>
                                        {/* Inyectar secciones especiales después de Zincado */}
                                        {wh.code === 'ZIN' && (
                                            <>
                                                <button
                                                    onClick={() => handleWarehouseChange('REP_SOL')}
                                                    className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border flex items-center gap-2
                                                ${activeWarehouse === 'REP_SOL'
                                                            ? 'bg-purple-600 text-white border-purple-700 shadow-md transform scale-105 z-10'
                                                            : 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/30 hover:bg-purple-50 dark:hover:bg-purple-900/10'
                                                        }
        `}
                                                >
                                                    <BoxIcon className="h-4 w-4" /> Repuestos Soldadura
                                                </button>
                                                <button
                                                    onClick={() => handleWarehouseChange('CARRO_SOL')}
                                                    className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border flex items-center gap-2
                                                ${activeWarehouse === 'CARRO_SOL'
                                                            ? 'bg-orange-600 text-white border-orange-700 shadow-md transform scale-105 z-10'
                                                            : 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/30 hover:bg-orange-50 dark:hover:bg-orange-900/10'
                                                        }
        `}
                                                >
                                                    <ShoppingCartIcon className="h-4 w-4" /> Carro Soldadura
                                                </button>
                                                <button
                                                    onClick={() => handleWarehouseChange('CARRO_SXP')}
                                                    className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border flex items-center gap-2
                                                ${activeWarehouse === 'CARRO_SXP'
                                                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-md transform scale-105 z-10'
                                                            : 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30 hover:bg-indigo-50 dark:hover:bg-indigo-900/10'
                                                        }
        `}
                                                >
                                                    <ShoppingCartIcon className="h-4 w-4" /> Carro SXP
                                                </button>
                                                <button
                                                    onClick={() => handleWarehouseChange('CARRO_RPL')}
                                                    className={`
        snap-start px-4 py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 border flex items-center gap-2
                                                ${activeWarehouse === 'CARRO_RPL'
                                                            ? 'bg-pink-600 text-white border-pink-700 shadow-md transform scale-105 z-10'
                                                            : 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800/30 hover:bg-pink-50 dark:hover:bg-pink-900/10'
                                                        }
        `}
                                                >
                                                    <ShoppingCartIcon className="h-4 w-4" /> Carro Rob. Plegado
                                                </button>
                                            </>
                                        )}
                                    </React.Fragment>
                                ))}
                                <div className="min-w-[1rem] h-1 flex-shrink-0"></div>
                            </div>

                            <button
                                onClick={() => scrollWarehouseList('right')}
                                className="absolute right-0 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hidden md:flex hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                aria-label="Scroll Right"
                            >
                                <ChevronRightIcon className="h-5 w-5" />
                            </button>
                        </div>
                    )}

                    {activeView === 'warehouse' && !['REP_SOL', 'CARRO_SOL', 'CARRO_SXP', 'CARRO_RPL'].includes(activeWarehouse) && (
                        <div className="bg-white dark:bg-slate-900/50 p-3 md:p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 md:space-y-4">
                            <div className="relative w-full">
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input type="text" placeholder="Buscar código..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-cyan-500 focus:ring-0 rounded-xl outline-none text-base" />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                                <button onClick={() => { setWorkflowMode('assign'); resetScanWorkflow(); setPhotoAnalyzerOpen(true); }} className="hidden md:flex w-full items-center justify-center gap-3 px-4 py-3 bg-cyan-600 text-white font-bold rounded-xl shadow hover:bg-cyan-500 transition-all">
                                    <CameraIcon className="h-5 w-5" />
                                    <span className="truncate">{canAssign() ? 'Asignar' : 'Buscar'}</span>
                                </button>

                                {/* Generic remove button, actual permission check is on specific location action */}
                                {(canRemove() || role === 'JEFE') && (
                                    <button onClick={handleInitiateRemoveWorkflow} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-all border border-red-200 dark:border-red-800">
                                        <TrashIcon className="h-5 w-5" /> <span className="truncate">Retirar</span>
                                    </button>
                                )}

                                {canAssign() && (
                                    <button onClick={() => { setWorkflowMode('assign'); setBatchScannerOpen(true); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white font-bold rounded-xl shadow hover:bg-slate-700 transition-all">
                                        <BatchScanIcon className="h-5 w-5" /> <span className="truncate">Lote</span>
                                    </button>
                                )}

                                {/* New Multi Location Button */}
                                {canAssign() && (
                                    <button
                                        onClick={handleInitiateMultiOccupancy}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-all border border-indigo-200 dark:border-indigo-800"
                                        title="Ocupar múltiples ubicaciones vacías"
                                    >
                                        <MultiLayerIcon className="h-5 w-5" /> <span className="truncate">Ocupar Varias</span>
                                    </button>
                                )}

                                {canRequestItems() && (
                                    <button onClick={handleInitiateRequestWorkflow} className="col-span-2 sm:col-span-1 w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-bold rounded-xl shadow hover:bg-purple-500 transition-all">
                                        <BellIcon className="h-5 w-5" /> <span className="truncate">Solicitar</span>
                                    </button>
                                )}

                                {canFinishProduction() && (
                                    <button onClick={handleInitiateFinishWorkflow} className="col-span-2 sm:col-span-1 w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow hover:bg-emerald-500 transition-all border border-emerald-700">
                                        <CheckIcon className="h-5 w-5" /> <span className="truncate">Finalizar</span>
                                    </button>
                                )}

                                {canExport() && (
                                    <button onClick={() => exportInventoryToExcel(assignments, config)} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all border border-emerald-200 dark:border-emerald-800" title="Exportar Inventario Excel">
                                        <DownloadIcon className="h-5 w-5" /> <span className="truncate">Excel</span>
                                    </button>
                                )}

                                <button onClick={() => { setWorkflowMode('assign'); setManualEntryOpen(true); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-all">
                                    # <span className="truncate">Manual</span>
                                </button>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center pt-1">
                                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer p-1">
                                    <input type="checkbox" checked={showEmptyOnly} onChange={e => setShowEmptyOnly(e.target.checked)} className="h-5 w-5 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300" />
                                    Mostrar solo huecos vacíos
                                </label>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    {canAnalyzeAnomalies() && (
                                        <>
                                            <GeminiButton onClick={() => gemini.runInventorySummary(assignments)} isLoading={gemini.isInventoryLoading} className="px-3 py-2 text-sm flex-1 sm:flex-none">
                                                <ChartIcon className="h-4 w-4" /> Resumen
                                            </GeminiButton>
                                            <GeminiButton onClick={() => gemini.runAnomalyDetection(assignments, history)} isLoading={gemini.isAnomalyLoading} className="px-3 py-2 text-sm flex-1 sm:flex-none">
                                                <SparklesIcon className="h-4 w-4" /> Anomalías
                                            </GeminiButton>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === 'warehouse' ? (
                        // Logic for rendering views based on selection
                        (() => {
                            switch (activeWarehouse) {
                                case 'REP_SOL':
                                    return <WeldingSuppliesView userRole={role!} />;
                                case 'CARRO_SOL':
                                    return <GenericSuppliesSection userRole={role!} title="Carro Soldadura" docId="CARRO_SOLDADURA" />;
                                case 'CARRO_SXP':
                                    return <GenericSuppliesSection userRole={role!} title="Carro SXP" docId="CARRO_SXP" totalShelves={4} />;
                                case 'CARRO_RPL':
                                    return <GenericSuppliesSection userRole={role!} title="Carro Rob. Plegado" docId="CARRO_ROB_PLEGADO" totalShelves={4} />;
                                default:
                                    return (
                                        <AssignmentList
                                            assignments={assignments}
                                            activeWarehouse={activeWarehouse as WarehouseCode}
                                            config={config}
                                            searchQuery={searchQuery}
                                            searchResults={searchResults}
                                            showEmptyOnly={showEmptyOnly}
                                            itemToCopy={itemToCopy}
                                            onInitiateCopy={handleInitiateCopy}
                                            onPasteItem={(loc) => itemToCopy && copyItem(itemToCopy.barcode, itemToCopy.fromLocation, loc, itemToCopy.orderId)}
                                            itemToMove={itemToMove}
                                            onInitiateMove={handleInitiateMove}
                                            onPasteMovedItem={handlePasteMovedItem}
                                            itemPendingDeletion={itemPendingDeletion}
                                            onInitiateDelete={handleInitiateDelete}
                                            onConfirmDelete={handleConfirmDelete}
                                            onCancelDelete={() => setItemPendingDeletion(null)}
                                            onInitiateEmptyShelf={() => { }}
                                            onInitiateValidationFlow={handleInitiateAdd}
                                            onDirectAssign={handleDirectAssign}
                                            onDirectRemove={handleDirectRemove}
                                            onViewLocationDetails={(locId) => {
                                                setSelectedMapLocation(locId);
                                                setShelfDetailMode('view'); // Default to view when opening via list
                                            }}
                                            onDragMove={handleDragMove}
                                            onInitiateRelocate={(loc) => { setRelocateSourceLoc(loc); setRelocateModalOpen(true); }}
                                            collapsedShelves={collapsedShelves[activeWarehouse] || {}}
                                            onToggleShelf={(shelfId: string) => toggleShelf(activeWarehouse, shelfId)}
                                            onToggleAllShelves={(collapsed: boolean) => toggleAllShelves(activeWarehouse, collapsed)}
                                            userRole={role}
                                            canAssign={canAssign}
                                            canRemove={canRemove}
                                            canRequestItems={canRequestItems}
                                            onInitiateRequest={handleInitiateRequest}
                                            workingItems={workingItems}
                                        />
                                    );
                            }
                        })()
                    ) : activeView === 'storage' ? (
                        <StorageView finishedItems={finishedItems} />
                    ) : activeView === 'working' ? (
                        <WorkingItemsList userRole={role!} />
                    ) : activeView === 'messages' ? (
                        <MessagesView currentUserRole={role!} currentUserUid={user.uid} />
                    ) : activeView === 'chapero' ? (
                        <ChaperoCountView />
                    ) : activeView === 'requests' && role === 'CARRETILLERO' ? (
                        <CarretilleroRequestsView onNavigateToLocation={(loc) => { setSelectedMapLocation(loc as LocationId); setActiveView('warehouse'); }} />
                    ) : (
                        <HistoryView history={history} onGenerateTraceabilityReport={(h) => gemini.runTraceabilityReport(h)} isTraceabilityLoading={gemini.isTraceabilityLoading} />
                    )}
                </main>
            </div>

            {/* MOBILE NAV */}
            <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around z-50 md:hidden safe-area-inset-bottom">
                <button
                    onClick={() => setActiveView('warehouse')}
                    className={`flex flex-col items-center justify-center w-full h-full ${activeView === 'warehouse' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'} `}
                >
                    <MapIcon className="h-6 w-6 mb-0.5" />
                    <span className="text-[10px] font-bold">Planta</span>
                </button>

                <button
                    onClick={() => setActiveView('storage')}
                    className={`flex flex-col items-center justify-center w-full h-full ${activeView === 'storage' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} `}
                >
                    <BoxIcon className="h-6 w-6 mb-0.5" />
                    <span className="text-[10px] font-bold">Almacén</span>
                </button>

                <button
                    onClick={() => setActiveView('working')}
                    className={`flex flex-col items-center justify-center w-full h-full ${activeView === 'working' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'} `}
                >
                    <FactoryIcon className="h-6 w-6 mb-0.5" />
                    <span className="text-[10px] font-bold">Proceso</span>
                </button>

                <button
                    onClick={() => setActiveView('history')}
                    className={`flex flex-col items-center justify-center w-full h-full ${activeView === 'history' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'} `}
                >
                    <HistoryIcon className="h-6 w-6 mb-0.5" />
                    <span className="text-[10px] font-bold">Historial</span>
                </button>

                <div className="relative -top-6">
                    <button
                        onClick={handleFabClick}
                        className="h-14 w-14 rounded-full bg-cyan-600 text-white shadow-lg flex items-center justify-center border-4 border-slate-50 dark:border-slate-950 active:scale-95 transition-transform"
                    >
                        <CameraIcon className="h-7 w-7" />
                    </button>
                </div>

                {canAccessChapero() ? (
                    <button
                        onClick={() => setActiveView('chapero')}
                        className={`flex flex-col items-center justify-center w-full h-full ${activeView === 'chapero' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400 dark:text-slate-500'} `}
                    >
                        <LayersIcon className="h-6 w-6 mb-0.5" />
                        <span className="text-[10px] font-bold">Chapero</span>
                    </button>
                ) : role === 'CARRETILLERO' ? (
                    <button
                        onClick={() => setActiveView('requests')}
                        className={`flex flex-col items-center justify-center w-full h-full relative ${activeView === 'requests' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'} `}
                    >
                        <BoxIcon className="h-6 w-6 mb-0.5" />
                        <span className="text-[10px] font-bold">Solicitudes</span>
                    </button>
                ) : (
                    <button
                        onClick={() => setActiveView('messages')}
                        className={`flex flex-col items-center justify-center w-full h-full ${activeView === 'messages' ? 'text-pink-600 dark:text-pink-400' : 'text-slate-400 dark:text-slate-500'} `}
                    >
                        <MessageSquareIcon className="h-6 w-6 mb-0.5" />
                        <span className="text-[10px] font-bold">Chat</span>
                    </button>
                )}
            </nav>

            {/* MODALS */}
            <Suspense fallback={<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20"><LoadingIcon className="h-10 w-10 text-cyan-500" /></div>}>

                {/* CONFIRMATION MODALS */}
                {moveConfirmationData && <MoveConfirmationModal item={moveConfirmationData} onConfirm={handleConfirmMove} onCancel={() => setMoveConfirmationData(null)} />}
                {removeConfirmationData && <RemoveConfirmationModal item={removeConfirmationData} onConfirm={handleConfirmRemove} onCancel={() => setRemoveConfirmationData(null)} />}
                {requestConfirmationData && <RequestConfirmationModal item={requestConfirmationData} onConfirm={handleConfirmRequest} onCancel={() => setRequestConfirmationData(null)} />}
                {processFinishedData && <ProcessFinishedModal item={processFinishedData} onConfirm={handleConfirmProcessFinish} onCancel={() => setProcessFinishedData(null)} />}

                {/* NEW OCCUPIED LOCATION MODAL */}
                {occupiedLocationData && (
                    <OccupiedLocationModal
                        locationId={occupiedLocationData.locationId}
                        existingItems={assignments[occupiedLocationData.locationId] || []}
                        onConfirm={handleConfirmOccupiedAssignment}
                        onCancel={() => setOccupiedLocationData(null)}
                    />
                )}

                {duplicateItemData && (
                    <DuplicateItemModal
                        item={duplicateItemData}
                        onMove={handleDuplicateMove}
                        onAdd={handleDuplicateAdd}
                        onCancel={() => setDuplicateItemData(null)}
                    />
                )}

                {removeConfirmationData && (
                    <Suspense fallback={null}>
                        <RemoveConfirmationModal
                            item={removeConfirmationData}
                            onConfirm={handleConfirmRemove}
                            onCancel={() => { setRemoveConfirmationData(null); resetScanWorkflow(); }}
                            onWithdraw={async () => {
                                if (!removeConfirmationData) return;
                                const { barcode, location, orderId } = removeConfirmationData;
                                const success = await withdrawItem(barcode, location as LocationId, orderId);
                                if (success) {
                                    setRemoveConfirmationData(null);
                                    resetScanWorkflow();
                                }
                            }}
                        />
                    </Suspense>
                )}
                {isRequestReviewOpen && (
                    <RequestReviewModal
                        items={batchItems}
                        onConfirm={handleConfirmBatchRequest}
                        onClose={() => setRequestReviewOpen(false)}
                        onRemoveItem={(index) => setBatchItems(prev => prev.filter((_, i) => i !== index))}
                    />
                )}

                {(addItemTarget || inputMethodModal) && !isPhotoAnalyzerOpen && !isManualEntryOpen && !moveConfirmationData && !isLocationCaptureOpen && (
                    <AddMethodModal
                        title={inputMethodModal?.title || 'Añadir Artículo'}
                        subtitle={inputMethodModal?.subtitle || (addItemTarget ? formatLocation(addItemTarget) : undefined)}
                        onSelectManual={() => {
                            handleSelectManualAdd();
                            setInputMethodModal(null);
                        }}
                        onSelectPhoto={() => {
                            handleSelectPhotoAdd();
                            setInputMethodModal(null);
                        }}
                        onClose={() => {
                            setAddItemTarget(null);
                            setInputMethodModal(null);
                        }}
                    />
                )}

                {isScannerOpen && (
                    <Scanner
                        onScan={handleWorkflowScan}
                        onClose={() => setScannerOpen(false)}
                        instruction="Escáner Básico"
                    />
                )}

                {isPhotoAnalyzerOpen && (
                    <PhotoAnalyzerModal
                        onCodeExtracted={handlePhotoAnalysisResult}
                        onClose={() => {
                            setPhotoAnalyzerOpen(false);
                            // Cancel whole flow if closed without result
                            if (multiSelectedLocations.length > 0) {
                                resetScanWorkflow();
                            }
                            if (addItemTarget) setAddItemTarget(null);
                            if (inputMethodModal) setInputMethodModal(null);
                        }}
                        onRequestManual={() => {
                            setPhotoAnalyzerOpen(false);
                            setManualEntryOpen(true);
                        }}
                        instruction={multiSelectedLocations.length > 0 ? "Etiqueta Artículo/Palet (Art + OF)" : (workflowMode === 'finish' ? "Foto para Finalizar: Art + OF" : "Etiqueta: Artículo + OF")}
                        mode="combined"
                    />
                )}

                {isLocationCaptureOpen && (
                    <PhotoAnalyzerModal
                        onCodeExtracted={handleLocationCaptureResult}
                        onClose={() => {
                            setLocationCaptureOpen(false);
                            resetScanWorkflow();
                        }}
                        instruction={batchItems.length > 0 ? `Ubicación para ${batchItems.length} items` : "Foto al Cartel de Ubicación"}
                        mode="single"
                    />
                )}

                {isManualEntryOpen && (
                    <ManualEntryModal
                        onSubmit={handlePhotoAnalysisResult}
                        onClose={() => {
                            setManualEntryOpen(false);
                            if (multiSelectedLocations.length > 0) resetScanWorkflow();
                            if (addItemTarget) setAddItemTarget(null);
                            if (inputMethodModal) setInputMethodModal(null);
                        }}
                        isFreeTextMode={isFreeTextTarget}
                    />
                )}

                {isValidationScannerOpen && pendingAssignment?.location && (
                    <ValidationScanner
                        targetLocation={pendingAssignment.location}
                        onSuccess={handleValidationSuccess}
                        onClose={() => { setValidationScannerOpen(false); resetScanWorkflow(); }}
                    />
                )}

                {isBatchScannerOpen && (
                    <BatchScanner
                        onComplete={handleBatchScanComplete}
                        onClose={() => { setBatchScannerOpen(false); }}
                        mode={workflowMode === 'request' ? 'request' : 'assign'}
                    />
                )}

                {isBatchAssignmentOpen && (
                    <BatchAssignmentModal
                        items={batchItems}
                        onAssignBatch={handleBatchAssignmentMap}
                        onClose={() => setBatchAssignmentOpen(false)}
                        assignments={assignments}
                        config={config}
                    />
                )}

                {isMultiLocationSelectorOpen && (
                    <MultiLocationSelector
                        isOpen={true}
                        onClose={() => setMultiLocationSelectorOpen(false)}
                        onConfirm={handleMultiLocationSelectionConfirm}
                        assignments={assignments}
                        config={config}
                    />
                )}

                {isAssignmentModalOpen && ((pendingAssignment && !moveConfirmationData) || (multiSelectedLocations.length > 0)) && canAssign() && (
                    <AssignmentModal
                        barcode={pendingAssignment?.article || ''}
                        orderId={pendingAssignment?.order || ''}
                        onAssign={handleAssignmentModalConfirm}
                        onClose={() => { setIsAssignmentModalOpen(false); }}
                        onScanRequest={() => setScannerOpen(true)}
                        onFinishProduction={handleFinishProduction}
                        assignments={assignments}
                        config={config}
                        isBatchMode={false} // Cleaned up
                    />
                )}

                {isMoveModalOpen && itemToMove && canAssign() && (
                    <MoveItemModal
                        item={itemToMove}
                        onMove={handleMoveModalConfirm}
                        onClose={() => { setMoveModalOpen(false); setItemToMove(null); }}
                        config={config}
                        assignments={assignments}
                    />
                )}

                {isAdminPanelOpen && (role === 'ADMIN' || role === 'JEFE') && (
                    <AdminPanel
                        currentUserRole={role}
                        config={config}
                        setConfig={setConfig}
                        onClose={() => setAdminPanelOpen(false)}
                        assignments={assignments}
                        setAssignments={setAssignments}
                        history={history}
                        setHistory={setHistory}
                        {...configActions}
                        onRunInventoryAnalysis={() => gemini.runInventorySummary(assignments)}
                        onRunAnomalyAnalysis={() => gemini.runAnomalyDetection(assignments, history)}
                    />
                )}

                {isRelocateModalOpen && relocateSourceLoc && (
                    <RelocateLocationModal
                        sourceLocationId={relocateSourceLoc}
                        onRelocate={async (targetLoc) => {
                            await relocateLocationContents(relocateSourceLoc, targetLoc);
                            setRelocateModalOpen(false);
                            setRelocateSourceLoc(null);
                        }}
                        onClose={() => {
                            setRelocateModalOpen(false);
                            setRelocateSourceLoc(null);
                        }}
                        assignments={assignments}
                        config={config} />
                )}

                {isUserProfileOpen && (
                    <UserProfileModal
                        onClose={() => setUserProfileOpen(false)}
                        currentRole={role!}
                        onRoleChange={() => { }}
                    />
                )}

                {selectedMapLocation && (() => {
                    const isPlegadoCart = selectedMapLocation.includes('PLE C1') || selectedMapLocation.includes('PLE C2');

                    if (isPlegadoCart) {
                        // Special Adaptor for Plegado Carts using ShelfDetailModal
                        const cartName = selectedMapLocation.includes('PLE C1') ? 'Carro 1' : 'Carro 2';
                        // Extract shelf number from PLE C1-X -> returns X
                        const shelfNum = selectedMapLocation.split('C')[1].split('-')[1];
                        const shelfLabel = `Balda ${shelfNum} `;

                        // Adapt existing assignments to ShelfDetailModal format
                        const items = (assignments[selectedMapLocation] || []).map(item => ({
                            id: `${item.barcode} -${item.orderId} `,
                            shelfId: shelfNum,
                            type: item.orderId === 'GENERAL' ? 'plain' : 'article' as const,
                            description: item.orderId === 'GENERAL' ? item.barcode : `ART: ${item.barcode} | OF: ${item.orderId} `,
                            barcode: item.barcode,
                            orderId: item.orderId,
                            addedBy: 'user', // Placeholder
                            createdAt: item.timestamp
                        }));

                        const handleAddAdapted = async (type: 'article' | 'plain', data: any) => {
                            if (type === 'article') {
                                const { barcode, orderId } = data;
                                assignItem(barcode, orderId, selectedMapLocation, { allowMultiLocation: true });
                                notify('success', 'Añadido', `${barcode} añadido al carro.`);
                            } else {
                                // Plain text -> saved as Barcode with OrderId 'GENERAL'
                                const text = data.description.toUpperCase();
                                assignItem(text, 'GENERAL', selectedMapLocation, { allowMultiLocation: true });
                                notify('success', 'Nota Añadida', `Nota añadida al carro.`);
                            }
                        };

                        const handleRemoveAdapted = async (ids: string[]) => {
                            // Reverse map ids to barcode/order pairs
                            const itemsToRemove = (assignments[selectedMapLocation] || []).filter(item =>
                                ids.includes(`${item.barcode} -${item.orderId} `)
                            );

                            for (const item of itemsToRemove) {
                                removeItem(item.barcode, selectedMapLocation, item.orderId);
                            }
                            notify('success', 'Eliminado', `${itemsToRemove.length} elementos retirados.`);
                        };

                        // ShelfDetailModal doesn't support moving internally in this context easily, 
                        // or we map it to standard move logic if needed. 
                        // For now we implement basic move as "Do nothing" or standard move logic interception.
                        // Standard modal doesn't use onMoveItems for standard assignments usually, but let's see.
                        // Actually ShelfDetailModal expects onMoveItems to move within the cart specific shelves.
                        // We can support moving between shelves of the SAME cart.
                        const handleMoveAdapted = async (ids: string[], targetShelf: string) => {
                            // Construct target location ID: PLE C1-targetShelf
                            // Current: PLE-E1-B1-PLE C1-1
                            // Target: PLE-E1-B1-PLE C1-{targetShelf}
                            const base = selectedMapLocation.split('-').slice(0, -1).join('-'); // PLE-E1-B1-PLE C1
                            // Wait, selectedMapLocation is full ID: "PLE-E1-B1-PLE C1-5" (example)
                            // Logic in App.tsx line 746: matchLocation = `PLE - E1 - B1 - PLE C1 - ${ matchedNumber } `
                            // So we need to reconstruct perfectly.

                            const part1 = selectedMapLocation.substring(0, selectedMapLocation.lastIndexOf('-')); // PLE-E1-B1-PLE C1
                            const targetLocId = `${part1} -${targetShelf} ` as LocationId;

                            const itemsToMove = (assignments[selectedMapLocation] || []).filter(item =>
                                ids.includes(`${item.barcode} -${item.orderId} `)
                            );

                            for (const item of itemsToMove) {
                                // Move item: remove from source, add to target
                                // Use moveItem from hooks if possible, or manual remove+add
                                // checkLocationAndAssign handles 'move' logic if we used that.
                                // But here we want direct action.
                                // Let's use checkLocationAndAssign(barcode, orderId, targetLoc, 'move') wrapper?
                                // Or just call assignments update.
                                // App.tsx has checkLocationAndAssign available in scope? Yes.

                                checkLocationAndAssign(item.barcode, item.orderId, targetLocId, 'move');
                            }
                        };

                        return (
                            <ShelfDetailModal
                                cartName={cartName}
                                shelfId={shelfNum}
                                shelfLabel={shelfLabel}
                                items={items}
                                onClose={() => setSelectedMapLocation(null)}
                                onAddItem={handleAddAdapted}
                                onRemoveItems={handleRemoveAdapted}
                                onMoveItems={handleMoveAdapted}
                                availableShelves={[1, 2, 3, 4]}
                                userRole={role!}
                                initialMode={shelfDetailMode}
                            />
                        );
                    }

                    return (
                        <LocationDetailModal
                            locationId={selectedMapLocation}
                            assignments={assignments}
                            onClose={() => setSelectedMapLocation(null)}
                            onInitiateCopy={(barcode, loc, oid) => handleInitiateCopy(barcode, loc, oid)}
                            onInitiateMove={(barcode, loc, oid) => handleInitiateMove(barcode, loc, oid)}
                            onInitiateDelete={(barcode, loc, oid) => handleInitiateDelete(barcode, loc, oid)}
                            onInitiateAdd={handleInitiateAdd}
                            onPasteItem={() => itemToCopy && copyItem(itemToCopy.barcode, itemToCopy.fromLocation, selectedMapLocation, itemToCopy.orderId)}
                            onPasteMovedItem={() => handlePasteMovedItem(selectedMapLocation)}
                            canPasteCopy={!!itemToCopy && itemToCopy.fromLocation !== selectedMapLocation}
                            canPasteMove={!!itemToMove && itemToMove.fromLocation !== selectedMapLocation}
                        />
                    );
                })()}

                {gemini.modalState.isOpen && gemini.modalState.structuredReport && (
                    <AnomalyReportModal
                        isOpen={true}
                        onClose={gemini.closeModal}
                        report={gemini.modalState.structuredReport}
                    />
                )}

                {gemini.modalState.isOpen && !gemini.modalState.structuredReport && (
                    <GeminiResponseModal
                        isOpen={true}
                        onClose={gemini.closeModal}
                        title={gemini.modalState.title}
                        content={gemini.modalState.content}
                        isLoading={gemini.modalState.isLoading}
                        isError={gemini.modalState.isError}
                    />
                )}
                {isEmptyLocationsModalOpen && (
                    <EmptyLocationsModal
                        isOpen={isEmptyLocationsModalOpen}
                        onClose={() => setIsEmptyLocationsModalOpen(false)}
                        activeWarehouseId={activeWarehouse}
                        assignments={assignments}
                        onConfirm={async (ids) => {
                            await adminClearLocations(ids);
                            setIsEmptyLocationsModalOpen(false);
                        }}
                    />
                )}
                {isPackageTypeModalOpen && (
                    <PackageTypeModal
                        onSelect={handlePackageTypeSelect}
                        onClose={() => {
                            setPackageTypeModalOpen(false);
                            setPendingPackageTypeData(null);
                            resetScanWorkflow();
                        }}
                    />
                )}
            </Suspense>
        </>
    );
};

export default App;

