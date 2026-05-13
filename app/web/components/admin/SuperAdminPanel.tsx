import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebaseV3';
import { adminApi } from '../../lib/adminApi';
import {
  COLLECTIONS,
  CONFIG_DOC_ID,
  DEFAULT_APP_CONFIG,
  SHELF_DEFINITIONS,
  ALL_SHELVES,
  type AppConfig,
  type DeviceDoc,
  type UserDoc,
  type UserRole,
} from '../../lib/firestoreSchema';
import { useAnalytics } from '../../hooks/useAnalytics';
import InventoryReport from './InventoryReport';
import AdminDevicesTab from './AdminDevicesTab';
import AdminUsersTab from './AdminUsersTab';
import AdminSpecialLocationsTab from './AdminSpecialLocationsTab';
import AdminChiefsTab from './AdminChiefsTab';
import { ALL_TABS, type AdminTab, type CurrentDeviceDraft } from './adminShared';

export type { AdminTab } from './adminShared';

interface SuperAdminPanelProps {
  onClose: () => void;
  role: UserRole;
  initialTab?: AdminTab;
  currentDeviceId?: string;
  isolatedTab?: boolean;
}

const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({ onClose, role, initialTab = 'reports', currentDeviceId, isolatedTab = false }) => {
  const analytics = useAnalytics();
  const tabs = useMemo(
    () => ALL_TABS.filter((tab) => role === 'SUPERADMIN' || !tab.superadminOnly),
    [role],
  );
  const initialAvailableTab = tabs.some((tab) => tab.key === initialTab) ? initialTab : tabs[0]?.key || 'reports';

  const [activeTab, setActiveTab] = useState<AdminTab>(initialAvailableTab);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [users, setUsers] = useState<Array<UserDoc & { uid: string }>>([]);
  const [devices, setDevices] = useState<Array<DeviceDoc & { id: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [urgentDraft, setUrgentDraft] = useState('');
  const [techDraft, setTechDraft] = useState('');
  const [qualityDraft, setQualityDraft] = useState('');
  const [chiefDrafts, setChiefDrafts] = useState<Record<string, string>>({});
  const [currentDeviceDraft, setCurrentDeviceDraft] = useState<CurrentDeviceDraft>({
    name: 'Navegador actual',
    type: 'KIOSK',
    shelf: 'MEC',
    active: true,
  });
  const activeTabMeta = tabs.find((tab) => tab.key === activeTab);

  useEffect(() => {
    setActiveTab(initialAvailableTab);
  }, [initialAvailableTab]);

  useEffect(() => {
    setUrgentDraft(config.urgentLocations.join('\n'));
    setTechDraft(config.techReviewLocations.join('\n'));
    setQualityDraft(config.qualityEmails.join('\n'));
    setChiefDrafts(Object.fromEntries(Object.entries(config.chiefMapping).map(([section, emails]) => [section, emails.join('\n')])));
  }, [config]);

  useEffect(() => {
    const configRef = doc(db, COLLECTIONS.CONFIG, CONFIG_DOC_ID);
    const unsubscribe = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists) {
        setConfig({ ...DEFAULT_APP_CONFIG, ...(snapshot.data() as AppConfig) });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (role !== 'SUPERADMIN') {
      return undefined;
    }

    const unsubscribe = onSnapshot(collection(db, COLLECTIONS.USERS), (snapshot) => {
      const nextUsers = snapshot.docs.map((doc) => ({ uid: doc.id, ...(doc.data() as UserDoc) }));
      setUsers(nextUsers);
    });

    return () => unsubscribe();
  }, [role]);

  useEffect(() => {
    if (!currentDeviceId) {
      return;
    }

    const currentDevice = devices.find((device) => device.id === currentDeviceId);
    if (!currentDevice) {
      return;
    }

    setCurrentDeviceDraft({
      name: currentDevice.name || 'Navegador actual',
      type: currentDevice.type || 'KIOSK',
      shelf: currentDevice.assignedShelf || 'MEC',
      active: currentDevice.active !== false,
    });
  }, [currentDeviceId, devices]);

  useEffect(() => {
    if (role !== 'SUPERADMIN') {
      return undefined;
    }

    const unsubscribe = onSnapshot(collection(db, COLLECTIONS.DEVICES), (snapshot) => {
      const nextDevices = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as DeviceDoc) }));
      setDevices(nextDevices);
    });

    return () => unsubscribe();
  }, [role]);

  const saveConfig = useCallback(async (updates: Partial<AppConfig>) => {
    if (role !== 'SUPERADMIN') {
      return;
    }

    setSaving(true);
    try {
      const nextConfig = { ...config, ...updates };
      await adminApi.saveConfig(nextConfig);
      setConfig(nextConfig);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      console.error('[AdminPanel] config save error', error);
    } finally {
      setSaving(false);
    }
  }, [config, role]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isolatedTab && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-lg text-slate-200 transition hover:bg-slate-700"
                  aria-label="Volver al inicio admin"
                >
                  ←
                </button>
              )}
              <span className="text-2xl">{role === 'SUPERADMIN' ? '⚙️' : '📊'}</span>
              <div>
                <h1 className="text-lg font-black text-white">
                  {isolatedTab
                    ? `${activeTabMeta?.icon || '📊'} ${activeTabMeta?.label || 'Panel'}`
                    : role === 'SUPERADMIN' ? 'Panel de Supervision' : 'Panel Analitico'}
                </h1>
                <p className="text-xs text-slate-500">
                  {saved
                    ? 'Guardado'
                    : saving
                      ? 'Guardando cambios...'
                      : isolatedTab
                        ? 'Vista individual sin acceso transversal a otras pestañas'
                        : 'Metricas e informes operativos'}
                </p>
              </div>
            </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-slate-700"
          >
            Cerrar
          </button>
        </div>
      </header>

      {!isolatedTab && (
        <div className="border-b border-slate-800 bg-slate-900/60">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full border px-4 py-2 text-sm font-bold whitespace-nowrap transition ${activeTab === tab.key
                  ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-300'
                  : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'
                  }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          {activeTab === 'reports' && <InventoryReport />}

          {role === 'SUPERADMIN' && activeTab === 'devices' && <AdminDevicesTab devices={devices} currentDeviceId={currentDeviceId} currentDeviceDraft={currentDeviceDraft} onCurrentDeviceDraftChange={setCurrentDeviceDraft} />}

          {role === 'SUPERADMIN' && activeTab === 'users' && <AdminUsersTab users={users} />}

          {role === 'SUPERADMIN' && activeTab === 'shelves' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-black text-white">Estanterias del Sistema</h2>
                <p className="mt-1 text-sm text-slate-400">Layout activo, zonas especiales y capacidad por estanteria.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ALL_SHELVES.map((shelf) => (
                  <div key={shelf.code} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-white">{shelf.type === 'cart' ? '🛒' : '📦'} {shelf.name}</h3>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-400">{shelf.code}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{shelf.locationCount} ubicaciones · {shelf.section}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {shelf.layout.zones.map((zone) => (
                        <span key={`${shelf.code}-${zone.name}-${zone.range[0]}`} className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-[11px] font-bold text-slate-400">
                          {(zone.isUrgent || zone.isTechReview) ? `${zone.isUrgent ? 'Urgente' : 'Revision'} ` : ''}
                          {zone.name} {zone.range[0]}-{zone.range[1]}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {role === 'SUPERADMIN' && activeTab === 'special' && <AdminSpecialLocationsTab config={config} urgentDraft={urgentDraft} techDraft={techDraft} setUrgentDraft={setUrgentDraft} setTechDraft={setTechDraft} onSaveConfig={saveConfig} />}

          {role === 'SUPERADMIN' && activeTab === 'chiefs' && <AdminChiefsTab config={config} chiefDrafts={chiefDrafts} qualityDraft={qualityDraft} setChiefDrafts={setChiefDrafts} setQualityDraft={setQualityDraft} onSaveConfig={saveConfig} />}
        </div>
      </main>
    </div>
  );
};

export default SuperAdminPanel;
