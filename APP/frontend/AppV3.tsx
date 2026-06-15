
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
import { initPushNotifications, listenForegroundMessages, refreshTokenOnFocus } from './lib/pushService';
import { useConnectionMonitor } from './hooks/useConnectionMonitor';
import AppLoadingScreen from './components/app/AppLoadingScreen';
import PushToast from './components/app/PushToast';
import ChatButton from './components/app/ChatButton';
import { UrgentAlertsBar } from './components/app/UrgentAlertsBar';
import { useUrgentAlerts } from './hooks/useUrgentAlerts';

// ── Lazy-loaded views — cada rol sólo descarga su código ──────────────────────
const UnifiedLogin      = lazy(() => import('./components/auth/UnifiedLogin'));
const KioskView         = lazy(() => import('./components/kiosk/KioskView'));
const CarretilleroView  = lazy(() => import('./components/carretillero/CarretilleroView'));
const CarrosView        = lazy(() => import('./components/carretillero/CarrosView'));
const SuperAdminPanel   = lazy(() => import('./components/admin/SuperAdminPanel'));
const AdminShelfBrowser = lazy(() => import('./components/admin/AdminShelfBrowser'));
const ArticleTimeline   = lazy(() => import('./components/admin/ArticleTimeline'));
const ManagerInfoView   = lazy(() => import('./components/app/ManagerInfoView'));
const JefeSeccionView   = lazy(() => import('./components/app/JefeSeccionView'));
const PunzonadoView     = lazy(() => import('./components/app/PunzonadoView'));
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
    assignedShelf,
    kioskId,
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
  const [operativeInitialTab, setOperativeInitialTab] = useState<'shelves' | 'pickups' | 'carts'>('shelves');
  const [showCarrosAdminMode, setShowCarrosAdminMode] = useState(false);
  const [adminPanelTab, setAdminPanelTab] = useState<AdminTab>('reports');
  const [pushNotif, setPushNotif] = useState<{ title: string; body: string } | null>(null);
  const { alerts, resolveAlert } = useUrgentAlerts();
  const urgencyBar = isAuthenticated && alerts.length > 0
    ? <UrgentAlertsBar alerts={alerts} currentUid={firebaseUser?.uid ?? null} currentRole={role} onResolve={resolveAlert} />
    : null;

  const openAdminPanel = useCallback((tab: AdminTab = 'reports') => {
    setAdminPanelTab(tab);
    setShowAdminPanel(true);
  }, []);

  // ─── Init Push Notifications ───
  useEffect(() => {
    if (!isAuthenticated || !role || authMethod !== 'email') return;
    if (!['JEFE_SECCION', 'CALIDAD', 'CARRETILLERO', 'ADMIN', 'SUPERADMIN'].includes(role)) return;

    let mounted = true;
    let cleanupForeground: (() => void) | null = null;

    initPushNotifications().catch(console.warn);

    const cleanupFocus = refreshTokenOnFocus();

    listenForegroundMessages((msg) => {
      if (!mounted) return;
      setPushNotif({ title: msg.title || '', body: msg.body || '' });
      if (msg.data?.type !== 'ADMIN_MESSAGE') {
        setTimeout(() => setPushNotif(null), 10000);
      }
    }).then((unsub) => {
      if (mounted) {
        cleanupForeground = unsub;
      } else {
        unsub?.();
      }
    }).catch(console.warn);

    return () => {
      mounted = false;
      cleanupForeground?.();
      cleanupFocus();
    };
  }, [isAuthenticated, role, authMethod]);

  // ─── Chat interno (solo roles autorizados con cuenta real) ───
  const chatEnabled =
    authMethod === 'email' &&
    !!role &&
    ['ADMIN', 'SUPERADMIN', 'JEFE_SECCION', 'CARRETILLERO'].includes(role);
  const chatFab = chatEnabled ? <ChatButton currentUid={firebaseUser?.uid ?? null} currentRole={role} /> : null;

  // ─── Loading ───
  if (loading) return <AppLoadingScreen />;

  // ─── Not Authenticated ───
  // También redirigimos al login si el rol es OPERARIO pero no tiene estantería ni kioskId
  // (evita que dispositivos móviles no registrados se queden en el estado vacío de kiosko).
  if (!isAuthenticated || (role === 'OPERARIO' && !assignedShelf && !kioskId)) {
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
          {urgencyBar}
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
          {urgencyBar}
          <OfflineIndicator />
          <OfflineDebugPanel />
          <PushToast notification={pushNotif} onClose={() => setPushNotif(null)} />
          <CarretilleroView />
          {chatFab}
        </>
      </Suspense>
    );
  }

  // ADMIN/SUPERADMIN FIRST — highest priority
  if (role === 'ADMIN' || role === 'SUPERADMIN') {
    return (
      <Suspense fallback={<AppLoadingScreen />}>
        {urgencyBar}
        {chatFab}
        {showCarrosAdminMode ? (
          <CarrosView onBack={() => setShowCarrosAdminMode(false)} />
        ) : showOperativeMode ? (
          <CarretilleroView onBack={() => { setShowOperativeMode(false); setOperativeInitialTab('shelves'); }} initialTab={operativeInitialTab} />
        ) : showShelfBrowser ? (
          <AdminShelfBrowser onBack={() => setShowShelfBrowser(false)} onOpenCarros={() => { setShowShelfBrowser(false); setShowCarrosAdminMode(true); }} />
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

  if (role === 'JEFE_SECCION') {
    return (
      <Suspense fallback={<AppLoadingScreen />}>
        <>
          {urgencyBar}
          <OfflineIndicator />
          <OfflineDebugPanel />
          <PushToast notification={pushNotif} onClose={() => setPushNotif(null)} />
          {(section || '').toUpperCase() === 'PUNZONADO' ? <PunzonadoView /> : <JefeSeccionView />}
          {chatFab}
        </>
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
          {chatFab}
        </>
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


