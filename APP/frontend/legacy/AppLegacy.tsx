
import React, { useState, useCallback, useMemo, Suspense, useRef, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import WarehouseRoute from '../components/Routes/WarehouseRoute';
import { LocationId, WarehouseCode, HistoryEntry, formatLocation, PackageType } from '../lib/warehouseData';
import { CartItem } from '../hooks/useCarts';
import { validateCode } from '../lib/codeValidation';
import firebase from 'firebase/compat/app';
import { auth } from './firebaseCompat';
import { Activity } from 'lucide-react';
import { LeadTimeModal } from '../components/modals/LeadTimeModal';

// Components - Critical Path (Eager Load)
import LoginScreen from '../components/auth/LoginScreen';
import AssignmentList from './components/AssignmentList';
import Scanner from '../components/scanner/Scanner';
import SyncStatus from '../components/common/SyncStatus';
import HistoryView from '../components/views/HistoryView';
import StorageView from '../components/shelf/StorageView';
import WorkingItemsList from './components/WorkingItemsList';
import NotificationToast, { Notification, NotificationType } from '../components/common/NotificationToast';
import { MessagesView } from '../components/views/MessagesView';
import ForkliftBanner from '../components/common/ForkliftBanner';
import WeldingSuppliesView from '../components/views/WeldingSuppliesView';
import GenericSuppliesSection from '../components/views/GenericSuppliesSection';
import { LogoIcon, HistoryIcon, CloseIcon, SettingsIcon, UserIcon, CheckIcon, CameraIcon, SearchIcon, LoadingIcon, BellIcon, TrashIcon, MapIcon, ListIcon, BoxIcon, ChevronLeftIcon, ChevronRightIcon, MultiLayerIcon, DownloadIcon, ChartIcon, LogOutIcon, ErrorIcon, MessageSquareIcon, ShoppingCartIcon, LayersIcon, FactoryIcon } from '../icons/Icons';
import { WarehouseHeader } from './components/WarehouseHeader';

// Components - Lazy Load (Optimization)
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const ChaperoCountView = React.lazy(() => import('./components/ChaperoCountView'));
const CarretilleroRequestsView = React.lazy(() => import('../components/CarretilleroRequestsView'));
import { AppModals } from './components/AppModals';
import { WarehousePage } from '../components/Pages/WarehousePage';
import { useAppLogic } from '../hooks/useAppLogic';

// Hooks
import { useAssignments } from '../hooks/useAssignments';
import { useHistory } from '../hooks/useHistory';
import { useStorage } from '../hooks/useStorage';
import { useInventoryOperations } from '../hooks/useInventoryOperations';
import { useIndexing } from '../hooks/useIndexing';
import { useWarehouseConfig } from '../hooks/useWarehouseConfig';
import { useRoles, UserRole } from '../hooks/useRoles';
import { useSystemNotifications } from '../hooks/useSystemNotifications';
import { exportInventoryToExcel } from '../lib/excelExport';
import { useAppStore, WorkflowMode } from '../lib/store';
import MainLayout from '../components/Layout/MainLayout';
import { useInventoryWorkflows } from '../hooks/useInventoryWorkflows';
import { useWorkingItems } from '../hooks/useWorkingItems';
import { MigrationSolLocation } from '../components/views/MigrationSolLocation';

const App: React.FC = () => {
    const [user, setUser] = useState<firebase.User | null>(null);
    const [initializingAuth, setInitializingAuth] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    const {
        activeWarehouse, setActiveWarehouse,
        notifications, notify, closeNotification,
        workflowMode, setWorkflowMode,
        searchQuery, setSearchQuery,
        showEmptyOnly, setShowEmptyOnly,
        modals, setModal, closeAllModals,
        pendingAssignment, setPendingAssignment,
        batchItems, setBatchItems,
        collapsedShelves, toggleShelf, toggleAllShelves
    } = useAppStore();

    const handleWarehouseChange = (code: string) => {
        setActiveWarehouse(code);
    };

    // Firebase Auth Listener
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
            setUser(firebaseUser);
            setInitializingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await auth.signOut();
            setUser(null);
            navigate('/');
        } catch (error) {
            console.error("Error signing out:", error);
            notify('error', "Error al cerrar sesión", "Ocurrió un error inesperado.");
        }
    };

    const { assignments, setAssignments, syncAssignments, loading: assignmentsLoading, error: assignmentsError } = useAssignments(activeWarehouse);
    const { history, setHistory, addHistoryEntry, syncHistory, loading: historyLoading, error: historyError } = useHistory();
    const { finishedItems, addFinishedItem, syncFinishedItems } = useStorage();
    const { searchAssignments } = useIndexing(assignments, history);
    const searchResults = useMemo(() => searchAssignments(searchQuery), [searchAssignments, searchQuery]);
    const { config, setConfig, ...configActions } = useWarehouseConfig(assignments);
    const configLoading = configActions.loading;
    const configError = configActions.error;

    const globalError = assignmentsError || historyError || configError;

    const handleSyncData = async () => {
        try {
            await Promise.all([syncAssignments(), syncHistory(), syncFinishedItems()]);
            notify('success', "Datos sincronizados correctamente", "Base de datos local actualizada.");
        } catch (error) {
            console.error("Error syncing data:", error);
            notify('error', "Error al sincronizar datos", "No se pudieron obtener los datos remotos.");
        }
    };

    // Role Management
    const { role, section, loading: roleLoading, canEditStructure, canAnalyzeAnomalies, canAssign, canRemove, canRequestItems, shouldSkipValidation, canExport, canFinishProduction, canAccessChapero } = useRoles(user?.uid);

    useEffect(() => {
        if (location.pathname !== '/' && !location.pathname.startsWith('/warehouse')) return;

        const params = new URLSearchParams(location.search);
        const requestedView = params.get('view');

        if (requestedView === 'requests' && role === 'CARRETILLERO') {
            navigate('/requests', { replace: true });
        }
    }, [location.pathname, location.search, role, navigate]);

    // System Notifications Hook & Forklift Banner Data
    const { sendSystemAlert, unreadRequestsCount } = useSystemNotifications(role, notify);

    const { assignItem, requestItem, removeItem, moveItem, copyItem, relocateLocationContents, emptyShelf, batchAssign, batchAssignToSingleLocation, batchAssignToMultipleLocations, findItemLocation, adminClearLocations, withdrawItem, notifyFinishedItem } = useInventoryOperations(assignments, setAssignments, addHistoryEntry, notify, sendSystemAlert, user?.email || undefined);

    const { processScanInput: processWorkflowScanInput } = useInventoryWorkflows(
        {},
        assignments,
        notify,
        findItemLocation
    );

    const {
        // State
        multiSelectedLocations, setMultiSelectedLocations,
        relocateSourceLoc, setRelocateSourceLoc,
        pendingPackageTypeData, setPendingPackageTypeData,
        itemToCopy, setItemToCopy,
        itemToMove, setItemToMove,
        itemPendingDeletion, setItemPendingDeletion,
        addItemTarget, setAddItemTarget,
        inputMethodModal, setInputMethodModal,
        selectedMapLocation, setSelectedMapLocation,
        shelfDetailMode, setShelfDetailMode,
        moveConfirmationData, setMoveConfirmationData,
        removeConfirmationData, setRemoveConfirmationData,
        requestConfirmationData, setRequestConfirmationData,
        processFinishedData, setProcessFinishedData,
        duplicateItemData, setDuplicateItemData,
        occupiedLocationData, setOccupiedLocationData,

        // Handlers
        handleInitiateRemoveWorkflow,
        handleInitiateRequestWorkflow,
        handleInitiateFinishWorkflow,
        handleInitiateMultiOccupancy,
        handleMultiLocationSelectionConfirm,
        checkLocationAndAssign,
        handleConfirmMove,
        handleConfirmRemove,
        handleConfirmProcessFinish,
        handleConfirmBatchRequest,
        handleDuplicateMove,
        handleDuplicateAdd,
        handleConfirmOccupiedAssignment,
        handleDirectAssign,
        handleDirectRemove,
        handlePackageTypeSelect,
        handlePhotoAnalysisResult,
        handleLocationCaptureResult,
        handleWorkflowScan,
        handleAssignmentModalConfirm,
        handleValidationSuccess,
        handleBatchScanComplete,
        handleBatchAssignmentMap,
        handleInitiateAdd,
        resetScanWorkflow,
        handleSelectManualAdd,
        handleSelectPhotoAdd,
        handleFabClick,
        handleInitiateCopy,
        handleInitiateMove,
        handlePasteMovedItem,
        handleDragMove,
        handleMoveItemModalConfirm: handleMoveModalConfirm,
        handleInitiateDelete,
        handlePendingDeleteConfirm: handleConfirmDelete,
        handleFinishProduction,
        handleInitiateRequest,
        handleConfirmRequest,
        handleInitiateRelocate,
        handleRelocate
    } = useAppLogic({
        role,
        assignments,
        setAssignments,
        addHistoryEntry,
        addFinishedItem,
        notify,
        assignItem,
        requestItem,
        removeItem,
        findItemLocation,
        batchAssignToSingleLocation,
        canAssign,
        canRemove,
        canRequestItems,
        canFinishProduction,
        relocateLocationContents,
        shouldSkipValidation,
        processScanInput: processWorkflowScanInput,
        withdrawItem
    });

    const handleTabChange = (code: string) => {
        setActiveWarehouse(code);
        navigate(`/warehouse/${code}`);
    };

    const handleNavigateToRequestLocation = useCallback((locationId: string) => {
        if (!locationId || !locationId.includes('-')) return;

        const warehouseCode = locationId.split('-')[0] as WarehouseCode;
        setActiveWarehouse(warehouseCode);
        setSelectedMapLocation(locationId as LocationId);
        navigate(`/warehouse/${warehouseCode}`);
    }, [navigate, setActiveWarehouse, setSelectedMapLocation]);

    const { workingItems } = useWorkingItems();

    if (initializingAuth || roleLoading || assignmentsLoading || configLoading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
                <LoadingIcon className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                <p className="text-slate-600 dark:text-slate-400 font-medium animate-pulse">Cargando aplicación...</p>
            </div>
        );
    }

    if (!user) {
        return <LoginScreen onSuccess={() => notify('success', "Bienvenido", "Has iniciado sesión correctamente.")} />;
    }

    return (
        <>
            <MainLayout
                user={user}
                role={role}
                section={section}
                unreadRequestsCount={unreadRequestsCount}
                handleLogout={handleLogout}
                handleSyncData={handleSyncData}
                canAccessChapero={canAccessChapero}
            >
                <div className="w-full max-w-[1600px] md:mx-auto space-y-6 min-w-0">
                    {/* Global Error Banner */}
                    {globalError && (
                        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-3">
                            <ErrorIcon className="h-6 w-6" />
                            <p className="font-bold">Error cargando datos. Inténtalo de nuevo o revisa tu conexión.</p>
                        </div>
                    )}

                    <Routes>
                        <Route path="/" element={<Navigate to={`/warehouse/${activeWarehouse || 'MEC'}`} replace />} />

                        <Route path="/warehouse/:code" element={
                            <WarehousePage
                                activeWarehouse={activeWarehouse}
                                config={config}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                handleTabChange={handleTabChange}
                                role={role}
                                showEmptyOnly={showEmptyOnly}
                                setShowEmptyOnly={setShowEmptyOnly}
                                assignments={assignments}
                                history={history}
                                searchResults={searchResults}
                                itemToCopy={itemToCopy}
                                itemToMove={itemToMove}
                                itemPendingDeletion={itemPendingDeletion}
                                setItemPendingDeletion={setItemPendingDeletion}
                                workingItems={workingItems}
                                collapsedShelves={collapsedShelves}
                                toggleShelf={toggleShelf}
                                toggleAllShelves={toggleAllShelves}
                                canAssign={canAssign}
                                canRemove={canRemove}
                                canRequestItems={canRequestItems}
                                canFinishProduction={canFinishProduction}
                                canExport={canExport}
                                canAnalyzeAnomalies={canAnalyzeAnomalies}
                                setWorkflowMode={setWorkflowMode}
                                resetScanWorkflow={resetScanWorkflow}
                                setModal={setModal}
                                handleInitiateRemoveWorkflow={handleInitiateRemoveWorkflow}
                                handleInitiateMultiOccupancy={handleInitiateMultiOccupancy}
                                handleInitiateRequestWorkflow={handleInitiateRequestWorkflow}
                                handleInitiateFinishWorkflow={handleInitiateFinishWorkflow}
                                exportInventoryToExcel={() => exportInventoryToExcel(assignments, config)}
                                handleInitiateCopy={handleInitiateCopy}
                                handleInitiateMove={handleInitiateMove}
                                handleInitiateDelete={handleInitiateDelete}
                                handleInitiateAdd={handleInitiateAdd}
                                handlePasteMovedItem={handlePasteMovedItem}
                                handleDirectAssign={handleDirectAssign}
                                handleDirectRemove={handleConfirmRemove}
                                handleConfirmDelete={handleConfirmDelete}
                                handleDragMove={handleDragMove}
                                handleInitiateRequest={handleInitiateRequest}
                                handleInitiateRelocate={handleInitiateRelocate}
                                handleInitiateEmptyShelf={emptyShelf}
                                onNotifyFinishedItem={notifyFinishedItem}
                                removeItem={removeItem}
                                assignItem={assignItem}
                                copyItem={copyItem}
                                notify={notify}
                                formatLocation={formatLocation}
                                selectedMapLocation={selectedMapLocation}
                                setSelectedMapLocation={setSelectedMapLocation}
                                setShelfDetailMode={setShelfDetailMode}
                                setRelocateSourceLoc={setRelocateSourceLoc}
                                onRefresh={handleSyncData}
                            />
                        } />

                        <Route path="/storage" element={<StorageView finishedItems={finishedItems} />} />
                        <Route path="/working" element={<WorkingItemsList userRole={role!} notifyFinishedItem={notifyFinishedItem} />} />
                        <Route path="/messages" element={<MessagesView currentUserRole={role!} currentUserUid={user.uid} />} />
                        <Route path="/chapero" element={<ChaperoCountView />} />
                        <Route path="/history" element={<HistoryView history={history} />} />
                        <Route path="/requests" element={role === 'CARRETILLERO' ? <CarretilleroRequestsView onNavigateToLocation={handleNavigateToRequestLocation} /> : <Navigate to="/" />} />

                        <Route path="*" element={<Navigate to={`/warehouse/${activeWarehouse || 'MEC'}`} replace />} />
                    </Routes>
                </div>
            </MainLayout>

            {/* MODALS */}
            <AppModals
                activeWarehouse={activeWarehouse}
                modals={modals}
                setModal={setModal}
                workflowMode={workflowMode}
                role={role}
                config={config}
                setConfig={setConfig}
                assignments={assignments}
                setAssignments={setAssignments}
                history={history}
                setHistory={setHistory}
                configActions={configActions}

                // States
                moveConfirmationData={moveConfirmationData}
                removeConfirmationData={removeConfirmationData}
                requestConfirmationData={requestConfirmationData}
                processFinishedData={processFinishedData}
                occupiedLocationData={occupiedLocationData}
                duplicateItemData={duplicateItemData}
                batchItems={batchItems}
                pendingAssignment={pendingAssignment}
                itemToMove={itemToMove}
                itemToCopy={itemToCopy}
                addItemTarget={addItemTarget}
                inputMethodModal={inputMethodModal}
                selectedMapLocation={selectedMapLocation}
                relocateSourceLoc={relocateSourceLoc}
                multiSelectedLocations={multiSelectedLocations}

                // Setters
                setMoveConfirmationData={setMoveConfirmationData}
                setRemoveConfirmationData={setRemoveConfirmationData}
                setRequestConfirmationData={setRequestConfirmationData}
                setProcessFinishedData={setProcessFinishedData}
                setOccupiedLocationData={setOccupiedLocationData}
                setDuplicateItemData={setDuplicateItemData}
                setBatchItems={setBatchItems}
                setPendingAssignment={setPendingAssignment}
                setItemToMove={setItemToMove}
                setItemToCopy={setItemToCopy}
                setAddItemTarget={setAddItemTarget}
                setInputMethodModal={setInputMethodModal}
                setSelectedMapLocation={setSelectedMapLocation}
                setPendingPackageTypeData={setPendingPackageTypeData}
                setShelfDetailMode={setShelfDetailMode}
                shelfDetailMode={shelfDetailMode}

                // Handlers
                handleConfirmMove={handleConfirmMove}
                handleConfirmRemove={handleConfirmRemove}
                handleConfirmRequest={handleConfirmRequest}
                handleConfirmProcessFinish={handleConfirmProcessFinish}
                handleConfirmOccupiedAssignment={handleConfirmOccupiedAssignment}
                handleDuplicateMove={handleDuplicateMove}
                handleDuplicateAdd={handleDuplicateAdd}
                withdrawItem={withdrawItem}
                handleConfirmBatchRequest={handleConfirmBatchRequest}
                handleSelectManualAdd={handleSelectManualAdd}
                handleSelectPhotoAdd={handleSelectPhotoAdd}
                handleWorkflowScan={handleWorkflowScan}
                handlePhotoAnalysisResult={handlePhotoAnalysisResult}
                handleLocationCaptureResult={handleLocationCaptureResult}
                resetScanWorkflow={resetScanWorkflow}
                handleValidationSuccess={handleValidationSuccess}
                handleBatchScanComplete={handleBatchScanComplete}
                handleBatchAssignmentMap={handleBatchAssignmentMap}
                handleMultiLocationSelectionConfirm={handleMultiLocationSelectionConfirm}
                handleAssignmentModalConfirm={handleAssignmentModalConfirm}
                handleFinishProduction={handleFinishProduction}
                handleMoveModalConfirm={handleMoveModalConfirm}
                handleInitiateDelete={handleInitiateDelete}
                handlePendingDeleteConfirm={handleConfirmDelete}
                handleRelocate={handleRelocate}

                // Actions
                handleInitiateCopy={handleInitiateCopy}
                handleInitiateMove={handleInitiateMove}
                handleInitiateAdd={handleInitiateAdd}
                handlePasteMovedItem={handlePasteMovedItem}
                checkLocationAndAssign={checkLocationAndAssign}
                copyItem={copyItem}
                removeItem={removeItem}
                assignItem={assignItem}
                notify={notify}
                formatLocation={formatLocation}
                confirmEmptyLocations={async (ids) => {
                    await adminClearLocations(ids);
                    setModal('emptyLocations', false);
                }}
                handlePackageTypeSelect={handlePackageTypeSelect}
                canAssign={canAssign}
            />
        </>
    );
};

export default App;





