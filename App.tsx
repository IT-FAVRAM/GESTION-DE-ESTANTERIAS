


import React, { useState, useCallback, useMemo, Suspense, useRef, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import WarehouseRoute from './components/Routes/WarehouseRoute';
import { LocationId, WarehouseCode, HistoryEntry, formatLocation, PackageType } from './lib/warehouseData';
import { CartItem } from './hooks/useCarts';
import { validateCode } from './lib/codeValidation';
import firebase from 'firebase/compat/app';
import { auth } from './lib/firebase';
import { Activity } from 'lucide-react';
import { LeadTimeModal } from './components/LeadTimeModal';

// Components - Critical Path (Eager Load)
import LoginScreen from './components/LoginScreen';
import AssignmentList from './components/AssignmentList';
import Scanner from './components/Scanner';
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
import { LogoIcon, HistoryIcon, CloseIcon, SettingsIcon, UserIcon, CheckIcon, CameraIcon, SearchIcon, LoadingIcon, BellIcon, TrashIcon, MapIcon, ListIcon, BoxIcon, ChevronLeftIcon, ChevronRightIcon, MultiLayerIcon, DownloadIcon, ChartIcon, LogOutIcon, ErrorIcon, MessageSquareIcon, ShoppingCartIcon, LayersIcon, FactoryIcon } from './components/Icons';
import { WarehouseHeader } from './components/WarehouseHeader';

// Components - Lazy Load (Optimization)
const AdminPanel = React.lazy(() => import('./components/AdminPanel')); // Kept as it is used? No, moved to AppModals
// Actually I should remove ALL the Modal lazy imports from here
// Keeping Views:
// const LandingScreen = ...
const ChaperoCountView = React.lazy(() => import('./components/ChaperoCountView'));
// EmptyLocationsModal moved
const CarretilleroRequestsView = React.lazy(() => import('./components/CarretilleroRequestsView'));
import { AppModals } from './components/AppModals';
import { WarehousePage } from './components/Pages/WarehousePage';
import { useAppLogic } from './hooks/useAppLogic';

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
import { useAppStore, WorkflowMode } from './lib/store';
import MainLayout from './components/Layout/MainLayout';
import { useInventoryWorkflows } from './hooks/useInventoryWorkflows';
import { MigrationSolLocation } from './components/MigrationSolLocation';



export interface BatchItem {
    article: string;
    order: string;
}

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

    const { assignments, setAssignments, syncAssignments, loading: assignmentsLoading, error: assignmentsError } = useAssignments();
    const { history, setHistory, addHistoryEntry, syncHistory, loading: historyLoading, error: historyError } = useHistory();
    const { finishedItems, addFinishedItem, syncFinishedItems } = useStorage();
    const { searchAssignments } = useIndexing(assignments, history);
    const { config, setConfig, ...configActions } = useWarehouseConfig(assignments);
    const configLoading = configActions.loading;
    const configError = configActions.error;

    // Role Management
    const { role, section, loading: roleLoading, canEditStructure, canAnalyzeAnomalies, canAssign, canRemove, canRequestItems, shouldSkipValidation, canExport, canFinishProduction, canAccessChapero } = useRoles(user?.uid);

    // System Notifications Hook & Forklift Banner Data
    const { sendSystemAlert, unreadRequestsCount } = useSystemNotifications(role, notify);

    const { assignItem, requestItem, removeItem, moveItem, copyItem, relocateLocationContents, emptyShelf, batchAssign, batchAssignToSingleLocation, batchAssignToMultipleLocations, findItemLocation, adminClearLocations, withdrawItem } = useInventoryOperations(assignments, setAssignments, addHistoryEntry, notify, sendSystemAlert, user?.email || undefined);

    // Deep Link Logic: Check URL for ?view=requests
    // REMOVED in favor of React Router /requests path
    /* useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view');
        if (viewParam === 'requests') {
             // Navigate to /requests if needed, handled by router now
        }
    }, []); */

    const {
        resetScanWorkflow,
        processScanInput
    } = useInventoryWorkflows(
        { assignItem, requestItem, removeItem, moveItem, copyItem, relocateLocationContents, emptyShelf, batchAssign, batchAssignToSingleLocation, batchAssignToMultipleLocations, findItemLocation, adminClearLocations, withdrawItem },
        assignments,
        notify,
        findItemLocation
    );

    const { workingItems } = useWorkingItems();
    const gemini = useGeminiAnalysis();

    // --- APP LOGIC HOOK ---
    const {
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
        handleConfirmRequest
    } = useAppLogic({
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
        shouldSkipValidation,
        resetScanWorkflow,
        processScanInput
    });



    const searchResults = useMemo(() => searchAssignments(searchQuery), [searchQuery, searchAssignments]);

    const handleTabChange = (whCode: string) => {
        handleWarehouseChange(whCode);
        navigate(`/warehouse/${whCode}`);
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
            <MainLayout
                user={user}
                role={role}
                section={section}
                unreadRequestsCount={unreadRequestsCount}
                handleLogout={handleLogout}
                handleSyncData={handleSyncData}
                canAccessChapero={canAccessChapero}
            >
                {/* Notifications Toast Container */}
                <div className="fixed top-4 right-4 z-[999] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 md:px-0">
                    {notifications.map(n => <NotificationToast key={n.id} notification={n} onClose={closeNotification} />)}
                </div>

                <main className="flex-grow p-3 md:p-4 max-w-7xl mx-auto w-full flex flex-col gap-4 md:gap-6">

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
                                gemini={gemini}

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
                                copyItem={copyItem}
                                handleInitiateMove={handleInitiateMove}
                                handlePasteMovedItem={handlePasteMovedItem}
                                handleDirectAssign={handleDirectAssign}
                                handleDirectRemove={handleDirectRemove}
                                handleInitiateAdd={handleInitiateAdd}
                                handleInitiateDelete={handleInitiateDelete}
                                handleConfirmDelete={handleConfirmDelete}
                                handleDragMove={handleDragMove}
                                handleInitiateRequest={handleInitiateRequest}

                                setSelectedMapLocation={setSelectedMapLocation}
                                setShelfDetailMode={setShelfDetailMode}
                                setRelocateSourceLoc={setRelocateSourceLoc}
                            />
                        } />

                        <Route path="/storage" element={<StorageView finishedItems={finishedItems} />} />
                        <Route path="/working" element={<WorkingItemsList userRole={role!} />} />
                        <Route path="/messages" element={<MessagesView currentUserRole={role!} currentUserUid={user.uid} />} />
                        <Route path="/chapero" element={<ChaperoCountView />} />
                        <Route path="/history" element={<HistoryView history={history} onGenerateTraceabilityReport={(h) => gemini.runTraceabilityReport(h)} isTraceabilityLoading={gemini.isTraceabilityLoading} />} />
                        <Route path="/requests" element={role === 'CARRETILLERO' ? <CarretilleroRequestsView onNavigateToLocation={(loc) => { setSelectedMapLocation(loc as LocationId); navigate(`/warehouse/${loc.split('-')[0]}`) }} /> : <Navigate to="/" />} />

                        <Route path="*" element={<Navigate to={`/warehouse/${activeWarehouse || 'MEC'}`} replace />} />
                    </Routes>
                </main>
            </MainLayout>

            {/* MODALS */}
            {/* MODALS encapsulated in AppModals */}
            <AppModals
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
                gemini={gemini}
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
                multiSelectedLocations={multiSelectedLocations}
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
                handleRelocate={async (targetLoc) => {
                    await relocateLocationContents(relocateSourceLoc!, targetLoc);
                    setModal('relocate', false);
                    setRelocateSourceLoc(null);
                }}

                // Actions
                handleInitiateCopy={handleInitiateCopy}
                handleInitiateMove={handleInitiateMove}
                handleInitiateDelete={handleInitiateDelete}
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
                relocateSourceLoc={relocateSourceLoc}
            />
            {/* End of AppModals */}
        </>
    );
};

export default App;

