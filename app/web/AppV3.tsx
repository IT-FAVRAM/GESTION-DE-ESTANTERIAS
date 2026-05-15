
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

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { useInitializeCriticalData } from './hooks/useInitializeCriticalData';
import type { AdminTab } from './components/admin/adminShared';
import UnifiedLogin from './components/auth/UnifiedLogin';
import KioskView from './components/kiosk/KioskView';
import CarretilleroView from './components/carretillero/CarretilleroView';
import SuperAdminPanel from './components/admin/SuperAdminPanel';
import AdminShelfBrowser from './components/admin/AdminShelfBrowser';
import ArticleTimeline from './components/admin/ArticleTimeline';
import OfflineIndicator from './components/common/OfflineIndicator';
import OfflineDebugPanel from './components/common/OfflineDebugPanel';
import { initPushNotifications, listenForegroundMessages } from './lib/pushService';
import AppLoadingScreen from './components/app/AppLoadingScreen';
import BlockedDeviceScreen from './components/app/BlockedDeviceScreen';
import PushToast from './components/app/PushToast';
import ManagerInfoView from './components/app/ManagerInfoView';
import AdminHomeView from './components/app/AdminHomeView';
import CalidadView from './components/app/CalidadView';

const AppV3: React.FC = () => {
  const state = useAuth();
  const {
    loading,
    isAuthenticated,
    role,
    displayName,
    logout,
    deviceId,
    capabilities,
    authMethod,
  } = state;

  const initStatus = useInitializeCriticalData();

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
    
    if (['JEFE_SECCION', 'CALIDAD', 'CARRETILLERO', 'ADMIN', 'SUPERADMIN'].includes(role)) {
      initPushNotifications().catch(console.warn);
      
      let cleanup: (() => void) | null = null;
      
      listenForegroundMessages((msg) => {
        setPushNotif({ title: msg.title || '', body: msg.body || '' });
        if (msg.data?.type !== 'ADMIN_MESSAGE') {
          setTimeout(() => setPushNotif(null), 10000);
        }
      }).then((unsub) => {
        cleanup = unsub;
      });
      
      return () => {
        cleanup?.();
      };
    }
  }, [isAuthenticated, role, authMethod]);

  // ─── Loading ───
  if (loading) {
    return <AppLoadingScreen />;
  }

  // ─── Not Authenticated ───
  if (!isAuthenticated) {
    // En desarrollo/v3.1 usamos el UnifiedLogin para máxima flexibilidad
    return <UnifiedLogin />;
  }

  // ─── Route by Capabilities + Role ───
  if (role === 'OPERARIO') {
    return (
      <>
        <OfflineIndicator />
        <OfflineDebugPanel />
        <PushToast notification={pushNotif} onClose={() => setPushNotif(null)} />
        <KioskView />
      </>
    );
  }

  if (role === 'CARRETILLERO' && capabilities.canBrowseAllShelves) {
    return (
      <>
        <OfflineIndicator />
        <OfflineDebugPanel />
        <PushToast notification={pushNotif} onClose={() => setPushNotif(null)} />
        <CarretilleroView />
      </>
    );
  }

  if (role === 'JEFE_SECCION') {
    if (showOperativeMode) {
      return <CarretilleroView onBack={() => setShowOperativeMode(false)} />;
    }
    return <ManagerInfoView role={role} displayName={displayName} notification={pushNotif} onCloseNotification={() => setPushNotif(null)} onOpenOperativeMode={() => setShowOperativeMode(true)} onLogout={logout} />;
  }

  if (role === 'CALIDAD' && capabilities.canAccessShelf('CAL')) {
    return (
      <>
        <OfflineIndicator />
        <OfflineDebugPanel />
        <PushToast notification={pushNotif} onClose={() => setPushNotif(null)} />
        <CalidadView />
      </>
    );
  }

  if (role === 'ADMIN' || role === 'SUPERADMIN') {
    if (showOperativeMode) {
      return <CarretilleroView onBack={() => setShowOperativeMode(false)} />;
    }
    if (showShelfBrowser) {
      return <AdminShelfBrowser onBack={() => setShowShelfBrowser(false)} />;
    }
    if (showTimeline) {
      return <ArticleTimeline onBack={() => setShowTimeline(false)} />;
    }
    return showAdminPanel
      ? <SuperAdminPanel onClose={() => setShowAdminPanel(false)} role={role} initialTab={adminPanelTab} currentDeviceId={deviceId} isolatedTab />
      : <AdminHomeView role={role} displayName={displayName} notification={pushNotif} onCloseNotification={() => setPushNotif(null)} onOpenPanel={openAdminPanel} onOpenShelfBrowser={() => setShowShelfBrowser(true)} onOpenTimeline={() => setShowTimeline(true)} onOpenOperativeMode={() => setShowOperativeMode(true)} onLogout={logout} />;
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
