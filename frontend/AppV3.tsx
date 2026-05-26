
/**
 * AppV3 — Aplicación principal WMS v3.0
 * Gestor de Estanterías
 *
 * Routing automático por rol de usuario:
 * - Sin auth → UnifiedLogin (Flexible para desarrollo)
 * - OPERARIO → KioskView (estantería fija)
 * - CARRETILLERO → CarretilleroView (navega todas)
 * - JEFE_SECCION/CALIDAD → Vista básica con notificaciones
 * - ADMIN/SUPERADMIN → Panel completo
 */

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useAuth } from './hooks/useAuth';
import { useFormFactor } from './hooks/useFormFactor';
import { useInitializeCriticalData } from './hooks/useInitializeCriticalData';
import type { AdminTab } from './components/admin/adminShared';
import OfflineIndicator from './components/common/OfflineIndicator';
import OfflineDebugPanel from './components/common/OfflineDebugPanel';
import { initPushNotifications, listenForegroundMessages } from './lib/pushService';
import { useConnectionMonitor } from './hooks/useConnectionMonitor';
import AppLoadingScreen from './components/app/AppLoadingScreen';
import PushToast from './components/app/PushToast';

// ── Lazy-loaded views — cada rol sólo descarga su código ──────────────────────
const UnifiedLogin      = lazy(() => import('./components/auth/UnifiedLogin'));
const KioskView         = lazy(() => import('./components/kiosk/KioskView'));
const CarretilleroView  = lazy(() => import('./components/carretillero/CarretilleroView'));
const SuperAdminPanel   = lazy(() => import('./components/admin/SuperAdminPanel'));
const AdminShelfBrowser = lazy(() => import('./components/admin/AdminShelfBrowser'));
const ArticleTimeline   = lazy(() => import('./components/admin/ArticleTimeline'));
const ManagerInfoView   = lazy(() => import('./components/app/ManagerInfoView'));
const AdminHomeView     = lazy(() => import('./components/app/AdminHomeView'));
const CalidadView       = lazy(() => import('./components/app/CalidadView'));

const AppV3: React.FC = () => {
  const state = useAuth();
  const formFactor = useFormFactor();
  const {
    loading,
    isAuthenticated,
    role,
    section,
    displayName,
    logout,
    deviceId,
    capabilities,
    authMethod,
    firebaseUser,
    deviceMode,
  } = state;

  const connDeviceType = deviceMode === 'kiosk' ? 'KIOSK'
    : deviceMode === 'carretillero' ? 'CARRETILLERO'
    : deviceMode === 'admin' ? 'ADMIN'
    : 'UNKNOWN';

  useConnectionMonitor({
    authUid: firebaseUser?.uid ?? null,
    deviceId,
    deviceName: displayName || `Dispositivo-${deviceId.slice(-6)}`,
    deviceType: connDeviceType,
    enabled: isAuthenticated && !loading,
  });

  useInitializeCriticalData();

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showShelfBrowser, setShowShelfBrowser] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showOperativeMode, setShowOperativeMode] = useState(false);
  const [adminPanelTab, setAdminPanelTab] = useState<AdminTab>('reports');
  const [pushNotif, setPushNotif] = useState<{ title: string; body: string } | null>(null);

  const openAdminPanel = useCallback((tab: AdminTab = 'reports') => {
    setAdminPanelTab(tab);
    setShowAdminPanel(true);
  }, []);

  // ─── Init Push Notifications ───
  useEffect(() => {
    if (!isAuthenticated || !role || authMethod !== 'email') return;
    if (!['JEFE_SECCION', 'CALIDAD', 'CARRETILLERO', 'ADMIN', 'SUPERADMIN'].includes(role)) return;

    let mounted = true;
    let cleanup: (() => void) | null = null;

    initPushNotifications().catch(console.warn);

    listenForegroundMessages((msg) => {
      if (!mounted) return;
      setPushNotif({ title: msg.title || '', body: msg.body || '' });
      if (msg.data?.type !== 'ADMIN_MESSAGE') {
        setTimeout(() => setPushNotif(null), 10000);
      }
    }).then((unsub) => {
      if (mounted) {
        cleanup = unsub;
      } else {
        unsub?.();
      }
    }).catch(console.warn);

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [isAuthenticated, role, authMethod]);

  // ─── Loading ───
  if (loading) return <AppLoadingScreen />;

  // ─── Not Authenticated ───
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<AppLoadingScreen />}>
        <UnifiedLogin />
      </Suspense>
    );
  }

  // ─── Route by Role ───
  if (role === 'OPERARIO') {
    // OPERARIO es un kiosko — siempre muestra KioskView (no depende de form factor)
    return (
      <Suspense fallback={<AppLoadingScreen />}>
        <>
          <OfflineIndicator />
          <OfflineDebugPanel />
          <PushToast notification={pushNotif} onClose={() => setPushNotif(null)} />
          <KioskView />
        </>
      </Suspense>
    );
  }

  if (role === 'CARRETILLERO' && capabilities.canBrowseAllShelves) {
    return (
      <Suspense fallback={<AppLoadingScreen />}>
        <>
          <OfflineIndicator />
          <OfflineDebugPanel />
          <PushToast notification={pushNotif} onClose={() => setPushNotif(null)} />
          <CarretilleroView />
        </>
      </Suspense>
    );
  }

  if (role === 'JEFE_SECCION') {
    return (
      <Suspense fallback={<AppLoadingScreen />}>
        {showOperativeMode ? (
          <>
            <OfflineIndicator />
            <OfflineDebugPanel />
            <PushToast notification={pushNotif} onClose={() => setPushNotif(null)} />
            <KioskView />
          </>
        ) : (
          <ManagerInfoView role={role} displayName={displayName} section={section} notification={pushNotif} onCloseNotification={() => setPushNotif(null)} onOpenOperativeMode={() => setShowOperativeMode(true)} onLogout={logout} />
        )}
      </Suspense>
    );
  }

  if (role === 'CALIDAD' && capabilities.canAccessShelf('CAL')) {
    return (
      <Suspense fallback={<AppLoadingScreen />}>
        <>
          <OfflineIndicator />
          <OfflineDebugPanel />
          <PushToast notification={pushNotif} onClose={() => setPushNotif(null)} />
          <CalidadView />
        </>
      </Suspense>
    );
  }

  if (role === 'ADMIN' || role === 'SUPERADMIN') {
    return (
      <Suspense fallback={<AppLoadingScreen />}>
        {showOperativeMode ? (
          <CarretilleroView onBack={() => setShowOperativeMode(false)} />
        ) : showShelfBrowser ? (
          <AdminShelfBrowser onBack={() => setShowShelfBrowser(false)} />
        ) : showTimeline ? (
          <ArticleTimeline onBack={() => setShowTimeline(false)} />
        ) : showAdminPanel ? (
          <SuperAdminPanel onClose={() => setShowAdminPanel(false)} role={role} initialTab={adminPanelTab} currentDeviceId={deviceId} isolatedTab />
        ) : (
          <AdminHomeView role={role} displayName={displayName} notification={pushNotif} onCloseNotification={() => setPushNotif(null)} onOpenPanel={openAdminPanel} onOpenShelfBrowser={() => setShowShelfBrowser(true)} onOpenTimeline={() => setShowTimeline(true)} onOpenOperativeMode={() => setShowOperativeMode(true)} onLogout={logout} />
        )}
      </Suspense>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <span className="text-5xl block mb-4">⚠️</span>
        <h2 className="text-xl font-bold text-white mb-2">Rol no reconocido</h2>
        <p className="text-slate-400 mb-4">Tu cuenta no tiene un rol asignado.</p>
        <button onClick={logout}
          className="px-6 py-3 bg-cyan-600 text-white rounded-xl font-bold">
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

export default AppV3;


